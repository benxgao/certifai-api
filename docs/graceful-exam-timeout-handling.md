# Graceful Exam Generation Timeout Handling

## Overview

This document describes the implementation of graceful handling for stuck exam generation processes. The system now automatically detects and fails exams that have been stuck in the `QUESTIONS_GENERATING` state for more than 10 minutes, enabling users to delete failed exams and improve overall user experience.

## Implementation Summary

### 1. Auto-Fail Mechanism (`ExamGenerationHealthCheck.autoFailStuckExams`)

**Location**: `/functions/src/services/exam-generation-health-check.ts`

**Purpose**: Automatically detects exams stuck in `QUESTIONS_GENERATING` state and changes their status to `QUESTION_GENERATION_FAILED`.

**Key Features**:

- Configurable threshold (default: 10 minutes)
- Safe status transition from `QUESTIONS_GENERATING` to `QUESTION_GENERATION_FAILED`
- Comprehensive logging for audit trail
- Batch processing of multiple stuck exams
- Error handling with rollback capability

**Method Signature**:

```typescript
static async autoFailStuckExams(thresholdMinutes: number = 10): Promise<{
  success: boolean;
  failedCount: number;
  failedExams: Array<{
    exam_id: string;
    user_id: string;
    cert_id: number;
    minutes_stuck: number;
  }>;
  errors: string[];
}>
```

### 2. Scheduled Auto-Failure (`autoFailStuckExams`)

**Location**: `/functions/src/scheduledFunctions/examGenerationMonitoring.ts`

**Schedule**: Every 5 minutes
**Threshold**: 10 minutes (configurable)

**Purpose**: Automatically runs the auto-fail process to ensure stuck exams are quickly identified and failed.

**Key Features**:

- Runs every 5 minutes for responsive handling
- Uses 10-minute threshold for auto-failure
- Comprehensive logging for monitoring
- Error recovery and reporting

### 3. Manual Admin Endpoint (`/api/admin/exams/auto-fail-stuck`)

**Location**: `/functions/src/endpoints/api/admin/exams/autoFailStuckExams.ts`

**Method**: POST
**Authentication**: Firebase token required

**Purpose**: Allows administrators to manually trigger the auto-fail process for testing or emergency situations.

**Query Parameters**:

- `threshold_minutes` (optional): Override default 10-minute threshold (1-1440 minutes)

**Example Usage**:

```bash
POST /api/admin/exams/auto-fail-stuck?threshold_minutes=5
Authorization: Bearer <firebase-token>
```

## Frontend Integration

### Existing UI Support

The frontend already has comprehensive support for this feature:

1. **Status Display**: `QUESTION_GENERATION_FAILED` status shows as "Generation Failed" with red styling
2. **Delete Button**: Failed exams show a delete button allowing users to remove them
3. **Error Messages**: Clear user messaging for failed generation states

**Location**: `/app/main/certifications/[cert_id]/exams/page.tsx`

### Key UI Features

- **Status Badge**: Shows "Generation Failed" for `QUESTION_GENERATION_FAILED` exams
- **Delete Action**: Red delete button appears only for failed exams
- **User Feedback**: Clear messaging about generation failures
- **Real-time Updates**: SWR polling detects status changes automatically

## Exam Deletion Process

### Allowed Deletion Statuses

**Location**: `/functions/src/endpoints/api/users/exams/deleteExam.ts`

Exams can be deleted when in these statuses:

- `QUESTION_GENERATION_FAILED` ✅ (enabled by auto-fail)
- `QUESTIONS_GENERATING` ✅ (for immediate cleanup)
- `PENDING_QUESTIONS` ✅ (for setup issues)

**Protected Statuses** (cannot be deleted):

- `READY` (contains generated questions)
- `SUBMITTED` (completed exam data)

### Cascade Deletion

The deletion process removes all related data:

1. **ExamUserAnswer** records (user responses)
2. **AnswerOption** records (answer choices)
3. **QuizQuestion** records (generated questions)
4. **ExamAttempt** record (main exam)
5. **RTDB data** (exam plans and cached data)
6. **Cache invalidation** (user exam cache)

