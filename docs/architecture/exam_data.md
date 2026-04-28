# Exam Status Transition Architecture

## Overview

How exam status transitions from **QUESTIONS_GENERATING** → **READY** when all questions are created and associated with the exam.

## Status Transition Sequence

```
1. User creates exam
   └→ Status: QUESTIONS_GENERATING
   └→ Create ExamAttempt record in PostgreSQL
   └→ Write topic list to RTDB

2. Cloud Tasks generate batches of questions (10 at a time)
   └→ Store questions in Firestore
   └→ Update RTDB progress

3. Final batch completes
   └→ Trigger completion handler
   └→ Associate all questions with exam

4. Association complete
   └→ Status: READY ← KEY TRANSITION
   └→ Clean up temporary data
   └→ Update related entities
```

## Database State During Transition

### PostgreSQL (Prisma - ExamAttempt Table)

**Initial State (Step 1):**
```
exam_id:        "abc123"
user_id:        "user456"
cert_id:        1
exam_status:    QUESTIONS_GENERATING  ← Initial
total_questions: null                  ← Not set until complete
started_at:     null
completed_at:   null
```

**After Transition (Step 4):**
```
exam_id:        "abc123"
user_id:        "user456"
cert_id:        1
exam_status:    READY                 ← Updated
total_questions: 50                    ← Now set
started_at:     null
completed_at:   null
```

### RTDB (exam_plans/{exam_id})

**During Generation (Step 2):**
```
├─ exam_id: "abc123"
├─ topics: [
│   { exam_topic: "IAM", question_id: null, status: "pending" },
│   { exam_topic: "VPC", question_id: "q_001", status: "completed" },
│   { exam_topic: "Compute", question_id: null, status: "pending" }
│ ]
├─ progress:
│   ├─ completed_count: 1
│   ├─ total_topics: 3
│   └─ progress_percentage: 33%
└─ created_at: 1719172800000
```

**After Completion (Step 4):**
```
[DELETED - temporary data no longer needed]
```

### Firestore (exams/{exam_id}/questions)

**During Generation:**
```
Document: q_001
├─ exam_topic: "VPC"
├─ question_text: "What is a security group?"
├─ options: [...]
├─ correct_answer: "A firewall for EC2 instances"
└─ generated_at: timestamp

Document: q_002
├─ exam_topic: "IAM"
├─ question_text: "..."
├─ options: [...]
├─ correct_answer: "..."
└─ generated_at: timestamp

... (all questions stored)
```

### LinkageRecords (ExamUserAnswer)

**Purpose:** Associate questions with exam + user

**Records Created:**
```
exam_id:        "abc123"
user_id:        "user456"
question_id:    "q_001"
user_answer:    null        (filled after user answers)
correct_answer: "..."
is_correct:     null        (filled after user submits)

... (one record per question)
```

## Transition Triggers

### Condition 1: Last Batch Completes
```
if (batch_number === total_batches) {
  trigger_transition()
}
```

### Condition 2: All Topics Have Questions
```
if (completed_question_count >= total_topics) {
  trigger_transition()
}
```

### Condition 3: Target Questions Reached
```
if (completed_question_count >= target_questions) {
  trigger_transition()
}
```

When ANY condition is true → execute transition

## Transition Process

### Step 1: Verify Questions Exist
```
SELECT COUNT(*) FROM ExamUserAnswer 
WHERE exam_id = 'abc123'
→ Must be > 0
```

### Step 2: Count Associated Questions
```
Questions to associate = count from step 1
Success = count > 0
```

### Step 3: Update ExamAttempt Status
```
UPDATE ExamAttempt 
SET 
  exam_status = 'READY',
  total_questions = count,
  updated_at = NOW()
WHERE exam_id = 'abc123'
```

### Step 4: Update UserCertification Status
```
If first exam for user:
  UPDATE UserCertification
  SET status = 'IN_PROGRESS'
  
If not first exam:
  No change
```

### Step 5: Cleanup Temporary Data
```
DELETE FROM RTDB: exam_plans/{exam_id}
  → No longer needed
  → Reduces storage
  → Question of truth moves to Firestore
```

## Error Recovery

| Error | Detection | Recovery |
|-------|-----------|----------|
| No questions generated | Count = 0 in step 2 | Status = QUESTION_GENERATION_FAILED |
| Partial generation | Count < expected | Status = READY (partial exam OK) |
| Database error | Transaction fails | Retry transition or manual intervention |
| Data inconsistency | Mismatch between stores | Log error, manual review needed |

