import logger from '../firebase/logger';
import { RedisService } from '../redis';
import { CacheHierarchyService } from '../cache/cacheHierarchy';

/**
 * Advanced Monitoring and Alerting Service
 * Provides comprehensive performance monitoring, alerting, and operational insights
 */
export class AdvancedMonitoringService {
  private static readonly ALERT_THRESHOLDS = {
    slowQuery: 1000, // 1 second
    slowCache: 100, // 100ms
    slowApi: 2000, // 2 seconds
    lowCacheHitRate: 0.7, // 70%
    highErrorRate: 0.01, // 1%
    highMemoryUsage: 0.8, // 80%
    highDatabaseConnections: 0.8, // 80%
  };

  private static readonly METRICS_WINDOW = 300; // 5 minutes
  private static metricsBuffer = new Map<string, MetricEntry[]>();
  private static alertCooldowns = new Map<string, number>();

  /**
   * Initialize monitoring system
   */
  static initialize(): void {
    // Start periodic monitoring
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds

    // Start periodic alerting checks
    setInterval(() => {
      this.checkAlertConditions();
    }, 60000); // Every minute

    // Cleanup old metrics
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Every 5 minutes

    logger.info('Advanced monitoring system initialized');
  }

  /**
   * Record performance metric
   */
  static recordMetric(
    metricName: string,
    value: number,
    metadata?: Record<string, unknown>,
  ): void {
    const timestamp = Date.now();
    const entry: MetricEntry = {
      value,
      timestamp,
      metadata: metadata || {},
    };

    if (!this.metricsBuffer.has(metricName)) {
      this.metricsBuffer.set(metricName, []);
    }

    const metrics = this.metricsBuffer.get(metricName)!;
    metrics.push(entry);

    // Keep only recent metrics
    const cutoff = timestamp - this.METRICS_WINDOW * 1000;
    this.metricsBuffer.set(
      metricName,
      metrics.filter((m) => m.timestamp > cutoff),
    );
  }

  /**
   * Get performance summary
   */
  static getPerformanceSummary(): PerformanceSummary {
    const summary: PerformanceSummary = {
      timestamp: new Date().toISOString(),
      database: this.getDatabaseMetrics(),
      cache: this.getCacheMetrics(),
      api: this.getApiMetrics(),
      system: this.getSystemMetrics(),
      alerts: this.getActiveAlerts(),
    };

    return summary;
  }

  /**
   * Generate performance report
   */
  static generatePerformanceReport(): PerformanceReport {
    const summary = this.getPerformanceSummary();
    const cacheStats = CacheHierarchyService.getCacheStats();

    const report: PerformanceReport = {
      ...summary,
      recommendations: this.generateRecommendations(summary),
      cacheHierarchy: {
        memoryCache: cacheStats.memory,
        promotionCandidates: cacheStats.promotionCandidates,
        demotionCandidates: cacheStats.demotionCandidates,
      },
      optimizationOpportunities:
        this.identifyOptimizationOpportunities(summary),
    };

    logger.info('Performance report generated', {
      alert_count: report.alerts.length,
      recommendation_count: report.recommendations.length,
    });

    return report;
  }