## Configuration

### Timing Configuration

```typescript
// Scheduled function runs every 5 minutes
schedule: "every 5 minutes";

// Auto-fail threshold: 10 minutes
const AUTO_FAIL_THRESHOLD = 10; // minutes

// Maximum manual threshold: 24 hours
const MAX_THRESHOLD = 1440; // minutes
```

### Logging Events

The system logs these key events:

- `AUTO_FAIL_STUCK_EXAMS_START`: Process initiation
- `EXAM_AUTO_FAILED`: Individual exam failure
- `AUTO_FAIL_STUCK_EXAMS_COMPLETE`: Process completion
- `MANUAL_AUTO_FAIL_STUCK_EXAMS_START`: Manual trigger start

## User Experience Flow

### Normal Flow

1. User creates exam
2. Status: `QUESTIONS_GENERATING`
3. Questions generate successfully
4. Status: `READY`
5. User takes exam

### Stuck Exam Flow (New)

1. User creates exam
2. Status: `QUESTIONS_GENERATING`
3. Generation gets stuck (>10 minutes)
4. **Auto-fail system activates**
5. Status: `QUESTION_GENERATION_FAILED`
6. User sees "Generation Failed" status
7. User can delete failed exam
8. User can create new exam

## Benefits

### For Users

- **No Indefinite Waiting**: Stuck exams fail after 10 minutes
- **Clear Feedback**: Know when generation has failed
- **Recovery Path**: Can delete failed exams and try again
- **No Account Blocking**: Failed exams don't count against rate limits

### For System

- **Resource Cleanup**: Automatic cleanup of stuck processes
- **Monitoring**: Clear visibility into generation health
- **Reliability**: System self-healing for stuck states
- **Performance**: Prevents accumulation of stuck processes

## Monitoring and Observability

### Scheduled Function Logs

- Execution frequency: Every 5 minutes
- Success/failure tracking
- Processing time monitoring
- Error reporting and alerting

### Health Check Integration

- Stuck exam detection
- System health reporting
- Performance metrics
- Alert generation

### Admin Tools

- Manual trigger capability
- Configurable thresholds
- Detailed processing reports
- Error investigation tools

## Testing

### Manual Testing

```bash
# Trigger auto-fail for exams stuck >5 minutes
POST /api/admin/exams/auto-fail-stuck?threshold_minutes=5

# Check stuck exams
GET /api/admin/exam-generation/stuck-exams?threshold=5

# Verify system health
GET /api/admin/exam-generation/health
```

### Expected Outcomes

1. Stuck exams change from `QUESTIONS_GENERATING` to `QUESTION_GENERATION_FAILED`
2. Frontend shows delete button for failed exams
3. Users can successfully delete failed exams
4. New exams can be created after deletion

## Implementation Timeline

- ✅ **Auto-fail mechanism**: `ExamGenerationHealthCheck.autoFailStuckExams`
- ✅ **Scheduled function**: `autoFailStuckExams` (every 5 minutes)
- ✅ **Admin endpoint**: `/api/admin/exams/auto-fail-stuck`
- ✅ **Route integration**: Added to main API router
- ✅ **Frontend support**: Already exists for failed exam handling
- ✅ **Documentation**: This comprehensive guide

## Security Considerations

- **Admin Access**: Auto-fail endpoint requires Firebase authentication
- **Rate Limiting**: Threshold validation prevents abuse (1-1440 minutes)
- **Audit Trail**: All auto-fail actions are logged with user context
- **Data Protection**: Only specific exam statuses can be auto-failed

## Future Enhancements

1. **Configurable Thresholds**: Per-certification timeout settings
2. **User Notifications**: Email/SMS alerts for failed generation
3. **Retry Mechanism**: Automatic retry for failed exams
4. **Analytics Dashboard**: Visual monitoring of generation health
5. **Progressive Timeouts**: Different actions at different time intervals

## Conclusion

This implementation provides a robust, user-friendly solution for handling stuck exam generation processes. The system automatically detects and fails stuck exams while providing clear paths for user recovery, improving overall system reliability and user experience.
