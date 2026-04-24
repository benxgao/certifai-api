# Exam Status Transition: QUESTIONS_GENERATING → READY

## Overview

This document traces the complete end-to-end flow of how exam status transitions from "generating" to "ready" (active) when a new exam is created. It covers the backend initiation, RTDB/Prisma database interactions, Cloud Task batch processing, the status transition mechanism, and frontend polling/display.

**Quick Timeline:**

```
1. User Creates Exam (API)
   ↓
2. Prisma: ExamAttempt created (status=QUESTIONS_GENERATING)
   ↓
3. RTDB: exam_plans/{exam_id} written with topics
   ↓
4. Cloud Task: First batch queued to generate questions
   ↓
5. Cloud Task Loop: Process batches (10 questions each)
   ↓
6. Final Batch Completion: Trigger updateExamAfterQuestionAssociation()
   ↓
7. Prisma: Update exam_status → READY, total_questions updated
   ↓
8. RTDB: Delete exam_plans/{exam_id} (cleanup)
   ↓
9. Frontend: Poll detects READY status, displays completion
```

---

## Phase 1: Backend Exam Creation & Initiation

### Endpoint Details

**File:** `certifai-api/functions/src/endpoints/api/users/exams/createExam.ts`  
**Route:** `POST /api/users/{user_id}/certifications/{cert_id}/exams`  
**Handler Function:** `createExam(req, res)`

### Initial Creation Steps

#### Step 1.1: Request Validation (Lines ~50-80)

- Validate user authentication via `authCheck` middleware
- Check rate limits: **Maximum 3 exams per 24 hours**
- Extract `certification_id`, `exam_level`, and `difficulty` from request

#### Step 1.2: Create ExamAttempt Record (Lines ~120-145)

**Prisma Table:** `ExamAttempt`  
**Operation:** `prismaInstance.examAttempt.create()`

**Data Created:**

```typescript
{
  exam_id: UUID (auto-generated),
  user_id: string (from auth),
  certification_id: string,
  exam_level: string,
  difficulty: string,
  exam_status: ExamStatus.QUESTIONS_GENERATING,  // ← INITIAL STATUS
  total_questions: null,                          // ← Set later when questions assigned
  started_at: new Date(),
  submitted_at: null,
  created_at: new Date(),
  updated_at: new Date()
}
```

**ExamStatus Enum Values:**

```typescript
enum ExamStatus {
  QUESTIONS_GENERATING = "QUESTIONS_GENERATING", // Initial state
  READY = "READY", // Transition target
  STARTED = "STARTED",
  COMPLETED = "COMPLETED",
  QUESTION_GENERATION_FAILED = "QUESTION_GENERATION_FAILED",
}
```

#### Step 1.3: Generate Exam Topics via AI (Lines ~150-180)

**Service:** `examPlanner` (AI-powered topic generation)

- Generates list of topics/concepts for the exam based on:
  - Certification selected
  - Exam level
  - Difficulty setting
- Returns array of topics to cover

#### Step 1.4: Write Exam Plan to RTDB (Lines ~185-200)

**RTDB Location:** `exam_plans/{exam_id}`

**Structure Written:**

```json
{
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "topics": [
    {
      "exam_topic": "Cloud Architecture Basics",
      "question_id": null,
      "status": "pending"
    },
    {
      "exam_topic": "Security Fundamentals",
      "question_id": null,
      "status": "pending"
    }
    // ... more topics
  ],
  "created_at": 1719172800000,
  "total_topics": 15,
  "questions_per_topic": 10
}
```

#### Step 1.5: Calculate Batch Execution (Lines ~205-220)

- **Batch Size:** 10 questions per Cloud Task
- **Total Batches:** `ceil(total_topics / 10)`
- Example: 15 topics → 2 batches (10 + 5)

#### Step 1.6: Create First Cloud Task (Lines ~225-250)

**Service:** `ExamGenerationTaskService`  
**File:** `certifai-api/functions/src/services/cloudTasks/examGenerationTaskService.ts`

**Cloud Task Created:**

```typescript
{
  exam_id: "550e8400-e29b-41d4-a716-446655440000",
  batch_number: 1,
  batch_start_index: 0,
  batch_size: 10,
  queue_name: "exam-generation-queue",
  task_payload: {
    exam_id,
    batch_number: 1
  }
}
```

**Task Endpoint:** `POST /api/internal/cloud-tasks/batch-generate-questions`

### Phase 1 Summary - Data State After Initiation

