# Exam Generation Structured Logging & Monitoring

This implementation provides comprehensive structured logging, metrics collection, and alerting for the Cloud Tasks exam generation system as outlined in the cloudtasks-exam-generation.md documentation.

## Overview

The system provides:

- **Structured Logging**: Comprehensive logging with standardized JSON format
- **Metrics Collection**: Real-time performance and error tracking
- **Health Monitoring**: System health checks and alerts
- **Automated Monitoring**: Scheduled functions for continuous oversight
- **Admin APIs**: Management endpoints for troubleshooting

## Components

### 1. ExamGenerationLogger (`services/exam-generation-logger.ts`)

Provides structured logging for all exam generation events:

#### Key Features:

- **Exam Creation Start**: Tracks when exam generation begins
- **Batch Processing**: Logs each batch with timing and memory metrics
- **AI Service Calls**: Monitors AI request/response with token usage
- **Database Operations**: Tracks database storage performance
- **Task Creation**: Logs Cloud Task creation and failures
- **Error Handling**: Structured error logging with context

#### Example Usage:

```typescript
// Log batch start (returns timing/memory baseline)
const batchMetrics = ExamGenerationLogger.logBatchStart({
  exam_id: "exam-123",
  batch_number: 1,
  total_batches: 5,
  questions_to_generate: 10,
  cert_id: 1,
});

// Log AI request
ExamGenerationLogger.logAIRequest({
  exam_id: "exam-123",
  batch_number: 1,
  ai_service: "openai",
  certification_name: "AWS Solutions Architect",
  questions_requested: 10,
});

// Log batch completion
ExamGenerationLogger.logBatchComplete({
  exam_id: "exam-123",
  batch_number: 1,
  total_batches: 5,
  questions_generated: 10,
  questions_stored: 10,
  start_time: batchMetrics.start_time,
  initial_memory: batchMetrics.initial_memory,
  success: true,
});
```

### 2. ExamGenerationMetrics (`services/exam-generation-metrics.ts`)

Collects and analyzes performance metrics with automatic alerting:

#### Key Features:

- **Success Rate Tracking**: Monitors batch, exam, and AI service success rates
- **Performance Metrics**: Tracks duration, memory usage, and costs
- **Automated Alerts**: Generates alerts for performance issues
- **Metrics Reports**: Comprehensive reporting with recommendations

#### Alert Thresholds:

- **Error Rate**: > 10%
- **Slow Batch Processing**: > 60 seconds
- **High Memory Usage**: > 100MB
- **High Cost Per Batch**: > $2.00

#### Example Usage:

```typescript
// Record batch operation
ExamGenerationMetrics.recordBatchOperation({
  exam_id: "exam-123",
  batch_number: 1,
  success: true,
  duration_ms: 45000,
  memory_used_mb: 67,
  cost: 0.5,
});

// Get success rate
const successRate = ExamGenerationMetrics.calculateSuccessRate(15, "batch");
// Returns: { total: 10, successful: 9, rate: 90 }

// Get active alerts
const alerts = ExamGenerationMetrics.getActiveAlerts();
// Returns: ["High error rate: 15% (threshold: 10%)"]
```

### 3. ExamGenerationHealthCheck (`services/exam-generation-health-check.ts`)

Comprehensive system health monitoring:

#### Key Features:

- **System Health Checks**: Queue, database, and AI service status
- **Stuck Exam Detection**: Identifies exams that have been processing too long
- **Force Complete**: Emergency procedure for stuck exams
- **Comprehensive Reports**: Detailed system status with recommendations

#### Health Status Levels:

- **Healthy**: All systems operating normally
- **Degraded**: Some performance issues detected
- **Unhealthy**: Significant issues requiring attention
- **Error**: System failures detected

#### Example Usage:

```typescript
// Perform health check
const healthReport = await ExamGenerationHealthCheck.performHealthCheck();

// Get stuck exams
const stuckExams = await ExamGenerationHealthCheck.getStuckExams(30);

// Force complete a stuck exam (emergency procedure)
const result = await ExamGenerationHealthCheck.forceCompleteExam(
  "exam-123",
  "Stuck for over 2 hours",
  "admin-user-id"
);
```

### 4. Scheduled Monitoring (`scheduledFunctions/examGenerationMonitoring.ts`)

Automated monitoring functions:

#### Functions:

1. **collectExamGenerationMetrics**: Runs every 15 minutes
   - Collects system metrics
   - Performs health checks
   - Generates alerts
2. **dailyExamGenerationReport**: Runs daily at midnight UTC

   - Comprehensive 24-hour report
   - Daily statistics and trends
   - Critical issue alerts

3. **automatedStuckExamCleanup**: Runs every hour
   - Identifies stuck exams
   - Logs critical issues
   - Can be extended for auto-cleanup

### 5. Admin API Endpoints

