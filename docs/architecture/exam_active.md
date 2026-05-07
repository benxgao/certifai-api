# Exam Status Flow Architecture

## Overview

This document describes how exam status transitions from creation through completion. The system uses asynchronous batch processing with real-time progress tracking to generate questions efficiently.

## Status Lifecycle

```
QUESTIONS_GENERATING → READY → STARTED → COMPLETED
                        ↓
                  (when user
                   begins exam)
```

## High-Level Flow

```
User Creates Exam
    ↓
Backend: Create exam record (status = QUESTIONS_GENERATING)
         Store topics in RTDB
         Queue first batch task
    ↓
Cloud Task Loop: Generate questions in batches (10 at a time)
                 Update RTDB with progress
                 Enqueue next batch if needed
    ↓
Final Batch: Trigger completion
             Associate all questions
             Update status → READY
             Clean up temporary data
    ↓
Frontend: Poll detects READY status
          Shows "Begin Exam" button
    ↓
User Clicks "Begin Exam"
    ↓
Status → STARTED
```

## Components

### 1. Exam Creation (Synchronous)

- **What**: Create exam record with initial status
- **Where**: `POST /api/users/{user_id}/certifications/{cert_id}/exams`
- **Outputs**:
  - ExamAttempt record in PostgreSQL (status: QUESTIONS_GENERATING)
  - Topic list in RTDB at `exam_plans/{exam_id}`
  - First Cloud Task queued

### 2. Batch Question Generation (Asynchronous)

- **What**: Generate 10 questions per Cloud Task
- **Where**: Cloud Task handler (delegators/tasks/buildExam)
- **Repeats**: Until all topics have questions
- **Updates**: RTDB with progress in real-time

### 3. Status Transition (Automatic)

- **What**: When final batch completes, update exam status to READY
- **Where**: examCompletion.ts → examQuestionAssociation.ts
- **Action**: Associate all questions, update Prisma status

### 4. Frontend Polling (Continuous)

- **What**: Check exam status every 2 seconds
- **Endpoint**: `GET /api/users/{user_id}/exams/{exam_id}/live-status`
- **Returns**: Progress percentage, estimated time remaining
- **Stops**: When status becomes READY

## Key Design Decisions

### Asynchronous Batch Processing

- **Why**: Avoid timeout on creating many questions at once
- **How**: Cloud Tasks handle 10 questions per batch
- **Benefit**: Fast response to user, questions generated in background

### Real-Time Progress Tracking

- **Where**: RTDB stores progress (fast reads)
- **What**: Question count, percentage complete, ETA
- **Why**: Users see instant feedback while waiting

### Two-Stage Status Update

1. **QUESTIONS_GENERATING** - Questions being created
2. **READY** - All questions complete, waiting for user to start

### Cleanup Strategy

- Remove temporary `exam_plans/{exam_id}` from RTDB after completion
- Keep only actual questions in Firestore
- Update userCertification status if needed

## Data Storage

| Data                | Location   | Purpose                | Lifecycle                             |
| ------------------- | ---------- | ---------------------- | ------------------------------------- |
| Exam metadata       | PostgreSQL | Source of truth        | Created → Deleted                     |
| Topic list          | RTDB       | Fast progress tracking | Created → Deleted after all questions |
| Generated questions | Firestore  | Question storage       | Created → Deleted with exam           |

## Error Scenarios

| Scenario                  | Handling                                          |
| ------------------------- | ------------------------------------------------- |
| Cloud Task fails          | Task retries automatically; manual retry possible |
| Partial generation        | Frontend shows progress; user can check status    |
| Network timeout           | Frontend resumes polling; no data loss            |
| Question validation fails | Bad questions skipped; batch continues            |

## Monitoring

Key events to track:

- `exam_created` - Exam record created
- `batch_queued` - Cloud Task enqueued
- `questions_generated` - Batch completed
- `status_ready` - Exam ready for user
- `exam_started` - User began exam
