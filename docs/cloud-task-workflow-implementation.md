# Cloud Task Workflow Implementation Guide

## Overview

This guide explains the complete cloud task workflow implementation for both exam generation and knowledge pooling, including reusable services and background task processing.

## Architecture

### Cloud Task Services Architecture

```
BaseCloudTaskService (Abstract)
├── ExamGenerationTaskService
│   ├── createFirstBatchTask()
│   ├── createNextBatchTask()
│   └── createExamGenerationTask()
└── KnowledgePoolingTaskService
    ├── createPostSubmissionTask()
    ├── createManualTask()
    └── createKnowledgePoolingTask()
```

### Queue Management

```
CloudTaskQueueManager
├── ensureAllQueuesExist()
├── ensureExamQueuesExist()
├── ensureKnowledgePoolingQueuesExist()
├── checkAllQueuesHealth()
├── validateAllQueuesReadiness()
├── validateExamQueueReadiness()
└── validateKnowledgePoolingQueueReadiness()
```

## Cloud Task Workflow

### 1. Exam Generation Workflow

#### Flow

1. User creates exam → `createExam.ts`
2. Validates queue readiness
3. Creates first batch task using `ExamGenerationTaskService`
4. Task processed by `delegators/tasks/buildExam`
5. For multi-batch exams, creates next batch task
6. Continues until all batches complete

#### Key Features

- **Race Condition Prevention**: 1-second delay for first batch
- **Queue Auto-Creation**: Automatically creates missing queues
- **Batch Processing**: Processes questions in configurable batches
- **Error Handling**: Graceful failure with proper logging

### 2. Knowledge Pooling Workflow

#### Flow

1. User submits exam → `submitExamForUser.ts`
2. Exam submission completes successfully
3. Creates knowledge pooling task using `KnowledgePoolingTaskService`
4. Task processed silently in background by `delegators/tasks/knowledge-pooling`
5. Generates insights and stores in Firestore

#### Key Features

- **Non-Blocking**: Runs silently without blocking submission
- **5-Second Delay**: Ensures exam submission fully completes
- **Error Resilience**: Background task failures don't affect user experience
- **Cache Optimization**: Uses existing knowledge pooling cache strategy

## Queue Configuration

### Queue Names

- `exam-questions-queue`: Handles exam generation tasks
- `knowledge-pooling-queue`: Handles knowledge pooling generation tasks

### Queue Settings

```bash
--max-dispatches-per-second=10
--max-retry-duration=86400s
--min-backoff=10s
--max-backoff=300s
--max-doublings=5
```

## Implementation Details

### Cloud Task Services

#### BaseCloudTaskService

Abstract base class providing:

- Environment validation
- Task creation with error handling
- Structured logging
- Reusable patterns

#### ExamGenerationTaskService

Singleton service for exam generation tasks:

```typescript
const service = ExamGenerationTaskService.getInstance();
const taskName = await service.createFirstBatchTask(payload);
```

#### KnowledgePoolingTaskService

Singleton service for knowledge pooling tasks:

```typescript
const service = KnowledgePoolingTaskService.getInstance();
const taskName = await service.createPostSubmissionTask(
  examId,
  userId,
  certId,
  certificationName
);
```

### Task Handlers

#### Exam Generation Handler

- **Endpoint**: `/delegators/tasks/take`
- **Queue**: `exam-questions-queue`
- **Payload**: `ExamGenerationTaskPayload`
- **Function**: Generates exam questions in batches

#### Knowledge Pooling Handler

- **Endpoint**: `/delegators/tasks/knowledge-pooling`
- **Queue**: `knowledge-pooling-queue`
- **Payload**: `KnowledgePoolingTaskPayload`
- **Function**: Generates knowledge insights from incorrect answers

## Integration Points

### Exam Creation Integration

