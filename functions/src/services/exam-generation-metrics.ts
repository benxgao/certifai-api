import logger from './firebase/logger';
import { ExamGenerationLogger } from './exam-generation-logger';

/**
 * Metrics collection and alerting service for exam generation
 * Tracks success rates, performance metrics, and generates alerts
 */
export class ExamGenerationMetrics {
  private static readonly METRICS_WINDOW_MINUTES = 15;
  private static readonly ERROR_RATE_THRESHOLD = 10; // 10%
  private static readonly SLOW_BATCH_THRESHOLD = 60000; // 60 seconds
  private static readonly MEMORY_LEAK_THRESHOLD = 100; // 100MB
  private static readonly BUDGET_THRESHOLD = 10.0; // $10 per exam

  // In-memory metrics storage (in production, use Redis or database)
  private static metrics = {
    batchOperations: [] as Array<{
      timestamp: number;
      exam_id: string;
      batch_number: number;
      success: boolean;
      duration_ms: number;
      memory_used_mb: number;
      cost: number;
    }>,
    examOperations: [] as Array<{
      timestamp: number;
      exam_id: string;
      success: boolean;
      total_duration_ms: number;
      total_cost: number;
      questions_generated: number;
    }>,
    aiServiceCalls: [] as Array<{
      timestamp: number;
      exam_id: string;
      batch_number: number;
      success: boolean;
      duration_ms: number;
      tokens_used: number;
      cost: number;
    }>,
  };

  /**
   * Record batch operation metrics
   */
  static recordBatchOperation(data: {
    exam_id: string;
    batch_number: number;
    success: boolean;
    duration_ms: number;
    memory_used_mb: number;
    cost?: number;
  }): void {
    const timestamp = Date.now();

    this.metrics.batchOperations.push({
      timestamp,
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      success: data.success,
      duration_ms: data.duration_ms,
      memory_used_mb: data.memory_used_mb,
      cost: data.cost || 0,
    });

    // Clean old metrics (keep only last 24 hours)
    this.cleanOldMetrics();

    // Check for alerts
    this.checkBatchAlerts(data);
  }

  /**
   * Record exam completion metrics
   */
  static recordExamOperation(data: {
    exam_id: string;
    success: boolean;
    total_duration_ms: number;
    total_cost: number;
    questions_generated: number;
  }): void {
    const timestamp = Date.now();

    this.metrics.examOperations.push({
      timestamp,
      exam_id: data.exam_id,
      success: data.success,
      total_duration_ms: data.total_duration_ms,
      total_cost: data.total_cost,
      questions_generated: data.questions_generated,
    });

    this.cleanOldMetrics();
    this.checkExamAlerts(data);
  }

  /**
   * Record AI service call metrics
   */
  static recordAIServiceCall(data: {
    exam_id: string;
    batch_number: number;
    success: boolean;
    duration_ms: number;
    tokens_used: number;
    cost: number;
  }): void {
    const timestamp = Date.now();

    this.metrics.aiServiceCalls.push({
      timestamp,
      exam_id: data.exam_id,
      batch_number: data.batch_number,
      success: data.success,
      duration_ms: data.duration_ms,
      tokens_used: data.tokens_used,
      cost: data.cost,
    });

    this.cleanOldMetrics();
    this.checkAIServiceAlerts(data);
  }

  /**
   * Calculate success rate for a time window
   */
  static calculateSuccessRate(
    timeWindowMinutes: number = this.METRICS_WINDOW_MINUTES,
    operationType: 'batch' | 'exam' | 'ai' = 'batch',
  ): { total: number; successful: number; rate: number } {
    const cutoffTime = Date.now() - timeWindowMinutes * 60 * 1000;
    let operations: Array<{ success: boolean }>;

    switch (operationType) {
      case 'batch':
        operations = this.metrics.batchOperations.filter(
          (op) => op.timestamp > cutoffTime,
        );
        break;
      case 'exam':
        operations = this.metrics.examOperations.filter(
          (op) => op.timestamp > cutoffTime,
        );
        break;
      case 'ai':
        operations = this.metrics.aiServiceCalls.filter(
          (op) => op.timestamp > cutoffTime,
        );
        break;
    }

    const total = operations.length;
    const successful = operations.filter((op) => op.success).length;
    const rate = total > 0 ? Math.round((successful / total) * 100) : 100;

    return { total, successful, rate };
  }