  /**
   * Check for alert conditions
   */
  static async checkAlertConditions(): Promise<void> {
    try {
      // Check database performance
      await this.checkDatabaseAlerts();

      // Check cache performance
      await this.checkCacheAlerts();

      // Check API performance
      await this.checkApiAlerts();

      // Check system health
      await this.checkSystemAlerts();
    } catch (error) {
      logger.error('Error checking alert conditions:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send alert if not in cooldown
   */
  static sendAlert(
    alertType: string,
    message: string,
    severity: AlertSeverity,
    metadata?: Record<string, unknown>,
  ): void {
    const cooldownKey = `${alertType}_${severity}`;
    const now = Date.now();
    const lastAlert = this.alertCooldowns.get(cooldownKey) || 0;
    const cooldownPeriod = this.getCooldownPeriod(severity);

    if (now - lastAlert < cooldownPeriod) {
      return; // Still in cooldown
    }

    this.alertCooldowns.set(cooldownKey, now);

    // Log alert
    const logLevel =
      severity === 'critical'
        ? 'error'
        : severity === 'warning'
        ? 'warn'
        : 'info';
    logger[logLevel](`ALERT [${severity.toUpperCase()}]: ${message}`, metadata);

    // Store alert for reporting (in a real implementation, you'd persist this)
    // For now, we just log it
  }

  /**
   * Track slow operation
   */
  static trackSlowOperation(
    operationType: string,
    operation: string,
    duration: number,
    threshold: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (duration > threshold) {
      this.sendAlert(
        'slow_operation',
        `Slow ${operationType}: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
        duration > threshold * 2 ? 'critical' : 'warning',
        {
          operation_type: operationType,
          operation,
          duration,
          threshold,
          ...metadata,
        },
      );
    }

    this.recordMetric(`${operationType}_duration`, duration, {
      operation,
      ...metadata,
    });
  }

  /**
   * Track error rate
   */
  static trackErrorRate(
    operation: string,
    isError: boolean,
    metadata?: Record<string, unknown>,
  ): void {
    this.recordMetric(`${operation}_result`, isError ? 1 : 0, metadata);

    // Check error rate
    const errorMetrics = this.metricsBuffer.get(`${operation}_result`) || [];
    if (errorMetrics.length >= 10) {
      // Minimum sample size
      const errorRate =
        errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length;

      if (errorRate > this.ALERT_THRESHOLDS.highErrorRate) {
        this.sendAlert(
          'high_error_rate',
          `High error rate for ${operation}: ${(errorRate * 100).toFixed(2)}%`,
          errorRate > this.ALERT_THRESHOLDS.highErrorRate * 2
            ? 'critical'
            : 'warning',
          {
            operation,
            error_rate: errorRate,
            sample_size: errorMetrics.length,
          },
        );
      }
    }
  }

  /**
   * Collect system metrics
   */
  private static async collectSystemMetrics(): Promise<void> {
    try {
      // Collect cache metrics
      const cacheStats = CacheHierarchyService.getCacheStats();
      this.recordMetric(
        'cache_memory_usage',
        cacheStats.memory.size / cacheStats.memory.maxSize,
      );
      this.recordMetric('cache_hit_rate', cacheStats.memory.hitRate);

      // Test Redis connectivity
      const redisHealthy = await RedisService.ping();
      this.recordMetric('redis_health', redisHealthy ? 1 : 0);

      // Record timestamp for system health
      this.recordMetric('system_health_check', 1);
    } catch (error) {
      logger.error('Error collecting system metrics:', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.recordMetric('system_health_check', 0);
    }
  }

  /**
   * Check database alerts
   */
  private static async checkDatabaseAlerts(): Promise<void> {
    const queryMetrics =
      this.metricsBuffer.get('database_query_duration') || [];

    if (queryMetrics.length > 0) {
      const avgDuration =
        queryMetrics.reduce((sum, m) => sum + m.value, 0) / queryMetrics.length;

      if (avgDuration > this.ALERT_THRESHOLDS.slowQuery) {
        this.sendAlert(
          'slow_database_queries',
          `Average database query time: ${avgDuration.toFixed(2)}ms`,
          'warning',
          { avg_duration: avgDuration, sample_size: queryMetrics.length },
        );
      }
    }
  }

  /**
   * Check cache alerts
   */
  private static async checkCacheAlerts(): Promise<void> {
    const hitRateMetrics = this.metricsBuffer.get('cache_hit_rate') || [];

    if (hitRateMetrics.length > 0) {
      const avgHitRate =
        hitRateMetrics.reduce((sum, m) => sum + m.value, 0) /
        hitRateMetrics.length;

      if (avgHitRate < this.ALERT_THRESHOLDS.lowCacheHitRate) {
        this.sendAlert(
          'low_cache_hit_rate',
          `Low cache hit rate: ${(avgHitRate * 100).toFixed(2)}%`,
          'warning',
          { hit_rate: avgHitRate, sample_size: hitRateMetrics.length },
        );
      }
    }
  }

  /**
   * Check API alerts
   */
  private static async checkApiAlerts(): Promise<void> {
    const apiMetrics = this.metricsBuffer.get('api_response_duration') || [];

    if (apiMetrics.length > 0) {
      const avgResponseTime =
        apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length;

      if (avgResponseTime > this.ALERT_THRESHOLDS.slowApi) {
        this.sendAlert(
          'slow_api_responses',
          `Average API response time: ${avgResponseTime.toFixed(2)}ms`,
          'warning',
          {
            avg_response_time: avgResponseTime,
            sample_size: apiMetrics.length,
          },
        );
      }
    }
  }

  /**
   * Check system alerts
   */
  private static async checkSystemAlerts(): Promise<void> {
    const redisHealthMetrics = this.metricsBuffer.get('redis_health') || [];

    if (redisHealthMetrics.length > 0) {
      const recentHealth = redisHealthMetrics.slice(-3); // Last 3 checks
      const healthyCount = recentHealth.filter((m) => m.value === 1).length;

      if (healthyCount < recentHealth.length) {
        this.sendAlert(
          'redis_connectivity_issues',
          'Redis connectivity issues detected',
          'critical',
          { healthy_checks: healthyCount, total_checks: recentHealth.length },
        );
      }
    }
  }

  /**
   * Get database metrics summary
   */
  private static getDatabaseMetrics(): DatabaseMetrics {
    const queryDurations =
      this.metricsBuffer.get('database_query_duration') || [];
    const avgDuration =
      queryDurations.length > 0
        ? queryDurations.reduce((sum, m) => sum + m.value, 0) /
          queryDurations.length
        : 0;

    return {
      averageQueryTime: avgDuration,
      slowQueryCount: queryDurations.filter(
        (m) => m.value > this.ALERT_THRESHOLDS.slowQuery,
      ).length,
      totalQueries: queryDurations.length,
    };
  }

  /**
   * Get cache metrics summary
   */
  private static getCacheMetrics(): CacheMetrics {
    const hitRates = this.metricsBuffer.get('cache_hit_rate') || [];
    const avgHitRate =
      hitRates.length > 0
        ? hitRates.reduce((sum, m) => sum + m.value, 0) / hitRates.length
        : 0;

    return {
      hitRate: avgHitRate,
      memoryUsage: this.getLatestMetric('cache_memory_usage') || 0,
      redisHealthy: (this.getLatestMetric('redis_health') || 0) === 1,
    };
  }

  /**
   * Get API metrics summary
   */
  private static getApiMetrics(): ApiMetrics {
    const responseTimes = this.metricsBuffer.get('api_response_duration') || [];
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, m) => sum + m.value, 0) /
          responseTimes.length
        : 0;

    return {
      averageResponseTime: avgResponseTime,
      slowResponseCount: responseTimes.filter(
        (m) => m.value > this.ALERT_THRESHOLDS.slowApi,
      ).length,
      totalRequests: responseTimes.length,
    };
  }

  /**
   * Get system metrics summary
   */
  private static getSystemMetrics(): SystemMetrics {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      systemHealthy: (this.getLatestMetric('system_health_check') || 0) === 1,
    };
  }

  /**
   * Get active alerts
   */
  private static getActiveAlerts(): Alert[] {
    // This would typically fetch from a persistent alert storage
    // For now, return empty array as alerts are logged immediately
    return [];
  }

  /**
   * Generate recommendations based on performance data
   */
  private static generateRecommendations(
    summary: PerformanceSummary,
  ): string[] {
    const recommendations: string[] = [];

    if (summary.database.averageQueryTime > 500) {
      recommendations.push(
        'Consider optimizing slow database queries or adding more indexes',
      );
    }

    if (summary.cache.hitRate < 0.8) {
      recommendations.push(
        'Cache hit rate is low - consider increasing TTL or expanding cache coverage',
      );
    }

    if (summary.api.averageResponseTime > 1000) {
      recommendations.push(
        'API response times are high - investigate database queries and caching',
      );
    }

    if (summary.cache.memoryUsage > 0.9) {
      recommendations.push(
        'Memory cache usage is high - consider increasing cache size or reducing TTL',
      );
    }

    return recommendations;
  }

  /**
   * Identify optimization opportunities
   */
  private static identifyOptimizationOpportunities(
    summary: PerformanceSummary,
  ): string[] {
    const opportunities: string[] = [];

    // Analyze patterns for optimization suggestions
    if (summary.database.slowQueryCount > summary.database.totalQueries * 0.1) {
      opportunities.push(
        'High percentage of slow queries - database optimization needed',
      );
    }

    if (!summary.cache.redisHealthy) {
      opportunities.push(
        'Redis connectivity issues - check Redis configuration and network',
      );
    }

    if (summary.api.slowResponseCount > summary.api.totalRequests * 0.05) {
      opportunities.push(
        'API performance degradation detected - implement response caching',
      );
    }

    return opportunities;
  }

  /**
   * Get latest metric value
   */
  private static getLatestMetric(metricName: string): number | null {
    const metrics = this.metricsBuffer.get(metricName);
    if (!metrics || metrics.length === 0) return null;

    return metrics[metrics.length - 1].value;
  }

  /**
   * Get cooldown period based on severity
   */
  private static getCooldownPeriod(severity: AlertSeverity): number {
    switch (severity) {
      case 'critical':
        return 5 * 60 * 1000; // 5 minutes
      case 'warning':
        return 15 * 60 * 1000; // 15 minutes
      case 'info':
        return 30 * 60 * 1000; // 30 minutes
      default:
        return 15 * 60 * 1000;
    }
  }

  /**
   * Cleanup old metrics
   */
  private static cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.METRICS_WINDOW * 1000;

    for (const [metricName, metrics] of this.metricsBuffer.entries()) {
      const filtered = metrics.filter((m) => m.timestamp > cutoff);
      this.metricsBuffer.set(metricName, filtered);
    }
  }
}

// Type definitions for monitoring
export interface MetricEntry {
  value: number;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface PerformanceSummary {
  timestamp: string;
  database: DatabaseMetrics;
  cache: CacheMetrics;
  api: ApiMetrics;
  system: SystemMetrics;
  alerts: Alert[];
}

export interface PerformanceReport extends PerformanceSummary {
  recommendations: string[];
  cacheHierarchy: {
    memoryCache: {
      size: number;
      maxSize: number;
      hitRate: number;
    };
    promotionCandidates: number;
    demotionCandidates: number;
  };
  optimizationOpportunities: string[];
}

export interface DatabaseMetrics {
  averageQueryTime: number;
  slowQueryCount: number;
  totalQueries: number;
}

export interface CacheMetrics {
  hitRate: number;
  memoryUsage: number;
  redisHealthy: boolean;
}

export interface ApiMetrics {
  averageResponseTime: number;
  slowResponseCount: number;
  totalRequests: number;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  systemHealthy: boolean;
}

export interface Alert {
  type: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export default AdvancedMonitoringService;
