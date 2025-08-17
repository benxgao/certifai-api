# Cloud Tasks Queue Auto-Creation Implementation

## Overview

This implementation ensures that Cloud Tasks queues are automatically created or recreated whenever they don't exist during exam creation. This prevents exam generation failures when queues are accidentally deleted or haven't been properly initialized.

## Implementation Details

### Files Modified/Created

1. **`src/services/gcp/cloudTasks/index.ts`** - Enhanced the Cloud Tasks service with queue management capabilities
2. **`src/utils/examQueueManager.ts`** - New utility for exam-specific queue management
3. **`src/utils/index.ts`** - Export the new queue management utilities
4. **`src/endpoints/api/users/exams/createExam.ts`** - Added queue validation before initial exam task creation
5. **`src/delegators/tasks/buildExam/examCompletion.ts`** - Added queue validation before next batch task creation
6. **`src/tests/queueManagementTest.ts`** - Test utilities for validating queue management functionality

### Key Features

#### 1. Automatic Queue Detection and Creation

The `ensureQueueExists()` function:

- Checks if a queue exists using the Cloud Tasks API
- Creates the queue with proper configuration if it doesn't exist
- Handles race conditions where multiple processes might try to create the same queue
- Uses consistent queue configuration matching the deployment script

#### 2. Queue Health Monitoring

The `checkExamQueueHealth()` function:

- Validates that all required queues exist
- Returns health status for monitoring purposes
- Can be integrated with health check endpoints

#### 3. Integration Points

**Exam Creation Flow:**

- Before creating the initial batch task, validates queue readiness
- If validation fails, the exam creation process fails gracefully with proper error logging

**Next Batch Creation Flow:**

- Before creating each subsequent batch task, validates queue readiness
- If validation fails, marks the exam as failed and provides proper error handling

#### 4. Error Handling

- Comprehensive error logging with structured data
- Graceful degradation when queue operations fail
- Proper exam status updates when queue validation fails
- Cache invalidation when exam generation fails due to queue issues

### Queue Configuration

The queues are created with the following configuration (matching the deployment script):

```javascript
{
  maxDispatchesPerSecond: 10,
  retryConfig: {
    maxRetryDuration: { seconds: 86400 }, // 24 hours
    minBackoff: { seconds: 10 },
    maxBackoff: { seconds: 300 },
    maxDoublings: 5,
  },
}
```

### Usage Examples

#### Basic Queue Validation

```typescript
import { validateExamQueueReadiness } from "../utils/examQueueManager";

// Ensure all exam queues are ready before starting operations
await validateExamQueueReadiness();
```

#### Health Check Integration

```typescript
import { checkExamQueueHealth } from "../utils/examQueueManager";

// Check queue health for monitoring
const health = await checkExamQueueHealth();
console.log("Queue Health:", health);
```

#### Manual Queue Management

```typescript
import { ensureExamQueuesExist } from "../utils/examQueueManager";

// Manually ensure queues exist (useful for maintenance scripts)
await ensureExamQueuesExist();
```

### Benefits

1. **Resilience**: Exams can be created even if queues are accidentally deleted
2. **Automation**: No manual intervention required when queues are missing
3. **Consistency**: Uses the same configuration as the deployment scripts
4. **Monitoring**: Provides health check capabilities for queue status
5. **Error Handling**: Graceful failure with proper logging and user feedback

### Testing

A comprehensive test suite is provided in `src/tests/queueManagementTest.ts` that includes:

- Queue health checking
- Queue creation and validation
- Queue deletion recovery simulation
- Individual queue operation testing

To run the tests:

```bash
cd functions
npx ts-node src/tests/queueManagementTest.ts
```

### Monitoring and Logging

All queue operations are logged with structured data for easy monitoring:

- Queue existence checks
- Queue creation attempts
- Validation successes and failures
- Integration with exam generation logging

Search for these log patterns:

- `QUEUE_VALIDATION_START`
- `QUEUE_VALIDATION_SUCCESS`
- `QUEUE_VALIDATION_ERROR`
- `QUEUE_VALIDATION_NEXT_BATCH`

### Future Enhancements

1. **Multiple Queue Types**: Easy to extend for additional queue types
2. **Regional Queues**: Support for multi-region queue deployment
3. **Queue Metrics**: Integration with Cloud Monitoring for queue metrics
4. **Automatic Scaling**: Dynamic queue configuration based on load

### Deployment Notes

1. Ensure the service account has the required permissions:

   - `roles/cloudtasks.enqueuer`
   - `roles/cloudtasks.admin` (for queue creation)

2. Environment variables required:

   - `GCP_PROJECT_ID`
   - `GCP_REGION`
   - `GCP_TASKS_SERVICE_ACCOUNT`

3. The implementation is backward compatible with existing queue deployments

### Related Files

- `functions/scripts/deploy-queues.sh` - Manual queue deployment script
- `functions/scripts/validate-cloud-tasks-auth.sh` - Queue validation script
- `queue.yaml` - App Engine queue configuration (if applicable)

This implementation ensures robust exam generation by automatically handling queue management, providing a seamless experience even when infrastructure components are accidentally modified or deleted.
