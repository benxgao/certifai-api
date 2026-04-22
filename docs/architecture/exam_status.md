# Exam Status Lifecycle

## Overview

This document describes the complete lifecycle of exam statuses, transitions, and how the system tracks exam generation progress.

## Status States

### QUESTIONS_GENERATING

- **When**: Immediately after exam creation
- **What**: Questions are actively being generated across batches
- **Progress Tracking**: Calculated from `exam_plans/{exam_id}/questions[]` by counting topics with populated `question_id` values
- **Duration**: Typically 10-60 seconds depending on exam complexity
- **Triggered By**: CreateExam endpoint initiates a Cloud Task for batch generation

### READY

- **When**: All questions have been generated successfully
- **What**: Exam is fully prepared and available for the user to begin
- **Progress**: 100% in getExamLiveStatus
- **Backend Transition**: Marked by examCompletion task after all batches complete
- **Frontend Behavior**: "Begin Exam" button is enabled; user can start attempt

### IN_PROGRESS

- **When**: User has clicked "Begin Exam" and `started_at` is set
- **What**: User is actively taking or has previously started the exam
- **Frontend Display**: Shown as "Active" badge (intentional semantic mapping for UX)
- **Button State**: "Resume Exam" button is enabled
- **Backend Tracking**: Firestore record has `started_at` timestamp

### COMPLETED

- **When**: User submits exam responses
- **What**: Exam is finished and scoring complete
- **Visible**: In user's exam history with scores and results

## Status Transition Diagram

```
CREATE_EXAM
    ↓
QUESTIONS_GENERATING (backend generates batch questions)
    ↓
[Polls /live-status every 2 seconds - frontend shows progress bar]
    ↓
READY (all questions generated, marked by examCompletion task)
    ↓
User clicks "Begin Exam" → started_at is set in DB
    ↓
Backend detects: status=READY && started_at !== null
    ↓
Frontend derives status: IN_PROGRESS
    ↓
UI displays: "Active" badge, "Resume Exam" button enabled
    ↓
User completes and submits
    ↓
COMPLETED
```

## Progress Tracking

### Current Approach (exam_plans) — Single Source of Truth ✅ COMPLETED

- **Source**: `exam_plans/{exam_id}/questions[]` array
- **Calculation**: Count of topics with non-null `question_id` ÷ total topics × 100
- **Read By**:
  - `getExamLiveStatus.ts` (live status polling endpoint)
  - `getUserExam.ts` via `calculateExamProgressFromPlan()` (generates progress for API response)
- **Written By**: Batch question generation process
- **Freshness**: Real-time, no cache delays
- **Status**: ✅ Migration to exam_plans completed as of 2026-04-22

### Legacy Approach (exam_progress) — Fully Deprecated ✅ MIGRATION COMPLETE

- **Path**: `exam_progress/{exam_id}`
- **Status**: DEPRECATED and no longer written (disabled in examCompletion.ts since 2026-04-22)
- **Read By**: None (getExamGenerationProgress function deprecated, no callers)
- **Written By**: None (updateExamGenerationProgress calls disabled)
- **Migration Completion**:
  - **Phase 2**: Created `calculateExamProgressFromPlan()` helper to derive progress from exam_plans
  - **Phase 3**: Migrated `getUserExam.ts` to call new helper instead of `getExamGenerationProgress()`
  - **Phase 4**: Disabled progress writes in `examCompletion.ts` (code commented for rollback)
  - **Phase 5**: Marked old functions as @deprecated with removal timeline
- **Rollback Path**: Uncomment code in examCompletion.ts if needed; deprecated functions retained until Q3 2026

## Important Fields

### started_at

- **Set When**: At exam creation (via Prisma schema default `@default(now())`)
- **Used For**: Backend check to determine if exam is in progress: `status === 'READY' && started_at !== null`
- **Note**: Despite the name, this is set at exam creation time, not when user begins. This enables the system to distinguish between "ready to take" and "already started".

## Frontend Status Derivation

The frontend derives exam status from backend `exam_status` field using the following logic:

```typescript
// Derived from backend status + started_at
if (backendStatus === 'QUESTIONS_GENERATING') → display as 'generating'
else if (backendStatus === 'READY' && hasStarted) → display as 'in_progress'
else if (backendStatus === 'READY') → display as 'ready'
else if (backendStatus === 'COMPLETED') → display as 'completed'

// UI Label Mapping
'In Progress' → shown as "Active" [intentional for user clarity]
'Ready' → shown as "Ready to Begin"
'Generating' → shown as "Generating Questions..."
```

## API Endpoints

### GET /api/users/{user_id}/exams/{exam_id}/live-status

- **Polling Frequency**: Every 2 seconds during generation
- **Returns**: `exam_status`, `progress_percentage`, `topics_with_questions`, `estimated_seconds_remaining`
- **Cache**: Bypassed for freshness (queries directly from Firestore and RTDB)
- **Progress Source**: `exam_plans` (counts topics with question_id populated)

### GET /api/users/{user_id}/exams/{exam_id}

- **Used For**: After exam reaches READY status or during generation
- **Generation Progress**: During QUESTIONS_GENERATING status, includes `generation_progress` field
  - **Source**: Calculated from `exam_plans` via `calculateExamProgressFromPlan()` helper (✅ migrated 2026-04-22)
  - **Previously**: Read from deprecated `exam_progress` RTDB path (now disabled)

---

## Plan: Improve Exam Progress Implementation Robustness

**Current Status**: Migration to exam_plans is **functionally complete** but **lacks critical safety nets**. Comprehensive review from 8 angles identified 8 issues (1 CRITICAL, 4 HIGH, 3 MEDIUM, 1 LOW).

---

## Critical Issues Identified

### 🔴 **CRITICAL: Zero Test Coverage**

- No tests exist for `calculateExamProgressFromPlan()` function or progress flow
- Silent failures risk: bugs won't be detected until production
- **Phase 1 (tests) was skipped per user request** — now creates risk

### 🟠 **HIGH: Silent Error Handling**

- All errors (timeout, missing data, invalid structure) return `null`
- getUserExam.ts logs at `warn` level, swallowing failures
- Frontend can't distinguish error types or retry intelligently

### 🟠 **HIGH: No Timeout Protection**

- `getRtdbValue()` has no timeout
- Could hang indefinitely on slow RTDB
- Would exhaust Cloud Function concurrency

### 🟠 **HIGH: Data Validation Missing**

- No check that Firestore `total_questions` matches `exam_plans.length`
- User could see 100% progress but get wrong number of questions

### 🟠 **HIGH: Obsolete TODO Comment**

- getExamLiveStatus.ts still says "TODO: Fully deprecate exam_progress"
- Deadline was 2025-Q3; now 8 months overdue (current date: 2026-04-22)
- Misleads developers about migration status

### 🟡 **MEDIUM: Code Duplication**

- Progress calculation logic duplicated in 3 endpoints:
  - getUserExam.ts: uses helper ✅
  - getExamLiveStatus.ts: inline logic ❌ (DRY violation)
  - getExamGeneratingProgress.ts: inline logic ❌ (DRY violation)
- If progress definition changes, must update 3 places

### 🟡 **MEDIUM: No Caching**

- Three endpoints fetch `exam_plans` independently (no shared cache)
- Could reduce RTDB load 70% with Redis cache (5-min TTL)

### 🟡 **MEDIUM: Invalid State Possible**

- If `exam_plans.questions` is empty: returns `current_batch=1, total_batches=0` (invalid state)
- Should validate and log warning

---

## Improvement Plan

**Structure**: 3 phases organized by dependency and risk

### **Phase A: Safety Nets** (CRITICAL/HIGH) — Must Do First

**8 hours effort, blocks Phase B**

| Step | Priority     | What                                        | Where                         | Why                            |
| ---- | ------------ | ------------------------------------------- | ----------------------------- | ------------------------------ |
| A1   | **BLOCKING** | Add test coverage: unit + integration tests | Create `examProgress.test.ts` | Silent failures risk           |
| A2   | HIGH         | Categorized error logging                   | getUserExam.ts L115-130       | Monitor errors, enable retries |
| A3   | HIGH         | Add 5s timeout wrapper                      | `firebase/rtdb.ts`            | Prevent indefinite hangs       |
| A4   | HIGH         | Update obsolete TODO comment                | getExamLiveStatus.ts L87      | Correct documentation          |

**A1 Tests to Add**:

- `calculateExamProgressFromPlan()`: 0%, 50%, 100% complete, invalid inputs, empty array edge cases
- `getUserExam.generation_progress`: included for QUESTIONS_GENERATING, null for others, RTDB failure handling
- Data mismatch detection: Firestore quantity ≠ exam_plans quantity

**A2 Error Categorization Example**:

```typescript
// NEW: Distinguish error types
if (progressError.name === "TimeoutError") {
  logger.error(`RTDB_TIMEOUT`, { retry_recommended: true });
} else if (!examPlan) {
  logger.error(`RTDB_MISSING_EXAM_PLANS`, { severity: "error" });
} else {
  logger.error(`RTDB_FETCH_FAILED`, { stack: progressError.stack });
}
```

**A3 Timeout Wrapper**:

```typescript
// In rtdb.ts service
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new TimeoutError(`Exceeded ${ms}ms`)), ms),
    ),
  ]);
}

// In getUserExam.ts
const examPlan = await withTimeout(getRtdbValue(examPlanPath), 5000);
```

---

### **Phase B: Code Quality** (MEDIUM) — After Phase A

**3.5 hours effort, improves maintainability**

| Step | What                                              | Impact                                    |
| ---- | ------------------------------------------------- | ----------------------------------------- |
| B1   | Consolidate progress calculation to single helper | Single source of truth (no DRY violation) |
| B2   | Add Redis caching for exam_plans (5-min TTL)      | 70% fewer RTDB reads                      |
| B3   | Add input validation for invalid states           | Catch data inconsistencies early          |

**B1 Consolidation**:

- Create: `calculateProgressPercentage(generated, total)` helper in rtdb.ts
- Update: getExamLiveStatus.ts to use helper instead of inline
- Update: getExamGeneratingProgress.ts to use helper instead of inline

**B2 Caching**:

```typescript
const cached = await cacheManager.get(`cache:exam_plans:${exam_id}`);
if (!cached) {
  const examPlan = await withTimeout(getRtdbValue(path), 5000);
  await cacheManager.set(`cache:exam_plans:${exam_id}`, examPlan, 300); // 5 min
}
```

---

### **Phase C: Future Cleanup** (LOW) — Optional, Later

**1 hour effort, non-blocking**

| Step | Decision                                                        | Item                                                                                 |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| C1   | Remove deprecated functions (deadline was 2025-Q3, now overdue) | Delete `getExamGenerationProgress()` + `updateExamGenerationProgress()` from rtdb.ts |
| C2   | Refine frontend type (field unused)                             | Add deprecation comment to `generation_progress` type in certifai-app                |

---

## Files to Modify

| Phase | Impact          | File                                                                   |
| ----- | --------------- | ---------------------------------------------------------------------- |
| A     | New test file   | Create `functions/src/delegators/tasks/buildExam/examProgress.test.ts` |
| A     | Error handling  | getUserExam.ts                                                         |
| A     | Timeout utility | rtdb.ts                                                                |
| A     | Comment update  | getExamLiveStatus.ts                                                   |
| B     | Consolidation   | rtdb.ts + 2 endpoints                                                  |
| B     | Caching         | getUserExam.ts + getExamLiveStatus.ts                                  |
| C     | Deprecation     | rtdb.ts + frontend type                                                |

---

## Recommended Timeline

```
Week 1: Phase A (8 hours) — Safety nets first
  - A1: Tests (3-4h) — reveals bugs early
  - A3: Timeout (1h) + A4: Comment (5min) — parallel with A1
  - A2: Error logging (1.5h) — uses A3's timeout wrapper

Week 2: Phase B (3.5 hours) — Code quality
  - B1: Consolidation (1.5h)
  - B2: Caching (2h)
  - B3: Validation (30min)

Deferred: Phase C (1h) — Non-blocking cleanup
```

---

## Decision Point for User

**Should I proceed with implementation?** Recommend prioritization:

1. ✅ **Do Phase A immediately** (tests + error handling + timeout) — addresses CRITICAL risk
2. ⏳ **Phase B next** (code quality) — ~3.5 hours to eliminate duplication
3. 🔄 **Phase C later** — defer deprecated function removal to next major version

**Estimate**: 11.5 hours total to fully harden the implementation.

Would you like me to create a detailed implementation plan for Phase A first, or would you prefer a different prioritization?
