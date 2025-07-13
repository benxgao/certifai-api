import logger from './firebase/logger';

/**
 * Structured logging service specifically for exam generation processes
 * Implements comprehensive metrics and alerts for Cloud Tasks exam generation
 */
export class ExamGenerationLogger {
  /**
   * Log exam generation start event
   */
  static logExamCreationStart(data: {
    exam_id: string;
    user_id: string;
    cert_id: number;
    certification_name: string;
    total_questions: number;
    total_batches: number;
    custom_prompt?: string;
  }): void {
    const logData = {
      event: 'exam_creation_started',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      user_id_hash: this.hashUserId(data.user_id),
      cert_id: data.cert_id,
      certification_name: data.certification_name,
      total_questions: data.total_questions,
      total_batches: data.total_batches,
      has_custom_prompt: !!data.custom_prompt,
      questions_per_batch: Math.ceil(data.total_questions / data.total_batches),
    };

    logger.info('EXAM_CREATION_STARTED', logData);
  }

  /**
   * Log batch processing start event with memory and timing metrics
   */
  static logBatchStart(data: {
    exam_id: string;
    batch_number: number;
    total_batches: number;
    questions_to_generate: number;
    cert_id: number;
  }): { start_time: number; initial_memory: NodeJS.MemoryUsage } {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    const logData = {
      event: 'batch_generation_started',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      total_batches: data.total_batches,
      questions_to_generate: data.questions_to_generate,
      cert_id: data.cert_id,
      batch_progress_percent: Math.round(
        (data.batch_number / data.total_batches) * 100,
      ),
      memory_usage: {
        rss_mb: Math.round((initialMemory.rss / 1024 / 1024) * 100) / 100,
        heap_used_mb:
          Math.round((initialMemory.heapUsed / 1024 / 1024) * 100) / 100,
        heap_total_mb:
          Math.round((initialMemory.heapTotal / 1024 / 1024) * 100) / 100,
        external_mb:
          Math.round((initialMemory.external / 1024 / 1024) * 100) / 100,
      },
    };

    logger.info('BATCH_GENERATION_STARTED', logData);

    return { start_time: startTime, initial_memory: initialMemory };
  }

  /**
   * Log AI service request with token usage tracking
   */
  static logAIRequest(data: {
    exam_id: string;
    batch_number: number;
    ai_service: string;
    prompt_tokens?: number;
    certification_name: string;
    questions_requested: number;
  }): void {
    const logData = {
      event: 'ai_request_started',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      ai_service: data.ai_service,
      prompt_tokens: data.prompt_tokens,
      certification_name: data.certification_name,
      questions_requested: data.questions_requested,
    };

    logger.info('AI_REQUEST_STARTED', logData);
  }

  /**
   * Log AI service response with success metrics and token usage
   */
  static logAIResponse(data: {
    exam_id: string;
    batch_number: number;
    ai_service: string;
    questions_generated: number;
    duration_ms: number;
    tokens_used?: number;
    estimated_cost?: number;
    success: boolean;
    error?: string;
  }): void {
    const logData = {
      event: 'ai_request_completed',
      level: data.success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      ai_service: data.ai_service,
      questions_generated: data.questions_generated,
      duration_ms: data.duration_ms,
      tokens_used: data.tokens_used,
      estimated_cost: data.estimated_cost,
      success: data.success,
      error: data.error,
      avg_time_per_question:
        data.questions_generated > 0
          ? Math.round(data.duration_ms / data.questions_generated)
          : null,
    };

    if (data.success) {
      logger.info('AI_REQUEST_SUCCESS', logData);
    } else {
      logger.error('AI_REQUEST_FAILED', logData);
    }

    // Alert on slow AI responses
    const slowAIThreshold = 30000; // 30 seconds
    if (data.duration_ms > slowAIThreshold) {
      logger.warn('SLOW_AI_RESPONSE', {
        ...logData,
        alert: 'slow_ai_response',
        threshold_ms: slowAIThreshold,
      });
    }
  }

  /**
   * Log database storage operation with performance metrics
   */
  static logDatabaseStore(data: {
    exam_id: string;
    batch_number: number;
    questions_stored: number;
    answer_options_stored: number;
    duration_ms: number;
    success: boolean;
    error?: string;
  }): void {
    const logData = {
      event: 'database_store_completed',
      level: data.success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      questions_stored: data.questions_stored,
      answer_options_stored: data.answer_options_stored,
      duration_ms: data.duration_ms,
      success: data.success,
      error: data.error,
      avg_time_per_question:
        data.questions_stored > 0
          ? Math.round(data.duration_ms / data.questions_stored)
          : null,
    };

    if (data.success) {
      logger.info('DATABASE_STORE_SUCCESS', logData);
    } else {
      logger.error('DATABASE_STORE_FAILED', logData);
    }

    // Alert on slow database operations
    const slowDBThreshold = 5000; // 5 seconds
    if (data.duration_ms > slowDBThreshold) {
      logger.warn('SLOW_DATABASE_OPERATION', {
        ...logData,
        alert: 'slow_database_operation',
        threshold_ms: slowDBThreshold,
      });
    }
  }

