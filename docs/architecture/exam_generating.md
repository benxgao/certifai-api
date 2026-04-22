# Exam Generation Architecture & Performance Analysis

## Executive Summary

**Target Performance Goals**

- 10 questions: < 1 minute (60 seconds)
- 60 questions: < 3 minutes (180 seconds)

**Current Baseline** (from codebase analysis)

- Expected: 18-37 seconds for 10 questions ✓ **MEETS TARGET**
- Expected: 108-222 seconds for 60 questions ⚠️ **AT RISK** (upper bound exceeds 180s)

**Root Issue**: Sequential batch processing with per-batch delays creates cumulative overhead for large exams.

---

## Current Architecture Overview

### Exam Generation Flow

```
1. User requests exam (numberOfQuestions, customPromptText)
   ↓
2. createExam endpoint:
   - Creates exam record in Firestore
   - Calculates total_batches = ceil(numberOfQuestions / QUESTIONS_PER_BATCH)
   - Creates first batch Cloud Task (with 1s delay for RTDB race condition prevention)
   ↓
3. First batch Cloud Task (buildExam):
   - Retrieves exam topics from RTDB
   - Generates questions via Gemini 2.0 Flash LLM
   - Stores questions in Firestore
   - Queues next batch Cloud Task (1s delay)
   ↓
4. Batches execute sequentially (one at a time)
   ↓
5. After final batch, marks exam as READY
```

### Configuration Constants

| Constant               | Value           | Impact                                                 |
| ---------------------- | --------------- | ------------------------------------------------------ |
| `QUESTIONS_PER_BATCH`  | 10              | 1 batch per 10 questions; 6 batches for 60 questions   |
| Cloud Task queue rate  | 10 tasks/second | Theoretical dispatch rate (rarely the bottleneck)      |
| Initial RTDB delay     | 1 second        | Race condition prevention; fixed overhead              |
| Per-batch delay        | 1 second        | Prevents database overwhelm; added between batches     |
| Cloud Task max retries | 3               | Exponential backoff: 10s → 20s → 40s                   |
| Gemini temperature     | 0.6             | Balanced creativity; can slow generation on edge cases |
| Gemini maxOutputTokens | 409,600         | Very high token limit (usually not reached)            |

---

## Performance Analysis

### Timing Breakdown (Per Question)

| Phase                    | Duration         | Notes                                          |
| ------------------------ | ---------------- | ---------------------------------------------- |
| **Gemini AI Generation** | 15-30s per batch | Calls Gemini 2.0 Flash for all topics in batch |
| **Database Write**       | 2-5s per batch   | Prisma batch create + RTDB updates (parallel)  |
| **Cloud Task Overhead**  | 1-2s per batch   | Queuingdelay + initial 1s delay                |
| **Per-Batch Total**      | 18-37s per batch | Sum of above                                   |

### Scenarios

#### Scenario A: 10 Questions (1 Batch)

```
Total batches needed: 1
Execution sequence:
  - Initial 1s delay (RTDB prevention)
  - Task 1: Genkit (15-30s) + DB (2-5s) + overhead (1s) = 18-36s
Total time: 18-36 seconds ✓ WELL WITHIN 60s TARGET
```

#### Scenario B: 60 Questions (6 Batches)

```
Total batches needed: 6
Execution sequence (sequential):
  - Initial 1s delay (RTDB prevention)
  - Task 1: 18-36s
  - Task 2: 18-36s (+ 1s inter-batch delay) = 19-37s
  - Task 3: 19-37s
  - Task 4: 19-37s
  - Task 5: 19-37s
  - Task 6: 19-37s

Total time: 1 + (18-36) + 5*(19-37) = 1 + 27 + 139 = ~167 seconds (best case)
                                      = 1 + 36 + 185 = ~222 seconds (worst case)

Result: 167-222 seconds
  - Best case: 167s ✓ WITHIN 180s target
  - Worst case: 222s ✗ EXCEEDS 180s target by 42 seconds
  - Average case: 185-190s ~ AT THE EDGE
```

---

## Identified Bottlenecks

### 🔴 Critical Bottlenecks

#### 1. **Sequential Batch Processing** (High Impact)

**Problem**: Exam batches execute one-at-a-time. Each batch must complete before the next starts, creating linear scaling.

