/**
 * Common types and interfaces for PubSub service
 */

export interface MessageAttributes {
  [key: string]: string;
}

export interface PubSubMessage {
  data: any;
  attributes?: MessageAttributes;
  messageId?: string;
  publishTime?: Date;
  orderingKey?: string;
}

export interface MessageHandler<T = any> {
  (messageBody: T, messageInfo?: PubSubMessage): Promise<void> | void;
}

export interface BatchPublishMessage {
  data: any;
  attributes?: MessageAttributes;
  orderingKey?: string;
}

export interface SubscriptionConfig {
  ackDeadlineSeconds?: number;
  retainAckedMessages?: boolean;
  messageRetentionDuration?: number;
  enableMessageOrdering?: boolean;
  filter?: string;
  deadLetterPolicy?: {
    deadLetterTopic: string;
    maxDeliveryAttempts: number;
  };
  retryPolicy?: {
    minimumBackoff: number;
    maximumBackoff: number;
  };
}

export interface TopicConfig {
  messageStoragePolicy?: {
    allowedPersistenceRegions: string[];
  };
  schemaSettings?: {
    schema: string;
    encoding: 'JSON' | 'BINARY';
  };
}

export interface PublishResult {
  messageId: string;
  success: boolean;
  error?: Error;
}

export interface BatchPublishResult {
  results: PublishResult[];
  successCount: number;
  failureCount: number;
}

export interface PubSubErrorType {
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR';
  PERMISSION_DENIED: 'PERMISSION_DENIED';
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND';
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED';
  NETWORK_ERROR: 'NETWORK_ERROR';
  UNKNOWN_ERROR: 'UNKNOWN_ERROR';
}

export class PubSubError extends Error {
  constructor(
    message: string,
    public type: keyof PubSubErrorType,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'PubSubError';
  }
}
