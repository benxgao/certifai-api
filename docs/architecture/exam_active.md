## Exam Status Flow: "Generating" → "Active" - Complete Investigation

Here's the complete flow with function signatures and steps for developers to explore:

---

### **Phase 1: Exam Creation (Frontend to Backend)**

**User Action**: Clicks "Create Exam" in [certifai-app/app/main/certifications/[cert_id]/exams/page.tsx](certifai-app/app/main/certifications/%5Bcert_id%5D/exams/page.tsx)

**Step 1a: Frontend Initiates Request**

- Hook: `useCreateExam()` in certifai-app/src/swr/createExam.ts
- Fetcher calls: `POST /api/users/{user_id}/certifications/{cert_id}/exams`
- Payload: `{ numberOfQuestions: number, customPromptText?: string }`

**Step 1b: Backend Endpoint Handler**

- Handler: `createExam()` in certifai-api/functions/src/endpoints/api/users/exams/createExam.ts
- Function signature: `async (req: Request, res: Response) => Promise<void>`
- Processing:
  1. Rate limit validation (max 3 exams/24 hours)
  2. User + certification validation
  3. Token cost check (each question = 2 tokens)
  4. Create exam record with status = `QUESTIONS_GENERATING`
  5. Generate exam topics via `examPlanner` (Genkit AI)
  6. Store topics in RTDB at `exam_plans/{exam_id}`
  7. **Enqueue first Cloud Task** via `ExamGenerationTaskService.createBatchTask()`

**Response**: `{ success: true, data: { exam_id, status: "QUESTIONS_GENERATING", total_questions, total_batches } }`

---

### **Phase 2: Real-Time Progress Monitoring ("Generating" Status)**

**Step 2a: Frontend Polling Loop**

- Hook: `useExamLiveStatus()` in certifai-app/src/swr/useExamLiveStatus.ts
- Polling interval: **2 seconds** while `exam_status === 'QUESTIONS_GENERATING'`
- Request: `GET /api/users/{user_id}/exams/{exam_id}/live-status?force=true` (bypasses cache)

**Step 2b: Backend Live Status Endpoint**

- Handler: `getExamLiveStatus()` in certifai-api/functions/src/endpoints/api/users/exams/getExamLiveStatus.ts
- Function signature: `async (req: Request, res: Response) => Promise<void>`
- Returns:
  ```typescript
  {
    exam_status: "QUESTIONS_GENERATING",
    progress_percentage: 0-100,
    topics_with_questions: number,
    total_topics: number,
    estimated_seconds_remaining: number,
    is_complete: boolean
  }
  ```
- Progress calculation: Reads RTDB `exam_plans/{exam_id}` (source of truth during generation)

**Step 2c: Frontend Display**

- Component: certifai-app/src/components/custom/ExamCardtsx or ExamEmptyState.tsx
- Status display logic: certifai-app/src/types/exam-status.ts - `exam_status === 'QUESTIONS_GENERATING'` → Show "Generating Questions..." + progress bar + estimated time

---

### **Phase 3: Asynchronous Question Generation (Cloud Tasks)**

**Step 3a: Cloud Task Enqueueing**

- Service: `ExamGenerationTaskService` in certifai-api/functions/src/services/cloudTasks/examGenerationTaskService.ts
- Method: `createBatchTask(payload: ExamBatchPayload) => Promise<string>`
- Payload structure:
  ```typescript
  {
    exam_id: string,
    cert_id: number,
    batch_number: number,
    total_batches: number,
    questions_per_batch: 10,
    custom_prompt_text?: string,
    last_exam_report?: string
  }
  ```
- Queue: `exam-questions-queue` (Google Cloud Tasks)
- Delivery: HTTP POST to `/delegators/tasks/take` with 1-second delay

**Step 3b: Cloud Task Handler (Batch Processing)**

- Handler: `buildExam()` in certifai-api/functions/src/delegators/tasks/buildExam/index.ts
- Function signature: `async (req: Request, res: Response) => Promise<void>`
- Processing per batch:
  1. Retrieve exam plan from RTDB `exam_plans/{exam_id}`
  2. Find topics without `question_id` assigned
  3. Call `generateQuestions()` (Genkit AI via examQuestionsGenerator)
  4. Validate generated questions
  5. Store in Firestore at `exams/{exam_id}/questions`
  6. **Update RTDB** with `question_id` assignments (marks progress in real-time)
  7. Decide next step:
     - If last batch OR all topics assigned OR target questions reached → **Complete exam** ✅
     - Otherwise → Enqueue next batch task

**Step 3c: Exam Completion Trigger**

- Called from: buildExam/index.ts when final batch condition met
- Calls: `handleExamCompletion()` from examCompletion.ts
- Function signature: `async (exam_id: string, cert_id: number, batch_info: BatchInfo) => Promise<void>`

---

### **Phase 4: Status Transition - "Generating" → "Ready" (THE CRITICAL STEP)**

**Step 4a: Question Association**

- Function: `associateQuestionsWithExam()` in certifai-api/functions/src/utils/examQuestionAssociation.ts
- Function signature: `async (exam_id: string, cert_id: number) => Promise<AssociationResult>`
- What it does: Links all generated questions to the exam document