**Impact on 60 questions**:

- With 6 sequential batches: time scales as `6 × (per-batch time)`
- If per-batch time increases (LLM slowness, DB congestion), all 6 batches are affected
- 1-2 minute worst-case scenarios are almost certain

**Current Implementation** ([buildExam/index.ts](../../../functions/src/delegators/tasks/buildExam/index.ts)):

```typescript
// After batch N completes, creates task for batch N+1
await ExamGenerationTaskService.getInstance().createExamGenerationTask(
  nextBatchPayload,
  1, // 1-second delay
);
```

**Why it exists**: To prevent Firestore/RTDB race conditions and manage database load.

---

#### 2. **Cumulative Delays** (Medium Impact)

**Problem**: Multiple fixed delays add up across all batches.

**Delay Sources**:

- Initial 1s delay (RTDB race condition prevention): `1s × 1 batch = 1s`
- Per-batch Cloud Task processing: `1-2s × N batches`
- Total for 6 batches: `1 + 6-12 = 7-13 seconds` of pure delay

**Why it matters**: For 60 questions, delays account for ~7% of total time; acceptable but problematic at edge cases.

---

### 🟡 Medium Bottlenecks

#### 3. **Genkit AI Initialization Timeout** (Conditional Impact)

**Problem**: 45-second timeout for Genkit AI cold start can timeout on first request if function isn't pre-warmed.

**Impact**:

- First question batch on a cold function instance: 45s timeout if slow
- Cloud Task retries with 10s-300s backoff: could add 10-40 seconds
- Result: First request might take 60-90 seconds instead of 30s

**Current implementation**:

- No function pre-warming
- No instance affinity (tasks could hit different instances)
- Genkit singleton initialized on first use

---

#### 4. **Genkit Temperature Settings** (Conditional Impact)

**Problem**: `temperature: 0.6` adds creativity but can slow generation on some models/instances.

**Impact**:

- Temperature 0.6 (balanced): faster than 0.8-1.0, slower than 0.2-0.4
- On slower instances: could add 5-10 seconds per batch
- For 60 questions: `5s × 6 = 30 seconds` additional delay

**Optimization opportunity**: Lower temperature = faster generation with less randomness.

---

#### 5. **Cloud Task Retry Backoff** (Error-Dependent)

**Problem**: If any batch fails, exponential backoff delays are applied: 10s → 20s → 40s.

**Impact**:

- Single batch failure: +10 seconds (first retry)
- Two failures: +10s + 20s = +30 seconds
- Three failures: +10s + 20s + 40s = +70 seconds
- For 60 questions: Could add 70-200+ seconds

**Why it happens**: Network errors, Gemini rate limiting, Firestore contention, cold starts.

---

#### 6. **QUESTIONS_PER_BATCH = 10** (Design Choice)

**Problem**: Hardcoded constant creates N batches for 10N questions.

**Impact**:

- 10 questions = 1 batch ✓
- 60 questions = 6 batches ✓ (but hits retry/delay overhead)
- 100 questions = 10 batches → ~8+ minutes

**Why it's set to 10**:

- Genkit max input: 100 topics per call (code allows up to 100)
- Current setting: Conservative to prevent resource exhaustion
- Batch size tradeoff: Larger batches = fewer API calls, but higher per-call latency

---

### 🟢 Minor Bottlenecks

#### 7. **Database Transaction Timeout** (3 minutes)

**Impact**: Low for current batch sizes (10 questions). Only matters for very large batches (50+ questions).

---

## Performance Recommendations (Prioritized by Implementation Ease)

### Priority 1: Easy (Low Risk, High Impact)

#### **1.1: Reduce Genkit Temperature** [EFFORT: 5 min]

**What**: Lower `temperature` from 0.6 to 0.3 for faster, more deterministic generation.

**Why**: Lower temperature = less randomness = faster token generation in LLM.

**Impact**:

- Per-batch: potentially -5 to -10 seconds
- 60 questions: -30 to -60 seconds (significant!)
- Tradeoff: Less creative variations, but more consistent questions

**Implementation**:

- File: [functions/src/services/genkit/quizGenerator.ts](../../../functions/src/services/genkit/quizGenerator.ts)
- Change: `temperature: 0.6` → `temperature: 0.3`

