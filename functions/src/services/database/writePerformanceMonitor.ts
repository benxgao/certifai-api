import logger from '../firebase/logger';

/**
 * High-performance monitoring utility specifically for write operations
 */
export class WritePerformanceMonitor {
  private static activeOperations = new Map<string, number>();
  private static operationMetrics = new Map<string, OperationMetrics>();

  /**
   * Track write operation performance with minimal overhead
   */
  static trackWriteOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata: Record<string, any> = {},
  ): Promise<T> {
    const operationId = `${operationName}_${Date.now()}_${Math.random()}`;
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Track active operations for concurrency monitoring
    this.activeOperations.set(operationId, startTime);

    return operation()
      .then((result) => {
        const duration = performance.now() - startTime;
        const endMemory = process.memoryUsage().heapUsed;
        const memoryDelta = (endMemory - startMemory) / 1024 / 1024; // MB

        this.recordMetrics(operationName, duration, true, memoryDelta);
        this.activeOperations.delete(operationId);

        // Log only if duration is significant (>100ms) to reduce logging overhead
        if (duration > 100) {
          logger.info(`WRITE_PERF: ${operationName}`, {
            operation: operationName,
            duration_ms: Math.round(duration),
            memory_delta_mb: Math.round(memoryDelta * 100) / 100,
            success: true,
            active_operations: this.activeOperations.size,
            ...metadata,
            structuredData: true,
          });
        }

        return result;
      })
      .catch((error) => {
        const duration = performance.now() - startTime;
        const endMemory = process.memoryUsage().heapUsed;
        const memoryDelta = (endMemory - startMemory) / 1024 / 1024; // MB

        this.recordMetrics(operationName, duration, false, memoryDelta);
        this.activeOperations.delete(operationId);

        logger.error(`WRITE_PERF_ERROR: ${operationName}`, {
          operation: operationName,
          duration_ms: Math.round(duration),
          memory_delta_mb: Math.round(memoryDelta * 100) / 100,
          success: false,
          error: error.message,
          active_operations: this.activeOperations.size,
          ...metadata,
          structuredData: true,
        });

        throw error;
      });
  }

  /**
   * Track batch operation performance
   */
  static trackBatchWrite<T>(
    operationName: string,
    itemCount: number,
    operation: () => Promise<T>,
    metadata: Record<string, any> = {},
  ): Promise<T> {
    return this.trackWriteOperation(`batch_${operationName}`, operation, {
      item_count: itemCount,
      items_per_batch: itemCount,
      ...metadata,
    });
  }

  /**
   * Record metrics for performance analysis
   */
  private static recordMetrics(
    operationName: string,
    duration: number,
    success: boolean,
    memoryDelta: number,
  ): void {
    const key = operationName;
    const existing = this.operationMetrics.get(key) || {
      operation: operationName,
      totalOperations: 0,
      successfulOperations: 0,
      totalDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      totalMemoryDelta: 0,
      timeSlot: this.getCurrentTimeSlot(),
    };

    existing.totalOperations++;
    if (success) existing.successfulOperations++;
    existing.totalDuration += duration;
    existing.maxDuration = Math.max(existing.maxDuration, duration);
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.totalMemoryDelta += memoryDelta;

    this.operationMetrics.set(key, existing);

    // Log performance summary every 50 operations to reduce overhead
    if (existing.totalOperations % 50 === 0) {
      this.logPerformanceSummary(existing);
    }
  }

  /**
   * Log performance summary
   */
  private static logPerformanceSummary(metrics: OperationMetrics): void {
    const avgDuration = metrics.totalDuration / metrics.totalOperations;
    const successRate =
      (metrics.successfulOperations / metrics.totalOperations) * 100;
    const avgMemoryDelta = metrics.totalMemoryDelta / metrics.totalOperations;

    logger.info(`WRITE_PERF_SUMMARY: ${metrics.operation}`, {
      operation: metrics.operation,
      total_operations: metrics.totalOperations,
      success_rate_percent: Math.round(successRate * 100) / 100,
      avg_duration_ms: Math.round(avgDuration * 100) / 100,
      max_duration_ms: Math.round(metrics.maxDuration * 100) / 100,
      min_duration_ms: Math.round(metrics.minDuration * 100) / 100,
      avg_memory_delta_mb: Math.round(avgMemoryDelta * 100) / 100,
      operations_per_second: Math.round(1000 / avgDuration),
      time_slot: metrics.timeSlot,
      active_operations: this.activeOperations.size,
      structuredData: true,
    });
  }

  /**
   * Get current time slot for metrics grouping
   */
  private static getCurrentTimeSlot(): string {
    const now = new Date();
    const minutes = Math.floor(now.getMinutes() / 5) * 5; // 5-minute slots
    return `${now.getHours()}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Get current performance metrics
   */
  static getMetrics(): Record<string, OperationMetrics> {
    const result: Record<string, OperationMetrics> = {};
    this.operationMetrics.forEach((metrics, key) => {
      result[key] = { ...metrics };
    });
    return result;
  }

  /**
   * Clear metrics (useful for testing or periodic cleanup)
   */
  static clearMetrics(): void {
    this.operationMetrics.clear();
    this.activeOperations.clear();
  }

  /**
   * Check if system is under high write load
   */
  static isUnderHighLoad(): boolean {
    return this.activeOperations.size > 20; // More than 20 concurrent write operations
  }

  /**
   * Get active operations count
   */
  static getActiveOperationsCount(): number {
    return this.activeOperations.size;
  }
}

interface OperationMetrics {
  operation: string;
  totalOperations: number;
  successfulOperations: number;
  totalDuration: number;
  maxDuration: number;
  minDuration: number;
  totalMemoryDelta: number;
  timeSlot: string;
}