```typescript
// In createExam.ts
const firstBatchPayload: ExamGenerationTaskPayload = {
  exam_id: newExam.exam_id,
  cert_id: certification.cert_id,
  certification_name: certification.name,
  batch_number: 1,
  total_batches: totalBatches,
  custom_prompt_text: customPromptText || "",
  questions_per_batch: QUESTIONS_PER_BATCH,
  last_exam_report: lastExamReport || undefined,
};

const taskName =
  await ExamGenerationTaskService.getInstance().createFirstBatchTask(
    firstBatchPayload
  );
```

### Exam Submission Integration

```typescript
// In submitExamForUser.ts
const service = KnowledgePoolingTaskService.getInstance();
const taskName = await service.createPostSubmissionTask(
  exam_id,
  user_id,
  examAttempt.cert_id,
  examAttempt.certification?.name || "Unknown Certification"
);
```

## Environment Variables

Required environment variables:

```bash
GCP_PROJECT_ID="your-project-id"
GCP_REGION="us-central1"
GCP_TASKS_SERVICE_ACCOUNT="your-service-account@your-project.iam.gserviceaccount.com"
GCP_TASKS_HOST="https://us-central1-your-project.cloudfunctions.net"
```

## Deployment

### 1. Deploy Queues

```bash
cd functions
./scripts/deploy-queues.sh
```

### 2. Deploy Functions

```bash
firebase deploy --only functions
```

### 3. Validate Setup

```bash
cd functions
./scripts/validate-cloud-tasks-auth.sh
```

## Error Handling

### Exam Generation Errors

- Queue validation failures mark exam as failed
- Task creation failures update exam status
- Comprehensive logging for debugging
- Cache invalidation on failures

### Knowledge Pooling Errors

- Background task failures don't affect user experience
- Errors logged but don't cause retries
- Graceful degradation for missing data
- Structured error reporting

## Monitoring & Logging

### Key Log Patterns

- `EXAM_GENERATION_TASK_*`: Exam generation task events
- `KNOWLEDGE_POOLING_TASK_*`: Knowledge pooling task events
- `QUEUE_VALIDATION_*`: Queue validation events
- `CLOUD_TASK_*`: General cloud task events

### Structured Logging

All logs include:

- `exam_id`
- `user_id`
- `cert_id`
- `certification_name`
- `trigger_source`
- `task_name`
- `structuredData: true`

## Benefits

### For Exam Generation

- **Improved Reliability**: Auto-queue creation prevents failures
- **Better Error Handling**: Structured error management
- **Code Reusability**: Reusable task service patterns
- **Maintainability**: Clear separation of concerns

### For Knowledge Pooling

- **Non-Blocking**: User experience not affected by background processing
- **Automatic**: Triggers automatically after exam submission
- **Resilient**: Graceful error handling
- **Scalable**: Uses proven cloud task patterns

### For Development

- **Type Safety**: Full TypeScript support
- **Testability**: Clear interfaces and patterns
- **Documentation**: Comprehensive documentation
- **Extensibility**: Easy to add new task types

## Future Enhancements

1. **Multiple Queue Types**: Easy to extend for additional queue types
2. **Regional Queues**: Support for multi-region queue deployment
3. **Queue Metrics**: Integration with Cloud Monitoring
4. **Batch Optimization**: Dynamic batch sizing based on load
5. **Priority Queues**: Support for high-priority tasks
6. **Retry Strategies**: Configurable retry policies per task type

## Testing

### Manual Testing

1. Create an exam and verify task creation
2. Submit an exam and verify knowledge pooling task
3. Check Cloud Tasks console for task execution
4. Monitor function logs for proper execution

### Validation Scripts

```bash
# Validate queue setup
./scripts/validate-cloud-tasks-auth.sh

# Test queue management
npx ts-node src/tests/queueManagementTest.ts
```

## Security Considerations

- Service account follows principle of least privilege
- OIDC authentication for protected endpoints
- Input validation for all task payloads
- Structured error handling without sensitive data exposure
- Environment variable validation

This implementation provides a robust, scalable, and maintainable cloud task workflow that supports both synchronous exam generation and asynchronous knowledge pooling while maintaining excellent user experience and system reliability.