**Risk**: Low. Temperature tradeoff is subjective (easier to revert if needed).

**Result**: 10 questions: 18-36s → 13-26s ✓
60 questions: 167-222s → 137-162s ✓

---

#### **1.2: Increase QUESTIONS_PER_BATCH** [EFFORT: 10 min]

**What**: Change `QUESTIONS_PER_BATCH` from 10 to 15-20.

**Why**: Fewer batches = fewer API calls + fewer inter-batch delays.

**Impact**:

- 60 questions: 6 batches → 3-4 batches
- Delay reduction: 5-6 seconds of overhead removed
- Genkit call overhead: ~1-2 seconds per batch

| Batch Size | 60 Questions | Total Batches | Est. Total Time     |
| ---------- | ------------ | ------------- | ------------------- |
| 10         | 6 batches    | ~167-222s     | ✗ At edge of target |
| 15         | 4 batches    | ~130-155s     | ✓ Within 180s       |
| 20         | 3 batches    | ~105-130s     | ✓ Well within 180s  |

**Implementation**:

- File: [functions/src/endpoints/api/users/exams/createExam.ts](../../../functions/src/endpoints/api/users/exams/createExam.ts)
- Change: `QUESTIONS_PER_BATCH = 10` → `QUESTIONS_PER_BATCH = 20`

**Risk**: Medium. Larger batches = higher per-call Genkit latency + higher Firestore write cost.

- Test with 60 and 100 question exams to verify performance.
- Monitor Genkit token generation rate (may slow with larger contexts).

**Result**: 60 questions: 167-222s → 105-130s ✓ (well within 180s)

---

#### **1.3: Remove Initial RTDB Delay (Conditional)** [EFFORT: 15 min]

**What**: Eliminate the 1-second initial delay if RTDB race condition is no longer a concern.

**Current code**:

```typescript
// src/services/cloudTasks/examGenerationTaskService.ts
public async createFirstBatchTask(payload: ExamGenerationTaskPayload): Promise<string | undefined> {
  return await this.createExamGenerationTask(payload, 1); // 1-second forced delay
}
```

**Why**: 1 second per exam × millions of exams = significant cumulative impact.

**Impact**:

- All exams get -1 second
- 10 questions: 18-36s → 17-35s (minor)
- 60 questions: 167-222s → 166-221s (negligible)

**Implementation**:

- Requires: Understanding why the 1s delay was added
- Action 1: Grep codebase for "RTDB race condition" comments
- Action 2: Review RTDB interaction in [getExamTopicsFromRtdb.ts](../../../functions/src/delegators/tasks/buildExam/rtdb.ts)
- Action 3: If safe, change delay from 1 to 0

**Risk**: Medium. RTDB race conditions are subtle. Only remove if:

1. You understand the original race condition
2. Can test with high concurrency (100+ exams simultaneously)
3. Monitor for data corruption in RTDB exam plan

**Result**: Minor improvement; recommend only after thorough testing.

---

### Priority 2: Medium (Medium Effort, High Impact)

#### **2.1: Parallelize Batch Processing** [EFFORT: 2-4 hours]

**What**: Execute batches in parallel instead of sequentially.

**Current**: Batches 1 → 2 → 3 → 4 → 5 → 6 (serial)
**Proposed**: Batches 1,2,3 in parallel, then 4,5,6 in parallel (configurable pool size)

**Why**: Reduces N batches to ceil(N / pool_size) effective batches.

**Impact**:

- 60 questions (6 batches) with pool size 3:
  - Becomes: 2 "rounds" of 3 parallel batches
  - Time: ~(36s + 1s) + (36s + 1s) = ~74s ✓
- Less sensitiveto per-batch latency variation

**Implementation Strategy**:

1. **Modify `examCompletion.ts`** to support configurable parallelism

   ```typescript
   // Instead of queueing task N+1 after task N completes
   // Queue tasks 1-3 immediately, 4-6 after round 1 completes

   const BATCH_POOL_SIZE = 3; // Tune based on load
   async function queueNextBatchRound(
     exam_id,
     completed_batch_num,
     total_batches,
   ) {
     const nextBatchStart = completed_batch_num + 1;
     const nextBatchEnd = Math.min(
       nextBatchStart + BATCH_POOL_SIZE - 1,
       total_batches,
     );

     for (let i = nextBatchStart; i <= nextBatchEnd; i++) {
       await queueBatch(exam_id, i); // No sequential waiting
     }
   }
   ```