| Component                | Location           | Status                                                                  |
| ------------------------ | ------------------ | ----------------------------------------------------------------------- |
| **Prisma - ExamAttempt** | PostgreSQL         | Created with `exam_status=QUESTIONS_GENERATING`, `total_questions=null` |
| **RTDB - exam_plans**    | Firebase RTDB      | Written with 15 topics, all `question_id=null`, `status=pending`        |
| **Cloud Task - Queue**   | Google Cloud Tasks | First batch task queued for immediate processing                        |

---

## Phase 2: Cloud Task Batch Processing

### Cloud Task Execution Loop

**Service:** `ExamGenerationTaskService`  
**File:** `certifai-api/functions/src/services/cloudTasks/examGenerationTaskService.ts`

#### Step 2.1: Process Batch Questions (Lines ~80-150)

**Handler Called:** `/api/internal/cloud-tasks/batch-generate-questions`

**For Each Topic in Batch:**

1. Take next 10 topics from the exam_plans list
2. Call Genkit AI model to generate question for topic
3. Store generated question in Prisma `Question` table
4. Create association in `ExamUserAnswer` table
5. Update RTDB exam_plans[index].question_id with generated question

**Code Pattern:**

```typescript
// Process 10 topics per batch
for (
  let i = batchStartIndex;
  i < Math.min(batchStartIndex + 10, totalTopics);
  i++
) {
  const topic = topics[i];

  // Generate question via Genkit
  const generatedQuestion = await questionGenerationModel.generate({
    exam_topic: topic.exam_topic,
    exam_level,
    difficulty,
  });

  // Create ExamUserAnswer association
  await prismaInstance.examUserAnswer.create({
    exam_id,
    question_id: generatedQuestion.id,
    user_answer: null,
    correct_answer: generatedQuestion.correctAnswer,
    is_correct: null,
  });

  // Update RTDB with question_id
  await rtdb.ref(`exam_plans/${exam_id}/topics/${i}`).update({
    question_id: generatedQuestion.id,
    status: "completed",
  });
}
```

#### Step 2.2: Update RTDB During Processing (Lines ~155-175)

**Location:** `exam_plans/{exam_id}/topics/[index]`

**RTDB Update Pattern:**

```json
// BEFORE
{
  "exam_topic": "Cloud Architecture Basics",
  "question_id": null,
  "status": "pending"
}

// AFTER (each topic gets question_id)
{
  "exam_topic": "Cloud Architecture Basics",
  "question_id": "q_550e8400-e29b-41d4-a716-446655440000_1",
  "status": "completed"
}
```

**RTDB Complete State After Batch 1 (Topics 0-9):**

```json
{
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "topics": [
    // Topics 0-9 have question_id filled in, status=completed
    // Topics 10-14 still have question_id=null, status=pending
  ],
  "progress": {
    "completed_count": 10,
    "total_topics": 15,
    "progress_percentage": 66.67
  }
}
```

### Phase 2.3: Determine Next Action (Lines ~180-210)

**Check in `examCompletion.ts`** (called after batch completes):

```typescript
const isExamComplete = completedQuestions >= totalTopics;

if (isExamComplete) {
  // All topics have questions → Proceed to Phase 3 (Status Transition)
  return triggerUpdateExamAfterQuestionAssociation(exam_id);
} else {
  // More topics remain → Queue next batch
  batch_number = currentBatch + 1;
  batch_start_index = (batchNumber - 1) * 10;
  createNextBatchCloudTask(exam_id, batch_number, batch_start_index);
}
```

**File:** `certifai-api/functions/src/delegators/tasks/buildExam/examCompletion.ts` (Lines ~100-120)

### Phase 2 Summary - Batch Processing State

| Step                      | Prisma Status                      | RTDB Status                    | Queue Status         |
| ------------------------- | ---------------------------------- | ------------------------------ | -------------------- |
| **After Batch 1**         | `exam_status=QUESTIONS_GENERATING` | 10 topics with question_id     | Next batch queued    |
| **After Batch 2 (Final)** | `exam_status=QUESTIONS_GENERATING` | All 15 topics with question_id | Completion triggered |

---

## Phase 3: Status Transition Mechanism (The Critical Transition)

### The Transition Function

**File:** `certifai-api/functions/src/utils/examQuestionAssociation.ts`  
**Function:** `updateExamAfterQuestionAssociation(exam_id, certification_id)`  
**Called from:** `examCompletion.ts` after final batch completion

### Step 3.1: Verify All Questions Associated (Lines ~300-320)

```typescript
const associationResult = await verifyExamQuestionsAssociated(exam_id);

// associationResult contains:
{
  success: boolean,                    // true if all topics have questions
  associatedQuestionCount: number,     // count of ExamUserAnswer records
  failureReason?: string              // If success=false
}
```

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