**Step 4b: Status Update to READY** ✅ **← THIS IS WHERE GENERATING BECOMES READY**

- Function: `updateExamAfterQuestionAssociation()` in examQuestionAssociation.ts
- Function signature: `async (exam_id: string, associationResult: AssociationResult) => Promise<void>`
- Key logic:

  ```typescript
  const examStatus =
    associationResult.success && associationResult.associatedQuestionCount > 0
      ? ExamStatus.READY // ← Status changes here from QUESTIONS_GENERATING
      : ExamStatus.QUESTION_GENERATION_FAILED;

  await examDoc.update({ status: examStatus });
  ```

**Step 4c: Post-Completion Cleanup**

- Update `userCertification` status to `IN_PROGRESS` (if first exam)
- Clean up RTDB `exam_plans/{exam_id}`
- Invalidate user's exam cache

---

### **Phase 5: Frontend Detects Status Change & Transitions to "Active"**

**Step 5a: Next Poll Detects READY Status**

- Endpoint: `GET /api/users/{user_id}/exams/{exam_id}/live-status`
- Response now shows: `{ exam_status: "READY", progress_percentage: 100, is_complete: true }`
- Frontend hook detects change → stops polling (interval is cleared)

**Step 5b: UI Updates**

- Component: ExamCard.tsx re-renders
- Button changes from "Generating..." to "Begin Exam"

**Step 5c: User Starts Exam → Status Becomes "Active"**

- User clicks "Begin Exam"
- Backend receives request to start exam
- Backend sets `started_at` timestamp on exam record
- Frontend derives status from: `exam_status === 'READY' AND started_at !== null` → display as **"Active"**

---

### **Key Communication Points - Function Signatures at Each Layer**

| Layer                    | Function                               | Signature                                                                              |
| ------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------- |
| **Frontend Hook**        | `useCreateExam()`                      | `(options: SWRConfiguration) => { trigger: (payload) => Promise<CreateExamResponse> }` |
| **Frontend Polling**     | `useExamLiveStatus()`                  | `(user_id, exam_id) => { data: LiveStatusData; isLoading: boolean }`                   |
| **Backend Create**       | `createExam()`                         | `async (req: Request, res: Response) => Promise<void>`                                 |
| **Backend Live Status**  | `getExamLiveStatus()`                  | `async (req: Request, res: Response) => Promise<void>`                                 |
| **Cloud Task Handler**   | `buildExam()`                          | `async (req: CloudTaskRequest, res: Response) => Promise<void>`                        |
| **Question Association** | `associateQuestionsWithExam()`         | `async (exam_id: string, cert_id: number) => Promise<AssociationResult>`               |
| **Status Transition**    | `updateExamAfterQuestionAssociation()` | `async (exam_id: string, associationResult: AssociationResult) => Promise<void>`       |

---

### **Data Flow Diagram**

```
User clicks "Create Exam"
          ↓
createExam Hook → POST /api/users/{user_id}/certifications/{cert_id}/exams
          ↓
Backend createExam() endpoint
  ├→ Create exam record (status = QUESTIONS_GENERATING)
  ├→ Generate topics via Genkit examPlanner
  ├→ Store in RTDB exam_plans/{exam_id}
  └→ ExamGenerationTaskService.createBatchTask(batch 1)
              ↓
        [Cloud Task Queue]
              ↓
      buildExam() handler
  ├→ Generate questions batch 1
  ├→ Update RTDB with progress (question_id assignments)
  ├→ Check: All questions done?
  │   ├→ YES: Call handleExamCompletion()
  │   │   ├→ associateQuestionsWithExam()
  │   │   └→ updateExamAfterQuestionAssociation()
  │   │       └→ Set status = READY ✅ ← CRITICAL POINT
  │   └→ NO: Enqueue next batch task
              ↓
    [Frontend polling loop]
    GET /api/users/{user_id}/exams/{exam_id}/live-status (every 2 sec)
              ↓
    Status changes from QUESTIONS_GENERATING → READY
              ↓
    Frontend: "Begin Exam" button appears
              ↓
    User clicks "Begin Exam"
              ↓
    Backend sets started_at timestamp
              ↓
    Frontend derives: READY + started_at → Display as "Active"
```

---

### **Files to Explore (In Order)**

1. **Start here (Frontend)**: certifai-app/src/swr/createExam.ts - Entry point for exam creation
2. **Frontend Status Loop**: certifai-app/src/swr/useExamLiveStatus.ts - How polling works
3. **Backend Endpoint**: certifai-api/functions/src/endpoints/api/users/exams/createExam.ts - Initial processing
4. **Real-time Progress**: certifai-api/functions/src/endpoints/api/users/exams/getExamLiveStatus.ts - Status polling endpoint
5. **Async Processor**: certifai-api/functions/src/delegators/tasks/buildExam/index.ts - Batch question generation
6. **Status Transition** ✅: certifai-api/functions/src/delegators/tasks/buildExam/examCompletion.ts - Calls completion
7. **Critical Update**: certifai-api/functions/src/utils/examQuestionAssociation.ts - Sets status = READY

This should give developers a clear map to trace the entire request/response cycle!
