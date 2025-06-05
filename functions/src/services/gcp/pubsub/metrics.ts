import { SubscriptionMetrics } from './subscribe';

/**
 * Metrics registry for tracking PubSub performance across multiple subscriptions
 */
class MetricsRegistry {
  private metrics: Map<string, SubscriptionMetrics> = new Map();
  private callbacks: Map<string, (metrics: SubscriptionMetrics) => void> =
    new Map();

  /**
   * Register a subscription for metrics tracking
   */
  register(
    subscriptionName: string,
    initialMetrics?: Partial<SubscriptionMetrics>,
  ): void {
    const defaultMetrics: SubscriptionMetrics = {
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesAcknowledged: 0,
      messagesNacked: 0,
      processingErrors: 0,
      ackErrors: 0,
      averageProcessingTime: 0,
      lastProcessedAt: null,
      uptime: Date.now(),
      ...initialMetrics,
    };

    this.metrics.set(subscriptionName, defaultMetrics);
  }

  /**
   * Update metrics for a subscription
   */
  update(
    subscriptionName: string,
    updates: Partial<SubscriptionMetrics>,
  ): void {
    const current = this.metrics.get(subscriptionName);
    if (current) {
      const updated = { ...current, ...updates };
      this.metrics.set(subscriptionName, updated);

      // Trigger callbacks
      const callback = this.callbacks.get(subscriptionName);
      if (callback) {
        callback(updated);
      }
    }
  }

  /**
   * Get metrics for a specific subscription
   */
  get(subscriptionName: string): SubscriptionMetrics | null {
    return this.metrics.get(subscriptionName) || null;
  }

  /**
   * Get all metrics
   */
  getAll(): Map<string, SubscriptionMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Register a callback for metric updates
   */
  onUpdate(
    subscriptionName: string,
    callback: (metrics: SubscriptionMetrics) => void,
  ): void {
    this.callbacks.set(subscriptionName, callback);
  }

  /**
   * Remove a subscription from tracking
   */
  unregister(subscriptionName: string): void {
    this.metrics.delete(subscriptionName);
    this.callbacks.delete(subscriptionName);
  }

  /**
   * Get aggregated metrics across all subscriptions
   */
  getAggregated(): SubscriptionMetrics {
    const allMetrics = Array.from(this.metrics.values());

    if (allMetrics.length === 0) {
      return {
        messagesReceived: 0,
        messagesProcessed: 0,
        messagesAcknowledged: 0,
        messagesNacked: 0,
        processingErrors: 0,
        ackErrors: 0,
        averageProcessingTime: 0,
        lastProcessedAt: null,
        uptime: 0,
      };
    }

    const totals = allMetrics.reduce(
      (acc, metrics) => ({
        messagesReceived: acc.messagesReceived + metrics.messagesReceived,
        messagesProcessed: acc.messagesProcessed + metrics.messagesProcessed,
        messagesAcknowledged:
          acc.messagesAcknowledged + metrics.messagesAcknowledged,
        messagesNacked: acc.messagesNacked + metrics.messagesNacked,
        processingErrors: acc.processingErrors + metrics.processingErrors,
        ackErrors: acc.ackErrors + metrics.ackErrors,
        averageProcessingTime:
          acc.averageProcessingTime + metrics.averageProcessingTime,
        lastProcessedAt:
          acc.lastProcessedAt && metrics.lastProcessedAt
            ? acc.lastProcessedAt > metrics.lastProcessedAt
              ? acc.lastProcessedAt
              : metrics.lastProcessedAt
            : acc.lastProcessedAt || metrics.lastProcessedAt,
        uptime: Math.min(acc.uptime, metrics.uptime),
      }),
      {
        messagesReceived: 0,
        messagesProcessed: 0,
        messagesAcknowledged: 0,
        messagesNacked: 0,
        processingErrors: 0,
        ackErrors: 0,
        averageProcessingTime: 0,
        lastProcessedAt: null as Date | null,
        uptime: Number.MAX_SAFE_INTEGER,
      },
    );

    return {
      ...totals,
      averageProcessingTime: totals.averageProcessingTime / allMetrics.length,
      uptime: Date.now() - totals.uptime,
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    for (const [subscriptionName, metrics] of this.metrics) {
      const labels = `{subscription="${subscriptionName}"}`;

      lines.push(
        '# HELP pubsub_messages_received_total Total messages received',
      );
      lines.push('# TYPE pubsub_messages_received_total counter');
      lines.push(
        `pubsub_messages_received_total${labels} ${metrics.messagesReceived}`,
      );

      lines.push(
        '# HELP pubsub_messages_processed_total Total messages processed',
      );
      lines.push('# TYPE pubsub_messages_processed_total counter');
      lines.push(
        `pubsub_messages_processed_total${labels} ${metrics.messagesProcessed}`,
      );

      lines.push(
        '# HELP pubsub_messages_acknowledged_total Total messages acknowledged',
      );
      lines.push('# TYPE pubsub_messages_acknowledged_total counter');
      lines.push(
        `pubsub_messages_acknowledged_total${labels} ${metrics.messagesAcknowledged}`,
      );

      lines.push('# HELP pubsub_messages_nacked_total Total messages nacked');
      lines.push('# TYPE pubsub_messages_nacked_total counter');
      lines.push(
        `pubsub_messages_nacked_total${labels} ${metrics.messagesNacked}`,
      );

      lines.push(
        '# HELP pubsub_processing_errors_total Total processing errors',
      );
      lines.push('# TYPE pubsub_processing_errors_total counter');
      lines.push(
        `pubsub_processing_errors_total${labels} ${metrics.processingErrors}`,
      );

      lines.push('# HELP pubsub_ack_errors_total Total acknowledgment errors');
      lines.push('# TYPE pubsub_ack_errors_total counter');
      lines.push(`pubsub_ack_errors_total${labels} ${metrics.ackErrors}`);

      lines.push(
        '# HELP pubsub_average_processing_time_ms Average message processing time',
      );
      lines.push('# TYPE pubsub_average_processing_time_ms gauge');
      lines.push(
        `pubsub_average_processing_time_ms${labels} ${metrics.averageProcessingTime}`,
      );

      lines.push('# HELP pubsub_uptime_seconds Subscription uptime in seconds');
      lines.push('# TYPE pubsub_uptime_seconds gauge');
      lines.push(
        `pubsub_uptime_seconds${labels} ${
          (Date.now() - metrics.uptime) / 1000
        }`,
      );
    }

    return lines.join('\n');
  }
}

// Global registry instance
export const metricsRegistry = new MetricsRegistry();

/**
 * Middleware for automatic metrics collection
 */
export function withMetrics<T>(
  subscriptionName: string,
  handler: (messageBody: T) => Promise<void> | void,
): (messageBody: T) => Promise<void> {
  return async (messageBody: T) => {
    const startTime = Date.now();

    try {
      await handler(messageBody);

      // Update success metrics
      const current = metricsRegistry.get(subscriptionName);
      if (current) {
        metricsRegistry.update(subscriptionName, {
          messagesProcessed: current.messagesProcessed + 1,
          lastProcessedAt: new Date(),
          averageProcessingTime:
            (current.averageProcessingTime * current.messagesProcessed +
              (Date.now() - startTime)) /
            (current.messagesProcessed + 1),
        });
      }
    } catch (error) {
      // Update error metrics
      const current = metricsRegistry.get(subscriptionName);
      if (current) {
        metricsRegistry.update(subscriptionName, {
          processingErrors: current.processingErrors + 1,
        });
      }
      throw error;
    }
  };
}

export { MetricsRegistry };