  /**
   * Calculate average performance metrics
   */
  static calculatePerformanceMetrics(
    timeWindowMinutes: number = this.METRICS_WINDOW_MINUTES,
  ): {
    avgBatchDuration: number;
    avgMemoryUsage: number;
    avgCostPerBatch: number;
    avgTokensPerBatch: number;
  } {
    const cutoffTime = Date.now() - timeWindowMinutes * 60 * 1000;

    const recentBatches = this.metrics.batchOperations.filter(
      (op) => op.timestamp > cutoffTime && op.success,
    );

    const recentAICalls = this.metrics.aiServiceCalls.filter(
      (op) => op.timestamp > cutoffTime && op.success,
    );

    const avgBatchDuration =
      recentBatches.length > 0
        ? Math.round(
            recentBatches.reduce((sum, op) => sum + op.duration_ms, 0) /
              recentBatches.length,
          )
        : 0;

    const avgMemoryUsage =
      recentBatches.length > 0
        ? Math.round(
            (recentBatches.reduce((sum, op) => sum + op.memory_used_mb, 0) /
              recentBatches.length) *
              100,
          ) / 100
        : 0;

    const avgCostPerBatch =
      recentBatches.length > 0
        ? Math.round(
            (recentBatches.reduce((sum, op) => sum + op.cost, 0) /
              recentBatches.length) *
              100,
          ) / 100
        : 0;

    const avgTokensPerBatch =
      recentAICalls.length > 0
        ? Math.round(
            recentAICalls.reduce((sum, op) => sum + op.tokens_used, 0) /
              recentAICalls.length,
          )
        : 0;

    return {
      avgBatchDuration,
      avgMemoryUsage,
      avgCostPerBatch,
      avgTokensPerBatch,
    };
  }

  /**
   * Generate comprehensive metrics report
   */
  static generateMetricsReport(timeWindowMinutes: number = 60): {
    timestamp: string;
    timeWindow: number;
    batchMetrics: any;
    examMetrics: any;
    aiServiceMetrics: any;
    performanceMetrics: any;
    activeAlerts: string[];
  } {
    const batchMetrics = this.calculateSuccessRate(timeWindowMinutes, 'batch');
    const examMetrics = this.calculateSuccessRate(timeWindowMinutes, 'exam');
    const aiServiceMetrics = this.calculateSuccessRate(timeWindowMinutes, 'ai');
    const performanceMetrics =
      this.calculatePerformanceMetrics(timeWindowMinutes);

    const report = {
      timestamp: new Date().toISOString(),
      timeWindow: timeWindowMinutes,
      batchMetrics: {
        ...batchMetrics,
        errorRate: 100 - batchMetrics.rate,
      },
      examMetrics: {
        ...examMetrics,
        errorRate: 100 - examMetrics.rate,
      },
      aiServiceMetrics: {
        ...aiServiceMetrics,
        errorRate: 100 - aiServiceMetrics.rate,
      },
      performanceMetrics,
      activeAlerts: this.getActiveAlerts(),
    };

    // Log the metrics report
    ExamGenerationLogger.logErrorRate({
      time_window_minutes: timeWindowMinutes,
      total_operations: batchMetrics.total,
      failed_operations: batchMetrics.total - batchMetrics.successful,
      error_rate_percent: 100 - batchMetrics.rate,
      operation_type: 'batch_generation',
    });

    logger.info('METRICS_REPORT', report);

    return report;
  }