  /**
   * Log batch completion with comprehensive metrics
   */
  static logBatchComplete(data: {
    exam_id: string;
    batch_number: number;
    total_batches: number;
    questions_generated: number;
    questions_stored: number;
    start_time: number;
    initial_memory: NodeJS.MemoryUsage;
    success: boolean;
    error?: string;
  }): void {
    const endTime = Date.now();
    const finalMemory = process.memoryUsage();
    const duration = endTime - data.start_time;

    const logData = {
      event: 'batch_generation_completed',
      level: data.success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      total_batches: data.total_batches,
      questions_generated: data.questions_generated,
      questions_stored: data.questions_stored,
      duration_ms: duration,
      success: data.success,
      error: data.error,
      batch_progress_percent: Math.round(
        (data.batch_number / data.total_batches) * 100,
      ),
      memory_delta: {
        rss_mb:
          Math.round(
            ((finalMemory.rss - data.initial_memory.rss) / 1024 / 1024) * 100,
          ) / 100,
        heap_used_mb:
          Math.round(
            ((finalMemory.heapUsed - data.initial_memory.heapUsed) /
              1024 /
              1024) *
              100,
          ) / 100,
      },
      final_memory: {
        rss_mb: Math.round((finalMemory.rss / 1024 / 1024) * 100) / 100,
        heap_used_mb:
          Math.round((finalMemory.heapUsed / 1024 / 1024) * 100) / 100,
      },
    };

    if (data.success) {
      logger.info('BATCH_GENERATION_SUCCESS', logData);
    } else {
      logger.error('BATCH_GENERATION_FAILED', logData);
    }

    // Memory leak detection
    const memoryLeakThreshold = 100; // 100MB increase
    if (logData.memory_delta.heap_used_mb > memoryLeakThreshold) {
      logger.warn('POTENTIAL_MEMORY_LEAK', {
        ...logData,
        alert: 'potential_memory_leak',
        threshold_mb: memoryLeakThreshold,
      });
    }
  }

  /**
   * Log task creation for next batch
   */
  static logTaskCreation(data: {
    exam_id: string;
    current_batch: number;
    next_batch: number;
    total_batches: number;
    questions_for_next_batch: number;
    task_name?: string;
    success: boolean;
    error?: string;
  }): void {
    const logData = {
      event: 'next_task_created',
      level: data.success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      current_batch: data.current_batch,
      next_batch: data.next_batch,
      total_batches: data.total_batches,
      questions_for_next_batch: data.questions_for_next_batch,
      task_name: data.task_name,
      success: data.success,
      error: data.error,
      remaining_batches: data.total_batches - data.current_batch,
    };

    if (data.success) {
      logger.info('NEXT_TASK_CREATED', logData);
    } else {
      logger.error('TASK_CREATION_FAILED', logData);
    }
  }

  /**
   * Log exam completion
   */
  static logExamComplete(data: {
    exam_id: string;
    total_questions_generated: number;
    total_questions_associated: number;
    total_batches: number;
    total_duration_ms?: number;
    status: string;
  }): void {
    const logData = {
      event: 'exam_generation_completed',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      total_questions_generated: data.total_questions_generated,
      total_questions_associated: data.total_questions_associated,
      total_batches: data.total_batches,
      total_duration_ms: data.total_duration_ms,
      status: data.status,
      success_rate:
        data.total_questions_generated > 0
          ? Math.round(
              (data.total_questions_associated /
                data.total_questions_generated) *
                100,
            )
          : 0,
    };

    logger.info('EXAM_GENERATION_COMPLETED', logData);
  }

  /**
   * Log exam generation failure
   */
  static logExamFailure(data: {
    exam_id: string;
    batch_number?: number;
    total_batches?: number;
    reason: string;
    error: string;
    questions_generated_so_far?: number;
  }): void {
    const logData = {
      event: 'exam_generation_failed',
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      total_batches: data.total_batches,
      reason: data.reason,
      error: data.error,
      questions_generated_so_far: data.questions_generated_so_far,
      completion_rate:
        data.batch_number && data.total_batches
          ? Math.round((data.batch_number / data.total_batches) * 100)
          : 0,
    };

    logger.error('EXAM_GENERATION_FAILED', logData);
  }