## Key Design Points

1. **PostgreSQL is source of truth** for exam metadata
2. **Firestore stores questions** (distributed storage)
3. **RTDB is temporary** progress tracker (deleted after completion)
4. **ExamUserAnswer links** questions to exams (audit trail)
5. **Status only changes** when ALL prerequisites satisfied

## Monitoring

Track these transitions:
- Time taken (creation → READY)
- Success rate
- Failure reasons
- Database operation timing
- Number of questions generated per exam


### Step 3.2: Determine Status (Lines ~323-335)

```typescript
const examStatus =
  associationResult.success && associationResult.associatedQuestionCount > 0
    ? ExamStatus.READY // ← TRANSITION HAPPENS HERE
    : ExamStatus.QUESTION_GENERATION_FAILED;

logger.info(`[CHECKPOINT-5A] STATUS_TRANSITION_INITIATED`, {
  exam_id,
  from_status: "QUESTIONS_GENERATING",
  to_status: examStatus,
  associated_questions: associationResult.associatedQuestionCount,
});
```

### Step 3.3: Update Prisma ExamAttempt (Lines ~340-355)

**Database Update:**

```typescript
const updatedExam = await prismaInstance.examAttempt.update({
  where: { exam_id },
  data: {
    exam_status: examStatus, // ← QUESTIONS_GENERATING → READY
    total_questions: associationResult.associatedQuestionCount, // Now has actual count
    updated_at: new Date(),
  },
});
```

**Exact Data Changed:**

```
BEFORE:
- exam_status: "QUESTIONS_GENERATING"
- total_questions: null
- updated_at: 2026-04-24T10:00:00Z

AFTER:
- exam_status: "READY"
- total_questions: 15 (actual count from associationResult)
- updated_at: 2026-04-24T10:05:30Z
```

### Step 3.4: Cache Invalidation (Lines ~356-370)

```typescript
// Invalidate relevant cache keys
await cacheService.invalidate([
  `exam:${exam_id}`,
  `exam:${exam_id}:status`,
  `exam:${exam_id}:questions`,
  `user:${user_id}:exams`,
  `user:${user_id}:certifications:${certification_id}:exams`,
]);
```

### Step 3.5: Update UserCertification Status (Lines ~375-390)

**Check:** Is this the user's first exam for this certification?

```typescript
const userCertification = await prismaInstance.userCertification.findUnique({
  where: {
    user_id_certification_id: {
      user_id,
      certification_id,
    },
  },
});

// If status is NOT_STARTED, update to IN_PROGRESS
if (userCertification.status === CertificationStatus.NOT_STARTED) {
  await prismaInstance.userCertification.update({
    where: {
      user_id_certification_id: { user_id, certification_id },
    },
    data: {
      status: CertificationStatus.IN_PROGRESS,
      started_at: new Date(),
    },
  });
}
```

### Step 3.6: Clean Up RTDB exam_plans (Lines ~395-410)

```typescript
// Delete the temporary exam_plans data from RTDB
// This was only needed during generation process
await rtdb.ref(`exam_plans/${exam_id}`).remove();

logger.info(`[CLEANUP] Deleted exam_plans/${exam_id}`, {
  reason: "Exam transitioned to READY, temporary data no longer needed",
});
```

### Phase 3 Summary - The Transition Checkpoint

| Component                              | Before Transition           | After Transition              |
| -------------------------------------- | --------------------------- | ----------------------------- |
| **Prisma ExamAttempt.exam_status**     | `QUESTIONS_GENERATING`      | `READY`                       |
| **Prisma ExamAttempt.total_questions** | `null`                      | `15` (actual count)           |
| **RTDB exam_plans**                    | Contains 15 topics with IDs | **DELETED**                   |
| **Prisma UserCertification.status**    | `NOT_STARTED`               | `IN_PROGRESS` (if first exam) |
| **Cache**                              | Old values                  | **INVALIDATED**               |

---

## Phase 4: Comprehensive Data Field Changes

### Prisma Table Changes During Full Exam Creation → Ready Transition

#### ExamAttempt Table