2. **Handle Firestore write conflicts** (multiple tasks updating same exam record)
   - Use optimistic locking or versioning
   - Or use separate RTDB updates per batch (already partially done)

3. **Monitor Cloud Task queue depth** to tune pool size

**Risk**: High. Potential for:

- Firestore write conflicts if multiple tasks update same exam record simultaneously
- RTDB race conditions (why we had 1s delay in first place)
- Increased resource consumption (more concurrent LLM calls)

**Recommendation**: Implement in staging environment first. Test with 100+ concurrent users.

**Result**: 60 questions: 167-222s → 60-90s ✓ (well within 180s, excellent)

---

#### **2.2: Implement Request Batching with Larger Contexts** [EFFORT: 1-2 hours]

**What**: Instead of 1 question per Gemini call per topic, group multiple questions into a single prompt.

**Current**:

```
Batch request: Generate 1 question for each of 10 topics
Genkit call: 1 request with 10 topics → 10 questions
```

**Proposed**:

```
Batch request: Generate 1 question for each of 20 topics
Genkit call: 1 request with 20 topics → 20 questions
```

**Why**: Fewer API calls + better context reuse.

**Impact**:

- Increase `QUESTIONS_PER_BATCH` from 10 to 20
- BUT keep number of Genkit API calls the same (1 call per batch)
- Result: Same time, but more questions per batch

**Implementation**:

- File: [functions/src/services/genkit/quizGenerator.ts](../../../functions/src/services/genkit/quizGenerator.ts)
- Line ~50: Check `examTopicList.max(100)` constraint
- Change maximum from 100 to 200 topics per batch (if safe)

**Risk**: Low-Medium.

- Genkit already supports up to 100 topics
- Larger requests might be slower per request (but fewer requests overall)
- Monitor token usage and API costs

**Result**: Combined with 1.2 (increase QUESTIONS_PER_BATCH to 20):
60 questions: 4 batches → 3 batches
Time: ~130-155s → ~105-130s ✓

---

### Priority 3: Complex (High Effort, Highest Impact)

#### **3.1: Function Pre-warming & Instance Affinity** [EFFORT: 4-6 hours]

**What**: Keep function instances "warm" with periodic pings, and route exam tasks to the same instance.

**Why**: Avoids 45-second Genkit AI initialization timeout on cold starts.

**Impact**:

- Cold start: 45s timeout potential → warm start: 0s timeout
- First exam might save 10-30 seconds
- Large exams (60+ questions): Save 1 batch cycle

**Implementation**:

1. Create a "keepwarm" Cloud Task that runs every 5 minutes
2. Implement Cloud Tasks service affinity (route tasks to specific instance group)
3. Monitor function memory and CPU usage

**Risk**: High operational complexity. Requires:

- GCP Cloud Functions enterprise features
- Monitoring and scaling tuning
- Cost increase from running idle instances

**Recommendation**: Implement after Quick Wins above prove insufficient.

---

#### **3.2: Genkit Flow Optimization** [EFFORT: 2-3 hours]

**What**: Optimize Genkit flow structure, streaming, and token generation.

**Current**:

```
ai.generateText() → full response parsing → store
```

**Proposed**:

```
ai.streamText() → streaming chunks → parse incrementally → store
```

**Why**: Streaming allows parsing and database writes to happen during generation, reducing wall-clock time.

**Implementation**:

- File: [functions/src/services/genkit/utils.ts](../../../functions/src/services/genkit/utils.ts)
- Check `generateWithValidation` function
- Implement streaming + incremental parsing

**Risk**: Medium. Genkit streaming behavior depends on model. Requires thorough testing.

---

## Recommended Implementation Path

### Phase 1: Quick Wins (Next sprint) ⚡

1. **Reduce Genkit temperature** (0.6 → 0.3) — **5 min investment**
   - Expected gain: -5 to -10s per batch
   - 60 questions: -30-60 seconds

2. **Increase QUESTIONS_PER_BATCH** (10 → 20) — **10 min investment**
   - Expected gain: -2 batches for 60 questions
   - 60 questions: -60 seconds

