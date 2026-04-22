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

### Current Approach (exam_plans)
- **Source**: `exam_plans/{exam_id}/questions[]` array
- **Calculation**: Count of topics with non-null `question_id` ÷ total topics × 100
- **Read By**: `getExamLiveStatus.ts` (primary live status endpoint)
- **Written By**: Batch question generation process
- **Freshness**: Real-time, no cache delays

### Legacy Approach (exam_progress) — Being Deprecated
- **Path**: `exam_progress/{exam_id}`
- **Status**: Still written by `examCompletion.ts` but NOT read by `getExamLiveStatus.ts`
- **Used By**: `getUserExam.ts` (still reads this for generation progress details)
- **Migration Note**: This path is in transition. Future work should consolidate progress tracking to use only `exam_plans`.

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
- **Used For**: After exam reaches READY status
- **Still Pulls**: `exam_progress` for additional generation metrics (legacy, will be migrated)