| Field              | Initial Value            | After Transition                   | Notes                             |
| ------------------ | ------------------------ | ---------------------------------- | --------------------------------- |
| `exam_id`          | `UUID`                   | `UUID` (unchanged)                 | Primary key, set at creation      |
| `user_id`          | `string`                 | `string` (unchanged)               | From authenticated request        |
| `certification_id` | `string`                 | `string` (unchanged)               | From request parameters           |
| `exam_status`      | `"QUESTIONS_GENERATING"` | `"READY"`                          | **KEY TRANSITION**                |
| `total_questions`  | `null`                   | `15` (or actual count)             | Set when all questions associated |
| `started_at`       | `2026-04-24T10:00:00Z`   | `2026-04-24T10:00:00Z` (unchanged) | Set at creation                   |
| `submitted_at`     | `null`                   | `null` (unchanged)                 | Set when exam completed by user   |
| `created_at`       | `2026-04-24T10:00:00Z`   | `2026-04-24T10:00:00Z` (unchanged) | Immutable                         |
| `updated_at`       | `2026-04-24T10:00:00Z`   | `2026-04-24T10:05:30Z`             | Updated at transition             |

**Code Location:** `certifai-api/functions/src/utils/examQuestionAssociation.ts`, lines 340-355

#### ExamUserAnswer Table (Batch Created During Phases 1-2)

| Field                 | Created When               | Value                     | Count                 |
| --------------------- | -------------------------- | ------------------------- | --------------------- |
| `exam_user_answer_id` | During question generation | `UUID`                    | 15 (one per question) |
| `exam_id`             | During question generation | exam's UUID               | 15                    |
| `question_id`         | During question generation | Generated question UUID   | 15                    |
| `user_answer`         | Question answer selected   | `null` (initially)        | 15                    |
| `correct_answer`      | Question generation        | Answer from AI generation | 15                    |
| `is_correct`          | User completes question    | `boolean` or `null`       | 15                    |

**Created During:** Phase 2, batch processing loop  
**Code Location:** `certifai-api/functions/src/services/cloudTasks/examGenerationTaskService.ts`, lines 100-150

#### UserCertification Table (Conditional Update)

| Condition              | Field        | Before        | After                  | Notes                            |
| ---------------------- | ------------ | ------------- | ---------------------- | -------------------------------- |
| **First exam created** | `status`     | `NOT_STARTED` | `IN_PROGRESS`          | Only if this is first exam       |
| **First exam created** | `started_at` | `null`        | `2026-04-24T10:00:00Z` | Timestamp when exam ready        |
| **Not first exam**     | All fields   | Unchanged     | Unchanged              | No update if already IN_PROGRESS |

**Updated During:** Phase 3, in `updateExamAfterQuestionAssociation()`  
**Code Location:** `certifai-api/functions/src/utils/examQuestionAssociation.ts`, lines 375-390

### RTDB Data Changes During Full Flow

#### exam_plans/{exam_id}

**Phase 1 (After Creation):**

```json
{
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "topics": [
    {
      "exam_topic": "Cloud Architecture",
      "question_id": null,
      "status": "pending"
    },
    { "exam_topic": "Security", "question_id": null, "status": "pending" }
    // ... 13 more topics
  ],
  "total_topics": 15,
  "progress": {
    "completed_count": 0,
    "total_topics": 15,
    "progress_percentage": 0
  }
}
```

**Phase 2 (After Batch 1 - 10 topics):**

```json
{
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "topics": [
    {
      "exam_topic": "Cloud Architecture",
      "question_id": "q_1a2b3c4d",
      "status": "completed"
    },
    // ... 9 more completed topics
    {
      "exam_topic": "Advanced Security",
      "question_id": null,
      "status": "pending"
    }
    // ... 4 more pending topics
  ],
  "progress": {
    "completed_count": 10,
    "total_topics": 15,
    "progress_percentage": 66.67
  }
}
```

**Phase 2 (After Batch 2 - All 15 topics):**

```json
{
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "topics": [
    // All 15 topics now have question_id filled in, status="completed"
  ],
  "progress": {
    "completed_count": 15,
    "total_topics": 15,
    "progress_percentage": 100
  }
}
```

**Phase 3 (Final - Deleted):**

```
exam_plans/{exam_id} → REMOVED FROM RTDB
```

**Deletion Location:** `certifai-api/functions/src/utils/examQuestionAssociation.ts`, lines 395-410

---

## Phase 5: Frontend Status Monitoring & Polling

### Primary Polling Hook

**File:** `certifai-app/src/swr/useExamLiveStatus.ts`  
**Hook Name:** `useExamLiveStatus(userId, examId, shouldPoll)`