3. **Verify RTDB delay necessity** — **15 min investigation**
   - If safe to remove: -1 second per exam

**Combined result**: 60 questions: 167-222s → ~100-130s ✓

---

### Phase 2: Medium-Term (Following sprint)

4. **Parallel batch processing** (pool size 2-3) — **2-4 hours investment**
   - Expected gain: -40-60 seconds for 60 questions
   - Result: 60 questions: ~60-90s ✓ (excellent)

5. **Request batching** (20 → 50 topics per call) — **1-2 hours investigation**
   - Expected gain: -1 batch cycle if implemented with careful tuning

**Combined result**: 60 questions: <60s ✓ (exceeds target)

---

### Phase 3: Long-Term (Q3+)

6. **Function pre-warming** — **Operational overhead**
7. **Advanced Genkit optimization** — **Research-driven**

---

## Testing Strategy

### 1. Baseline Metrics (Before Changes)

Run exams with these profiles and measure time-to-ready:

```
- 10 questions (1 batch)
- 20 questions (2 batches)
- 60 questions (6 batches)
- 100 questions (10 batches)
```

Record:

- Queue time (when task was dispatched vs executed)
- Batch duration (AI + DB separate)
- Total end-to-end time
- Any retry patterns

Tool: Add to [ExamGenerationLogger](../../../functions/src/services/exam-generation-logger.ts) if not already tracked.

### 2. Load Testing

Simulate realistic load:

```
- 10 concurrent users creating 10-question exams
- Measure queue depth and individual batch latency
- Identify if Cloud Task queue becomes bottleneck
```

### 3. Canary Deployment

For each change:

1. Deploy to staging with 10% traffic
2. Monitor: error rate, latency, costs
3. Gradually increase to 100%
4. Monitor: no regressions in retry patterns

### 4. Monitoring Alerts

After deployment, set alerts for:

- Batch duration > 60 seconds (indicates slowness)
- Retry rate > 5% (indicates instability)
- Genkit API errors > 1% (indicates rate limiting)

---

## Cost Considerations

| Change                     | Cost Impact       | Notes                                  |
| -------------------------- | ----------------- | -------------------------------------- |
| Larger batches (20 topics) | +0% (fewer calls) | Actually reduces cost                  |
| Lower temperature          | -5% to -10%       | Faster generation = fewer tokens       |
| Parallel batches           | +10% to +20%      | More concurrent LLM calls = more costs |
| Pre-warming functions      | +30% to +50%      | Idle instances running constantly      |

**Recommendation**: Implement Phase 1 (no cost increase) and Phase 2 (cost reduction) before pre-warming.

---

## Appendix: Configuration Tuning

### For 10 Questions in 60 seconds

```
QUESTIONS_PER_BATCH = 10  (1 batch)
temperature = 0.3
Remove 1s initial delay

Expected: 15-30s + 2-5s + 0s = 17-35s ✓
```

### For 60 Questions in 180 seconds

```
QUESTIONS_PER_BATCH = 20  (3 batches)
temperature = 0.3
Parallel pool size = 3 (executes all 3 in parallel)

Expected: (15-30s + 2-5s) × 1 = 17-35s ✓
```

### For 100 Questions in < 3 minutes

```
QUESTIONS_PER_BATCH = 25  (4 batches)
temperature = 0.3
Parallel pool size = 4 (executes all 4 in parallel)
Max Genkit topics = 25 per call

Expected: (15-30s + 2-5s) × 1 = 17-35s ✓
```

---

## References

- [buildExam/index.ts](../../../functions/src/delegators/tasks/buildExam/index.ts) — Batch processing logic
- [quizGenerator.ts](../../../functions/src/services/genkit/quizGenerator.ts) — Gemini LLM configuration
- [createExam.ts](../../../functions/src/endpoints/api/users/exams/createExam.ts) — Exam creation and task queuing
- [examCompletion.ts](../../../functions/src/delegators/tasks/buildExam/examCompletion.ts) — Next batch queuing logic
- [queue.yaml](../../../queue.yaml) — Cloud Task queue configuration
- [ExamGenerationLogger.ts](../../../functions/src/services/exam-generation-logger.ts) — Performance metrics
