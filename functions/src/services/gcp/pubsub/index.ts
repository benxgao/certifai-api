/**
 * Google Cloud PubSub Service
 *
 * A comprehensive, production-ready PubSub service with advanced features:
 * - Concurrent message processing
 * - Retry mechanisms with exponential backoff
 * - Metrics tracking and monitoring
 * - Dead letter queue support
 * - Graceful shutdown handling
 * - Type-safe message handlers
 */

// Main subscription processing
export { processPubSubMessages, getSubscriptionMetrics } from './subscribe';

// Comprehensive service class
export { PubSubService } from './service';

// Metrics and monitoring
export { metricsRegistry, withMetrics, MetricsRegistry } from './metrics';

// Types and interfaces
export type {
  ProcessPubSubMessagesOptions,
  SubscriptionMetrics,
} from './subscribe';

export type { PublishOptions, TopicOptions } from './service';

export type {
  MessageAttributes,
  PubSubMessage,
  MessageHandler,
  BatchPublishMessage,
  SubscriptionConfig,
  TopicConfig,
  PublishResult,
  BatchPublishResult,
  PubSubErrorType,
} from './types';

export { PubSubError } from './types';

// Re-export examples for reference
export * as examples from './example';