#### Hook Behavior

```typescript
export function useExamLiveStatus(
  userId: string | null,
  examId: string | null,
  shouldPoll: boolean = true,
) {
  // Polling configuration
  const { data, error, isLoading } = useSWR(
    userId && examId && shouldPoll
      ? `/api/users/${userId}/exams/${examId}/live-status`
      : null,
    fetcher,
    {
      refreshInterval: 2000, // ← POLL EVERY 2 SECONDS WHILE shouldPoll=true
      revalidateOnFocus: true,
      dedupingInterval: 1000,
    },
  );

  return { liveStatus: data?.data, isLoading, error };
}
```

**Polling Interval:**

- While `exam_status = QUESTIONS_GENERATING`: **Every 2 seconds**
- While `exam_status = READY`: **Stop polling** (shouldPoll set to false)
- On error or user inactive: Reduce frequency

#### Endpoint Called

**URL:** `GET /api/users/{userId}/exams/{examId}/live-status`  
**File:** `certifai-api/functions/src/endpoints/api/users/exams/getExamLiveStatus.ts`

**Response Structure:**

```typescript
{
  success: boolean,
  data: {
    exam_id: string,
    exam_status: "QUESTIONS_GENERATING" | "READY" | "QUESTION_GENERATION_FAILED",
    progress_percentage: number,           // 0-100
    topics_with_questions: number,          // e.g., 10 of 15
    total_topics: number,                   // e.g., 15
    batch_number: number,
    total_batches: number,
    is_complete: boolean,
    estimated_time_remaining?: number      // in seconds
  },
  meta?: {
    cached: boolean,
    timestamp: string
  }
}
```

**Example Response (Batch 1 Generating):**

```json
{
  "success": true,
  "data": {
    "exam_id": "550e8400-e29b-41d4-a716-446655440000",
    "exam_status": "QUESTIONS_GENERATING",
    "progress_percentage": 66.67,
    "topics_with_questions": 10,
    "total_topics": 15,
    "batch_number": 1,
    "total_batches": 2,
    "is_complete": false,
    "estimated_time_remaining": 45
  }
}
```

**Example Response (Exam Ready):**

```json
{
  "success": true,
  "data": {
    "exam_id": "550e8400-e29b-41d4-a716-446655440000",
    "exam_status": "READY",
    "progress_percentage": 100,
    "topics_with_questions": 15,
    "total_topics": 15,
    "batch_number": 2,
    "total_batches": 2,
    "is_complete": true
  }
}
```

### Deprecated Polling Hook

**File:** `certifai-app/src/swr/useExamGeneratingProgress.ts`  
**Status:** **DEPRECATED** - Use `useExamLiveStatus` instead  
**Endpoint:** `GET /api/users/{userId}/exams/{examId}/generating-progress`

---

## Phase 6: Frontend Status Display & User Interaction

### Frontend Status Mapping

**Code Location:** `certifai-app/src/utils/exam-status.ts`

**Backend Enum → Frontend Display Mapping:**

```typescript
const statusMapping: Record<string, string> = {
  QUESTIONS_GENERATING: "generating", // Display: "Exam Generating..."
  READY: "ready", // Display: "Ready to Start"
  STARTED: "started", // Display: "In Progress"
  COMPLETED: "completed", // Display: "Completed"
  QUESTION_GENERATION_FAILED: "generation_failed", // Display: "Generation Failed"
};

// Usage in components:
if (backendStatus === "QUESTIONS_GENERATING") {
  uiStatus = "generating"; // Show progress bar, spinner
}
if (backendStatus === "READY") {
  uiStatus = "ready"; // Show "Start Exam" button, green checkmark
}
```

### Status Display Components

#### 1. ExamCard Component

**File:** `certifai-app/src/components/custom/ExamCard.tsx`  
**Where Used:** Exam list pages, certifications dashboard  
**Polling Enabled:** YES

```typescript
export function ExamCard({ exam }: { exam: ExamAttempt }) {
  const { liveStatus } = useExamLiveStatus(
    apiUserId || null,
    exam.exam_id || null,
    examStatus === 'generating'  // ← Only poll while generating
  );

  const isGenerating = liveStatus?.exam_status === 'QUESTIONS_GENERATING';
  const isReady = liveStatus?.exam_status === 'READY';

  return (
    <Card>
      <CardHeader>
        <h3>{exam.certification_name}</h3>
        {isGenerating && (
          <ExamGenerationProgressBar
            progress={liveStatus.progress_percentage}
            topics={`${liveStatus.topics_with_questions}/${liveStatus.total_topics}`}
          />
        )}
        {isReady && (
          <Badge variant="success">Ready to Start</Badge>
        )}
      </CardHeader>
    </Card>
  );
}
```

