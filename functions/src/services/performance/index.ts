import logger from '../firebase/logger';

/**
 * Performance monitoring utilities for tracking database and cache operations
 * Helps measure the impact of optimizations
 */
export class PerformanceMonitor {
  private static startTimes = new Map<string, number>();

  /**
   * Start timing an operation
   * @param operationId - Unique identifier for the operation
   * @returns The operation ID for ending the timer
   */
  static startTimer(operationId: string): string {
    const startTime = Date.now();
    this.startTimes.set(operationId, startTime);
    return operationId;
  }

  /**
   * End timing and log the duration
   * @param operationId - The operation ID from startTimer
   * @param operation - Description of the operation
   * @param metadata - Additional metadata to log
   */
  static endTimer(
    operationId: string,
    operation: string,
    metadata?: Record<string, any>,
  ): number {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      logger.warn(`Timer not found for operation: ${operationId}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(operationId);

    const logData = {
      operation,
      duration_ms: duration,
      operation_id: operationId,
      ...metadata,
    };

    logger.info(
      `PERF_MONITOR: ${operation} completed in ${duration}ms`,
      logData,
    );

    return duration;
  }

  /**
   * Track database query performance
   * @param operation - Description of the database operation
   * @param duration - Duration in milliseconds
   * @param metadata - Additional query metadata
   */
  static trackDatabaseQuery(
    operation: string,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    const logData = {
      type: 'database_query',
      operation,
      duration_ms: duration,
      ...metadata,
    };

    logger.info(`DB_QUERY: ${operation} completed in ${duration}ms`, logData);

    // Alert on slow queries (configurable threshold)
    const slowQueryThreshold = 1000; // 1 second
    if (duration > slowQueryThreshold) {
      logger.warn(
        `SLOW_QUERY: ${operation} took ${duration}ms (threshold: ${slowQueryThreshold}ms)`,
        logData,
      );
    }
  }

  /**
   * Track batch operation performance
   * @param operation - Description of the batch operation
   * @param itemCount - Number of items processed in the batch
   * @param duration - Duration in milliseconds
   * @param metadata - Additional operation metadata
   */
  static trackBatchOperation(
    operation: string,
    itemCount: number,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    const avgTimePerItem = itemCount > 0 ? duration / itemCount : 0;

    const logData = {
      type: 'batch_operation',
      operation,
      item_count: itemCount,
      duration_ms: duration,
      avg_time_per_item_ms: Math.round(avgTimePerItem * 100) / 100,
      ...metadata,
    };

    logger.info(
      `BATCH_OP: ${operation} processed ${itemCount} items in ${duration}ms (${avgTimePerItem.toFixed(
        2,
      )}ms/item)`,
      logData,
    );

    // Alert on inefficient batch operations
    const inefficientThreshold = 50; // 50ms per item is considered slow
    if (avgTimePerItem > inefficientThreshold) {
      logger.warn(
        `SLOW_BATCH: ${operation} averaged ${avgTimePerItem.toFixed(
          2,
        )}ms per item (threshold: ${inefficientThreshold}ms)`,
        logData,
      );
    }
  }

  /**
   * Track cache operation performance
   * @param operation - Type of cache operation (GET, SET, DEL, MEMORY_HIT, REDIS_HIT, CACHE_MISS)
   * @param hit - Whether it was a cache hit or miss
   * @param duration - Duration in milliseconds
   * @param key - Cache key (optional, for debugging)
   */
  static trackCacheOperation(
    operation: string,
    hit: boolean,
    duration: number,
    key?: string,
  ): void {
    const logData = {
      type: 'cache_operation',
      operation,
      cache_result: hit ? 'HIT' : 'MISS',
      duration_ms: duration,
      ...(key && { cache_key: key.substring(0, 100) }), // Truncate long keys
    };

    // Different log levels based on cache performance
    if (operation === 'MEMORY_HIT') {
      logger.info(`MEMORY_CACHE_HIT: ${duration}ms`, logData);
    } else if (operation === 'REDIS_HIT') {
      logger.info(`REDIS_CACHE_HIT: ${duration}ms`, logData);
    } else if (operation === 'CACHE_MISS') {
      logger.info(`CACHE_MISS: ${duration}ms`, logData);
    } else {
      logger.info(
        `CACHE_${operation}: ${hit ? 'HIT' : 'MISS'} - ${duration}ms`,
        logData,
      );
    }

    // Alert on slow cache operations
    const slowCacheThreshold = 100; // 100ms
    if (duration > slowCacheThreshold) {
      logger.warn(
        `SLOW_CACHE: ${operation} took ${duration}ms (threshold: ${slowCacheThreshold}ms)`,
        logData,
      );
    }
  }

  /**
   * Track API endpoint response times
   * @param endpoint - The API endpoint
   * @param method - HTTP method
   * @param duration - Duration in milliseconds
   * @param statusCode - HTTP status code
   * @param metadata - Additional metadata
   */
  static trackApiResponse(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    metadata?: Record<string, any>,
  ): void {
    const logData = {
      type: 'api_response',
      endpoint,
      method,
      duration_ms: duration,
      status_code: statusCode,
      ...metadata,
    };

    logger.info(
      `API_RESPONSE: ${method} ${endpoint} - ${duration}ms (${statusCode})`,
      logData,
    );

    // Alert on slow API responses
    const slowApiThreshold = 2000; // 2 seconds
    if (duration > slowApiThreshold) {
      logger.warn(
        `SLOW_API: ${method} ${endpoint} took ${duration}ms (threshold: ${slowApiThreshold}ms)`,
        logData,
      );
    }
  }

  /**
   * Track rate limiting performance
   * @param userId - User ID (anonymized in logs)
   * @param duration - Duration of rate limit check
   * @param source - Source of rate limit check (redis/database)
   * @param result - Whether request was allowed
   */
  static trackRateLimitCheck(
    userId: string,
    duration: number,
    source: 'redis' | 'database',
    result: boolean,
  ): void {
    const logData = {
      type: 'rate_limit_check',
      user_id_hash: this.hashUserId(userId), // Anonymize user ID
      duration_ms: duration,
      source,
      allowed: result,
    };

    logger.info(
      `RATE_LIMIT: ${source} check - ${duration}ms (${
        result ? 'ALLOWED' : 'BLOCKED'
      })`,
      logData,
    );
  }

  /**
   * Generate performance summary for a time period
   * This would typically be called by a scheduled task
   */
  static generatePerformanceSummary(): void {
    // This is a placeholder for generating performance summaries
    // In a real implementation, you'd aggregate logs and generate reports
    logger.info('PERF_SUMMARY: Performance monitoring is active', {
      type: 'performance_summary',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Helper to create a performance wrapper for async functions
   * @param operation - Description of the operation
   * @param fn - The async function to wrap
   * @returns Wrapped function that tracks performance
   */
  static wrapAsync<T extends any[], R>(
    operation: string,
    fn: (...args: T) => Promise<R>,
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const operationId = `${operation}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      this.startTimer(operationId);

      try {
        const result = await fn(...args);
        this.endTimer(operationId, operation, { success: true });
        return result;
      } catch (error) {
        this.endTimer(operationId, operation, {
          success: false,
          error: (error as Error).message,
        });
        throw error;
      }
    };
  }

  /**
   * Anonymize user ID for logging (maintains privacy)
   * @param userId - User ID to hash
   * @returns Hashed user ID
   */
  private static hashUserId(userId: string): string {
    // Simple hash for anonymization - in production, use a proper hashing library
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash).toString(16)}`;
  }
}

export default PerformanceMonitor;