  /**
   * Get currently active alerts
   */
  static getActiveAlerts(): string[] {
    const alerts: string[] = [];
    const recentMetrics = this.calculateSuccessRate(
      this.METRICS_WINDOW_MINUTES,
    );
    const performanceMetrics = this.calculatePerformanceMetrics(
      this.METRICS_WINDOW_MINUTES,
    );

    // Error rate alert
    if (100 - recentMetrics.rate > this.ERROR_RATE_THRESHOLD) {
      alerts.push(
        `High error rate: ${100 - recentMetrics.rate}% (threshold: ${
          this.ERROR_RATE_THRESHOLD
        }%)`,
      );
    }

    // Performance alerts
    if (performanceMetrics.avgBatchDuration > this.SLOW_BATCH_THRESHOLD) {
      alerts.push(
        `Slow batch processing: ${performanceMetrics.avgBatchDuration}ms (threshold: ${this.SLOW_BATCH_THRESHOLD}ms)`,
      );
    }

    if (performanceMetrics.avgMemoryUsage > this.MEMORY_LEAK_THRESHOLD) {
      alerts.push(
        `High memory usage: ${performanceMetrics.avgMemoryUsage}MB (threshold: ${this.MEMORY_LEAK_THRESHOLD}MB)`,
      );
    }

    if (performanceMetrics.avgCostPerBatch > this.BUDGET_THRESHOLD / 5) {
      // Alert at 20% of budget per batch
      alerts.push(
        `High cost per batch: $${
          performanceMetrics.avgCostPerBatch
        } (threshold: $${this.BUDGET_THRESHOLD / 5})`,
      );
    }

    return alerts;
  }