**Display Changes During Status Transition:**

```
TIME 0s:  Status: "Exam Generating..." | Progress: 0% | Spinner visible
TIME 30s: Status: "Exam Generating..." | Progress: 66% | Spinner visible
TIME 60s: Status: "Ready to Start" | Progress: 100% | Green checkmark ✓
          "Start Exam" button enabled
```

#### 2. ExamStatusCard Component

**File:** `certifai-app/src/components/custom/ExamStatusCard.tsx`  
**Where Used:** Individual exam detail pages  
**Polling Enabled:** YES (when exam is generating)

```typescript
export function ExamStatusCard({ examStatus }: { examStatus: string }) {
  const statusDisplay = mapStatusToDisplay(examStatus);

  return (
    <div className="status-card">
      <span className={`badge badge-${statusDisplay}`}>
        {statusDisplay === 'generating' && (
          <>
            <Spinner /> Generating Questions...
          </>
        )}
        {statusDisplay === 'ready' && (
          <>
            ✓ Ready to Start
          </>
        )}
      </span>
    </div>
  );
}
```

#### 3. ExamGenerationProgressBar Component

**File:** `certifai-app/src/components/custom/ExamGenerationProgressBar.tsx`  
**Where Used:** During exam creation/generation  
**Props:** `progress` (0-100), `topics` (e.g., "10/15")

```typescript
export function ExamGenerationProgressBar({
  progress,
  topics
}: {
  progress: number;
  topics: string;
}) {
  return (
    <div>
      <ProgressBar value={progress} max={100} />
      <p>Generating: {topics} topics | {progress}%</p>
      {progress < 100 && <Spinner /> }
      {progress === 100 && <p>✓ Exam ready!</p>}
    </div>
  );
}
```

### Polling Configuration Across Views

#### Exam List View

**File:** `certifai-app/src/swr/exams.ts`  
**Hook:** `useAllUserExams()`  
**Polling Interval:** **Every 5 seconds** while any exam is generating

```typescript
const { data: exams } = useSWR(`/api/users/${userId}/exams`, fetcher, {
  refreshInterval: 5000, // Coarser polling for list view
});
```

#### Individual Exam View

**File:** `certifai-app/src/swr/exams.ts`  
**Hook:** `useExamDetails(examId)`  
**Polling Interval:** **Every 2 seconds** while exam is generating

```typescript
const { data: exam } = useSWR(`/api/users/${userId}/exams/${examId}`, fetcher, {
  refreshInterval: 2000, // Finer polling for detail view
});
```

#### Certification Exams View

**File:** `certifai-app/src/swr/exams.ts`  
**Hook:** `useExamsForCertification(certId)`  
**Polling Interval:** **Every 5 seconds** while any exam is generating

---

## Summary Table: Complete Status Transition Timeline

| Time      | Component  | Action                             | Data State                                                                  | User Sees                                             |
| --------- | ---------- | ---------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| **T+0s**  | Backend    | POST /api/.../exams                | `exam_status=QUESTIONS_GENERATING`, Prisma created, RTDB exam_plans written | Loading spinner, "Exam Generating..."                 |
| **T+5s**  | Frontend   | Poll live-status                   | Progress: 33% (5/15 questions)                                              | Progress bar updates to 33%                           |
| **T+30s** | Cloud Task | Batch 1 completes                  | RTDB: 10/15 topics have question_id, `progress=66%`                         | Progress bar: 66%, "10 of 15 topics ready"            |
| **T+35s** | Frontend   | Poll live-status                   | `progress_percentage=66`                                                    | Progress bar: 66%                                     |
| **T+60s** | Cloud Task | Batch 2 completes                  | RTDB: 15/15 topics have question_id                                         | ExamCompletion handler triggered                      |
| **T+62s** | Backend    | updateExamAfterQuestionAssociation | Prisma: `exam_status→READY`, `total_questions=15`, RTDB exam_plans deleted  | (still polling)                                       |
| **T+64s** | Frontend   | Poll live-status                   | `exam_status=READY`, `progress=100`                                         | Status changes to "Ready to Start", green checkmark ✓ |
| **T+65s** | Frontend   | Polling stops                      | Hook stops polling (shouldPoll=false)                                       | "Start Exam" button enabled, active                   |