#### Health Check (`/api/admin/exam-generation/health`)

```bash
GET /api/admin/exam-generation/health

Response:
{
  "success": true,
  "data": {
    "timestamp": "2025-01-13T...",
    "overall_status": "healthy",
    "queue_status": "healthy",
    "database_status": "healthy",
    "ai_service_status": "healthy",
    "active_generations": 5,
    "error_rate_percent": 2.5,
    "performance_metrics": {...},
    "alerts": []
  }
}
```

#### Metrics Report (`/api/admin/exam-generation/metrics`)

```bash
GET /api/admin/exam-generation/metrics?timeWindow=60

Response:
{
  "success": true,
  "data": {
    "timestamp": "2025-01-13T...",
    "system_health": {...},
    "metrics": {...},
    "stuck_exams": [...],
    "recommendations": [...]
  }
}
```

#### Stuck Exams (`/api/admin/exam-generation/stuck-exams`)

```bash
GET /api/admin/exam-generation/stuck-exams?threshold=30

Response:
{
  "success": true,
  "data": {
    "stuck_exams": [...],
    "count": 2,
    "threshold_minutes": 30
  }
}
```

#### Force Complete (`/api/admin/exam-generation/force-complete`)

```bash
POST /api/admin/exam-generation/force-complete
{
  "exam_id": "exam-123",
  "reason": "Stuck for over 1 hour"
}

Response:
{
  "success": true,
  "data": {
    "success": true,
    "message": "Exam exam-123 force completed with 25 questions",
    "exam_id": "exam-123",
    "previous_status": "QUESTIONS_GENERATING",
    "questions_count": 25
  }
}
```

## Log Event Types

The system generates structured logs with the following event types:

### Exam Generation Events

- `exam_creation_started`
- `batch_generation_started`
- `batch_generation_completed`
- `exam_generation_completed`
- `exam_generation_failed`

### AI Service Events

- `ai_request_started`
- `ai_request_completed`

### Database Events

- `database_store_completed`

### Task Management Events

- `next_task_created`

### Monitoring Events

- `system_health_check`
- `queue_health`
- `error_rate_metrics`
- `cost_tracking`
- `idempotency_check`

### Alert Events

- `SLOW_BATCH_ALERT`
- `HIGH_MEMORY_ALERT`
- `HIGH_COST_ALERT`
- `BUDGET_EXCEEDED_ALERT`
- `STUCK_EXAMS_ALERT`

## Integration with Existing Code

The structured logging has been integrated into:

1. **Task Handler** (`delegators/tasks/take.ts`):

   - Batch start/completion logging
   - AI request/response tracking
   - Database operation monitoring
   - Memory usage tracking

2. **Exam Creation** (`endpoints/api/users/exams/createExam.ts`):
   - Exam creation start logging
   - Task creation failure tracking

## Monitoring Best Practices

### 1. Log Analysis

- Use structured query tools to analyze logs
- Set up dashboards for key metrics
- Monitor error rates and performance trends

### 2. Alerting

- Set up alerts for critical events
- Monitor queue health and processing rates
- Track cost and budget thresholds

### 3. Performance Optimization

- Use metrics to identify bottlenecks
- Monitor memory usage for leaks
- Track AI service performance

### 4. Troubleshooting

- Use exam_id to trace complete generation flow
- Check batch progression and failures
- Monitor system health during issues

## Example Log Output

```json
{
  "event": "batch_generation_started",
  "level": "INFO",
  "timestamp": "2025-01-13T10:30:00.000Z",
  "exam_id": "exam-123",
  "batch_number": 1,
  "total_batches": 5,
  "questions_to_generate": 10,
  "cert_id": 1,
  "batch_progress_percent": 20,
  "memory_usage": {
    "rss_mb": 45.67,
    "heap_used_mb": 23.45,
    "heap_total_mb": 31.25,
    "external_mb": 2.15
  }
}
```

```json
{
  "alert": "slow_batch_processing",
  "exam_id": "exam-123",
  "batch_number": 3,
  "duration_ms": 75000,
  "threshold_ms": 60000,
  "timestamp": "2025-01-13T10:35:00.000Z"
}
```

## Deployment

1. **Deploy the new services**: The logging services are automatically included when deploying Cloud Functions

2. **Set up scheduled functions**: The monitoring functions will be deployed as part of the Cloud Functions deployment

3. **Configure API endpoints**: Add the admin endpoints to your routing configuration

4. **Set up monitoring**: Configure your log analysis tools to process the structured logs

## Future Enhancements

- **Real-time Dashboards**: Build dashboards using the structured logs
- **Advanced Alerting**: Integrate with external alerting systems
- **Predictive Analytics**: Use metrics to predict system issues
- **Auto-scaling**: Use metrics to automatically scale resources
- **Cost Optimization**: Use cost tracking for budget management