  /**
   * Log cost tracking information
   */
  static logCostTracking(data: {
    exam_id: string;
    batch_number: number;
    tokens_used: number;
    estimated_cost: number;
    cumulative_cost?: number;
    ai_provider: string;
  }): void {
    const logData = {
      event: 'cost_tracking',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      tokens_used: data.tokens_used,
      estimated_cost: data.estimated_cost,
      cumulative_cost: data.cumulative_cost,
      ai_provider: data.ai_provider,
    };

    logger.info('COST_TRACKING', logData);

    // Budget alert
    const budgetThreshold = 10.0; // $10 per exam
    if (data.cumulative_cost && data.cumulative_cost > budgetThreshold) {
      logger.warn('BUDGET_EXCEEDED', {
        ...logData,
        alert: 'budget_exceeded',
        threshold: budgetThreshold,
      });
    }
  }

  /**
   * Log queue health metrics
   */
  static logQueueHealth(data: {
    queue_name: string;
    pending_tasks: number;
    rate_limit: string;
    max_concurrent: number;
    current_concurrent?: number;
  }): void {
    const logData = {
      event: 'queue_health_check',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      queue_name: data.queue_name,
      pending_tasks: data.pending_tasks,
      rate_limit: data.rate_limit,
      max_concurrent: data.max_concurrent,
      current_concurrent: data.current_concurrent,
    };

    logger.info('QUEUE_HEALTH', logData);

    // Queue backlog alert
    const backlogThreshold = 50;
    if (data.pending_tasks > backlogThreshold) {
      logger.warn('QUEUE_BACKLOG_HIGH', {
        ...logData,
        alert: 'queue_backlog_high',
        threshold: backlogThreshold,
      });
    }
  }

  /**
   * Log error rate metrics for alerts
   */
  static logErrorRate(data: {
    time_window_minutes: number;
    total_operations: number;
    failed_operations: number;
    error_rate_percent: number;
    operation_type: string;
  }): void {
    const logData = {
      event: 'error_rate_metrics',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      time_window_minutes: data.time_window_minutes,
      total_operations: data.total_operations,
      failed_operations: data.failed_operations,
      error_rate_percent: data.error_rate_percent,
      operation_type: data.operation_type,
    };

    logger.info('ERROR_RATE_METRICS', logData);

    // Error rate alert
    const errorRateThreshold = 10; // 10%
    if (data.error_rate_percent > errorRateThreshold) {
      logger.warn('HIGH_ERROR_RATE', {
        ...logData,
        alert: 'high_error_rate',
        threshold_percent: errorRateThreshold,
      });
    }
  }

  /**
   * Log system health check results
   */
  static logSystemHealth(data: {
    queue_status: string;
    database_status: string;
    ai_service_status: string;
    active_generations: number;
    error_rate_percent: number;
  }): void {
    const logData = {
      event: 'system_health_check',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      queue_status: data.queue_status,
      database_status: data.database_status,
      ai_service_status: data.ai_service_status,
      active_generations: data.active_generations,
      error_rate_percent: data.error_rate_percent,
      overall_status: this.calculateOverallHealth(data),
    };

    logger.info('SYSTEM_HEALTH', logData);
  }

  /**
   * Log idempotency checks
   */
  static logIdempotencyCheck(data: {
    exam_id: string;
    batch_number: number;
    already_completed: boolean;
    action_taken: string;
  }): void {
    const logData = {
      event: 'idempotency_check',
      level: 'INFO',
      timestamp: new Date().toISOString(),
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      already_completed: data.already_completed,
      action_taken: data.action_taken,
    };

    logger.info('IDEMPOTENCY_CHECK', logData);
  }

  /**
   * Helper to calculate overall system health
   */
  private static calculateOverallHealth(data: {
    queue_status: string;
    database_status: string;
    ai_service_status: string;
    error_rate_percent: number;
  }): string {
    const services = [
      data.queue_status,
      data.database_status,
      data.ai_service_status,
    ];
    const healthyServices = services.filter(
      (status) => status === 'healthy',
    ).length;

    if (healthyServices === 3 && data.error_rate_percent < 5) {
      return 'healthy';
    } else if (healthyServices >= 2 && data.error_rate_percent < 20) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * Anonymize user ID for logging privacy
   */
  private static hashUserId(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `user_${Math.abs(hash).toString(16)}`;
  }
}

export default ExamGenerationLogger;