---

## Database Schema Reference

### Prisma ExamAttempt Model

**File:** `certifai-api/functions/prisma/schema.prisma`, lines ~120-142

```prisma
model ExamAttempt {
  exam_id            String    @id @default(uuid())
  user_id            String
  certification_id   String

  exam_level         String
  difficulty         String
  exam_status        ExamStatus              // Status enum
  total_questions    Int?                    // null until transition to READY

  started_at         DateTime
  submitted_at       DateTime?
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt

  // Relations
  user               User      @relation(fields: [user_id], references: [user_id])
  certification      Certification @relation(fields: [certification_id], references: [cert_id])
  examUserAnswers    ExamUserAnswer[]

  @@index([user_id])
  @@index([certification_id])
  @@index([exam_status])
}
```

### ExamUserAnswer Model

**File:** `certifai-api/functions/prisma/schema.prisma`

```prisma
model ExamUserAnswer {
  exam_user_answer_id  String   @id @default(uuid())
  exam_id              String
  question_id          String
  user_answer          String?  // null until user answers
  correct_answer       String
  is_correct           Boolean? // null until exam submitted

  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  // Relations
  exam                 ExamAttempt @relation(fields: [exam_id], references: [exam_id], onDelete: Cascade)
  question             Question    @relation(fields: [question_id], references: [question_id])

  @@index([exam_id])
  @@index([question_id])
}
```

### UserCertification Model

**File:** `certifai-api/functions/prisma/schema.prisma`

```prisma
model UserCertification {
  user_id            String
  certification_id   String

  status             CertificationStatus  // NOT_STARTED → IN_PROGRESS (when first exam ready)
  started_at         DateTime?             // Set when status becomes IN_PROGRESS
  completed_at       DateTime?

  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  @@id([user_id, certification_id])

  // Relations
  user               User      @relation(fields: [user_id], references: [user_id])
  certification      Certification @relation(fields: [certification_id], references: [cert_id])
}

enum CertificationStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

---

## Key Code References

### Critical Functions & Their Line Numbers

| Function                                     | File                                                          | Purpose                                                                 | Key Lines |
| -------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| `createExam()`                               | `endpoints/api/users/exams/createExam.ts`                     | Initial exam creation, status=QUESTIONS_GENERATING, Cloud Task dispatch | 50-250    |
| `ExamGenerationTaskService.queueBatchTask()` | `services/cloudTasks/examGenerationTaskService.ts`            | Queue batch generation tasks, handle retries                            | 50-100    |
| `processBatchQuestions()`                    | `endpoints/api/internal/cloud-tasks/batch-generate-questions` | Generate questions for batch, update RTDB exam_plans                    | 80-150    |
| `triggerExamCompletion()`                    | `delegators/tasks/buildExam/examCompletion.ts`                | Check if all batches done, decide READY or next batch                   | 100-200   |
| `updateExamAfterQuestionAssociation()`       | `utils/examQuestionAssociation.ts`                            | **CRITICAL**: Status transition QUESTIONS_GENERATING→READY              | 300-410   |
| `useExamLiveStatus()`                        | `swr/useExamLiveStatus.ts`                                    | Frontend polling hook, 2-second refresh interval                        | All       |

---

## Potential Issue Checklist

When debugging exam creation flow issues, verify these checkpoints:

- [ ] **Phase 1**: ExamAttempt created with `exam_status=QUESTIONS_GENERATING` in Prisma
- [ ] **Phase 1**: RTDB `exam_plans/{exam_id}` written with all topics and `question_id=null`
- [ ] **Phase 1**: First Cloud Task queued successfully
- [ ] **Phase 2**: RTDB updates show `question_id` being filled for each topic as batch processes
- [ ] **Phase 2**: ExamUserAnswer records created for each question (count = total_questions)
- [ ] **Phase 2**: Final batch completion triggers `examCompletion.ts` handler
- [ ] **Phase 3**: `updateExamAfterQuestionAssociation()` called with correct exam_id
- [ ] **Phase 3**: Prisma update succeeds: `exam_status→READY`, `total_questions` set
- [ ] **Frontend**: `useExamLiveStatus()` polling stops when status becomes READY
- [ ] **Frontend**: UI components update to show "Ready to Start" status