  /**
   * Check for batch-specific alerts
   */
  private static checkBatchAlerts(data: {
    exam_id: string;
    batch_number: number;
    success: boolean;
    duration_ms: number;
    memory_used_mb: number;
    cost?: number;
  }): void {
    // Slow batch alert
    if (data.duration_ms > this.SLOW_BATCH_THRESHOLD) {
      logger.warn('SLOW_BATCH_ALERT', {
        alert: 'slow_batch_processing',
        exam_id: data.exam_id,
        batch_number: data.batch_number,
        duration_ms: data.duration_ms,
        threshold_ms: this.SLOW_BATCH_THRESHOLD,
        timestamp: new Date().toISOString(),
      });
    }

    // High memory usage alert
    if (data.memory_used_mb > this.MEMORY_LEAK_THRESHOLD) {
      logger.warn('HIGH_MEMORY_ALERT', {
        alert: 'high_memory_usage',
        exam_id: data.exam_id,
        batch_number: data.batch_number,
        memory_used_mb: data.memory_used_mb,
        threshold_mb: this.MEMORY_LEAK_THRESHOLD,
        timestamp: new Date().toISOString(),
      });
    }

    // Cost alert
    if (data.cost && data.cost > this.BUDGET_THRESHOLD / 5) {
      logger.warn('HIGH_COST_ALERT', {
        alert: 'high_batch_cost',
        exam_id: data.exam_id,
        batch_number: data.batch_number,
        cost: data.cost,
        threshold: this.BUDGET_THRESHOLD / 5,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Check for exam-specific alerts
   */
  private static checkExamAlerts(data: {
    exam_id: string;
    success: boolean;
    total_duration_ms: number;
    total_cost: number;
    questions_generated: number;
  }): void {
    // Budget exceeded alert
    if (data.total_cost > this.BUDGET_THRESHOLD) {
      logger.warn('BUDGET_EXCEEDED_ALERT', {
        alert: 'budget_exceeded',
        exam_id: data.exam_id,
        total_cost: data.total_cost,
        threshold: this.BUDGET_THRESHOLD,
        timestamp: new Date().toISOString(),
      });
    }

    // Very long exam generation
    const examTimeThreshold = 20 * 60 * 1000; // 20 minutes
    if (data.total_duration_ms > examTimeThreshold) {
      logger.warn('LONG_EXAM_GENERATION_ALERT', {
        alert: 'long_exam_generation',
        exam_id: data.exam_id,
        total_duration_ms: data.total_duration_ms,
        threshold_ms: examTimeThreshold,
        timestamp: new Date().toISOString(),
      });
    }

    // Low question generation rate
    const expectedQuestionsPerMinute = 2;
    const actualRate =
      data.questions_generated / (data.total_duration_ms / 60000);
    if (actualRate < expectedQuestionsPerMinute) {
      logger.warn('LOW_GENERATION_RATE_ALERT', {
        alert: 'low_question_generation_rate',
        exam_id: data.exam_id,
        actual_rate_per_minute: Math.round(actualRate * 100) / 100,
        expected_rate_per_minute: expectedQuestionsPerMinute,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Check for AI service-specific alerts
   */
  private static checkAIServiceAlerts(data: {
    exam_id: string;
    batch_number: number;
    success: boolean;
    duration_ms: number;
    tokens_used: number;
    cost: number;
  }): void {
    // Slow AI response
    const slowAIThreshold = 30000; // 30 seconds
    if (data.duration_ms > slowAIThreshold) {
      logger.warn('SLOW_AI_RESPONSE_ALERT', {
        alert: 'slow_ai_response',
        exam_id: data.exam_id,
        batch_number: data.batch_number,
        duration_ms: data.duration_ms,
        threshold_ms: slowAIThreshold,
        timestamp: new Date().toISOString(),
      });
    }

    // High token usage
    const highTokenThreshold = 5000; // 5000 tokens per batch
    if (data.tokens_used > highTokenThreshold) {
      logger.warn('HIGH_TOKEN_USAGE_ALERT', {
        alert: 'high_token_usage',
        exam_id: data.exam_id,
        batch_number: data.batch_number,
        tokens_used: data.tokens_used,
        threshold: highTokenThreshold,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Clean old metrics to prevent memory buildup
   */
  private static cleanOldMetrics(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    this.metrics.batchOperations = this.metrics.batchOperations.filter(
      (op) => op.timestamp > cutoffTime,
    );
    this.metrics.examOperations = this.metrics.examOperations.filter(
      (op) => op.timestamp > cutoffTime,
    );
    this.metrics.aiServiceCalls = this.metrics.aiServiceCalls.filter(
      (op) => op.timestamp > cutoffTime,
    );
  }

  /**
   * Manual trigger for metrics collection (for scheduled tasks)
   */
  static collectMetrics(): void {
    this.generateMetricsReport(60); // Last hour - report is logged internally

    // Log system health
    ExamGenerationLogger.logSystemHealth({
      queue_status: this.calculateQueueHealth(),
      database_status: this.calculateDatabaseHealth(),
      ai_service_status: this.calculateAIServiceHealth(),
      active_generations: this.getActiveGenerationsCount(),
      error_rate_percent:
        100 - this.calculateSuccessRate(this.METRICS_WINDOW_MINUTES).rate,
    });
  }

  /**
   * Calculate queue health status
   */
  private static calculateQueueHealth(): string {
    const recentMetrics = this.calculateSuccessRate(
      this.METRICS_WINDOW_MINUTES,
    );
    return recentMetrics.rate > 90
      ? 'healthy'
      : recentMetrics.rate > 70
      ? 'degraded'
      : 'unhealthy';
  }

  /**
   * Calculate database health status
   */
  private static calculateDatabaseHealth(): string {
    // This would typically check database connection pool, query times, etc.
    const performanceMetrics = this.calculatePerformanceMetrics(
      this.METRICS_WINDOW_MINUTES,
    );
    return performanceMetrics.avgBatchDuration < 10000 ? 'healthy' : 'degraded';
  }

  /**
   * Calculate AI service health status
   */
  private static calculateAIServiceHealth(): string {
    const aiMetrics = this.calculateSuccessRate(
      this.METRICS_WINDOW_MINUTES,
      'ai',
    );
    return aiMetrics.rate > 95
      ? 'healthy'
      : aiMetrics.rate > 80
      ? 'degraded'
      : 'unhealthy';
  }

  /**
   * Get count of currently active exam generations
   */
  private static getActiveGenerationsCount(): number {
    const last10Minutes = Date.now() - 10 * 60 * 1000;
    const recentBatches = this.metrics.batchOperations.filter(
      (op) => op.timestamp > last10Minutes,
    );

    // Count unique exam IDs in recent batches
    const uniqueExams = new Set(recentBatches.map((op) => op.exam_id));
    return uniqueExams.size;
  }
}

export default ExamGenerationMetrics;
