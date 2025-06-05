import { PubSub, v1 } from '@google-cloud/pubsub';

export interface ProcessPubSubMessagesOptions {
  maxMessages?: number;
  pullIntervalMs?: number;
  projectId?: string;
  concurrency?: number; // Number of concurrent message processors
  ackDeadlineSeconds?: number; // Message acknowledgment deadline
  maxRetries?: number; // Maximum retries for failed messages
  exponentialBackoff?: boolean; // Use exponential backoff for retries
  createSubscriptionIfNotExists?: boolean; // Auto-create subscription if it doesn't exist
  topicName?: string; // Required if createSubscriptionIfNotExists is true
  deadLetterTopicName?: string; // Dead letter topic for failed messages
  maxDeliveryAttempts?: number; // Max delivery attempts before sending to dead letter
}

export interface SubscriptionMetrics {
  messagesReceived: number;
  messagesProcessed: number;
  messagesAcknowledged: number;
  messagesNacked: number;
  processingErrors: number;
  ackErrors: number;
  averageProcessingTime: number;
  lastProcessedAt: Date | null;
  uptime: number;
}

/**
 * Graceful shutdown handler for PubSub subscriptions
 */
class GracefulShutdown {
  private isShuttingDown = false;
  private activeProcesses = 0;
  private shutdownPromise: Promise<void> | null = null;

  constructor() {
    // Handle process termination signals
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  public addProcess(): void {
    this.activeProcesses++;
  }

  public removeProcess(): void {
    this.activeProcesses--;
  }

  public isShutdown(): boolean {
    return this.isShuttingDown;
  }

  public async shutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    console.log('Graceful shutdown initiated...');

    this.shutdownPromise = new Promise((resolve) => {
      const checkActiveProcesses = () => {
        if (this.activeProcesses === 0) {
          console.log('All processes completed. Shutting down.');
          resolve();
        } else {
          console.log(
            `Waiting for ${this.activeProcesses} active processes to complete...`,
          );
          setTimeout(checkActiveProcesses, 1000);
        }
      };
      checkActiveProcesses();
    });

    return this.shutdownPromise;
  }
}

/**
 * Utility function to create batched acknowledgments for better performance
 */
async function batchAcknowledge(
  subscriberClient: v1.SubscriberClient,
  subscription: string,
  ackIds: string[],
  batchSize: number = 100,
): Promise<void> {
  if (ackIds.length === 0) return;

  const batches = [];
  for (let i = 0; i < ackIds.length; i += batchSize) {
    batches.push(ackIds.slice(i, i + batchSize));
  }

  const ackPromises = batches.map((batch) =>
    subscriberClient.acknowledge({
      subscription,
      ackIds: batch,
    }),
  );

  await Promise.allSettled(ackPromises);
}

/**
 * Create a subscription if it doesn't exist
 */
async function ensureSubscriptionExists(
  pubSubClient: PubSub,
  subscriptionName: string,
  topicName: string,
  options: {
    ackDeadlineSeconds?: number;
    deadLetterTopicName?: string;
    maxDeliveryAttempts?: number;
  } = {},
): Promise<void> {
  try {
    await pubSubClient.subscription(subscriptionName).get();
    console.log(`Subscription ${subscriptionName} already exists`);
  } catch (error: any) {
    if (error.code === 5) {
      // NOT_FOUND
      console.log(`Creating subscription ${subscriptionName}...`);

      const subscriptionOptions: any = {
        ackDeadlineSeconds: options.ackDeadlineSeconds || 600,
      };

      // Configure dead letter queue if specified
      if (options.deadLetterTopicName && options.maxDeliveryAttempts) {
        subscriptionOptions.deadLetterPolicy = {
          deadLetterTopic: pubSubClient.topic(options.deadLetterTopicName).name,
          maxDeliveryAttempts: options.maxDeliveryAttempts,
        };
      }

      await pubSubClient
        .topic(topicName)
        .createSubscription(subscriptionName, subscriptionOptions);
      console.log(`Subscription ${subscriptionName} created successfully`);
    } else {
      throw error;
    }
  }
}

/**
 * Processes messages from a PubSub subscription using a manual pull approach.
 * This function will run indefinitely, polling for messages.
 *
 * @param {string} subscriptionName - The name of the PubSub subscription.
 * @param {(messageBody: any) => Promise<void> | void} callback - An async or sync function to process the message body.
 * @param {ProcessPubSubMessagesOptions} options - Optional configuration for pulling messages.
 *                                                 - maxMessages: Max messages to pull per request (default: 10).
 *                                                 - pullIntervalMs: Interval to wait if no messages (default: 1000ms).
 *                                                 - projectId: Optional GCP project ID.
 * @returns {Promise<void>} A promise that resolves if the listener stops due to a critical error, otherwise runs indefinitely.
 */
export async function processPubSubMessages(
  subscriptionName: string,
  callback: (messageBody: any) => Promise<void> | void,
  options: ProcessPubSubMessagesOptions = {},
): Promise<void> {
  const {
    maxMessages = 10,
    pullIntervalMs = 1000,
    concurrency = 5,
    ackDeadlineSeconds = 600,
    maxRetries = 3,
    exponentialBackoff = true,
    createSubscriptionIfNotExists = false,
    topicName,
    deadLetterTopicName,
    maxDeliveryAttempts,
  } = options;

  // Initialize metrics tracking
  const metrics: SubscriptionMetrics = {
    messagesReceived: 0,
    messagesProcessed: 0,
    messagesAcknowledged: 0,
    messagesNacked: 0,
    processingErrors: 0,
    ackErrors: 0,
    averageProcessingTime: 0,
    lastProcessedAt: null,
    uptime: Date.now(),
  };

  const processingTimes: number[] = [];

  // Initialize graceful shutdown handler
  const gracefulShutdown = new GracefulShutdown();

  // Log metrics periodically
  const metricsInterval = setInterval(() => {
    console.log(`[${subscriptionName}] Metrics:`, {
      ...metrics,
      uptime: Date.now() - metrics.uptime,
    });
  }, 60000); // Log every minute

  const pubSubClient = new PubSub(
    options.projectId ? { projectId: options.projectId } : {},
  );
  let projectId: string;
  try {
    // The projectId is usually available on the client instance after initialization
    // or can be inferred if running in a GCP environment.
    // If options.projectId is provided, it would have been used in the constructor.
    // If not, PubSub client attempts to discover it.
    projectId = pubSubClient.projectId;
    if (!projectId) {
      // Attempt to get project ID from environment or auth
      if (process.env.GOOGLE_CLOUD_PROJECT) {
        projectId = process.env.GOOGLE_CLOUD_PROJECT;
      } else if (process.env.GCLOUD_PROJECT) {
        projectId = process.env.GCLOUD_PROJECT;
      } else {
        throw new Error(
          'Google Cloud Project ID could not be determined. Please provide it explicitly in options or set GOOGLE_CLOUD_PROJECT environment variable.',
        );
      }
    }
  } catch (err) {
    console.error('Failed to get Google Cloud Project ID:', err);
    throw err; // Re-throw, as projectId is essential.
  }

  const subscriberClient = new v1.SubscriberClient(
    options.projectId ? { projectId: options.projectId } : {},
  );

  // Configure subscription settings for better performance
  const formattedSubscription = subscriberClient.subscriptionPath(
    projectId,
    subscriptionName,
  );

  // Set up subscription flow control settings
  if (ackDeadlineSeconds) {
    try {
      await subscriberClient.modifyAckDeadline({
        subscription: formattedSubscription,
        ackIds: [], // Empty for setting default
        ackDeadlineSeconds,
      });
    } catch (error) {
      console.warn('Could not set ack deadline:', error);
    }
  }

  console.log(
    `Initializing pull-based message listener for subscription: ${formattedSubscription}`,
  );

  // Ensure subscription exists if configured
  if (createSubscriptionIfNotExists && topicName) {
    try {
      await ensureSubscriptionExists(
        pubSubClient,
        subscriptionName,
        topicName,
        {
          ackDeadlineSeconds,
          deadLetterTopicName,
          maxDeliveryAttempts,
        },
      );
    } catch (error) {
      console.error(
        `Failed to ensure subscription ${subscriptionName} exists:`,
        error,
      );
      throw error;
    }
  }

  // Semaphore for controlling concurrency
  let activeTasks = 0;
  const maxConcurrentTasks = concurrency;

  // Retry logic with exponential backoff
  const executeWithRetry = async (
    fn: () => Promise<void>,
    retries = maxRetries,
  ): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      if (retries > 0) {
        const delay = exponentialBackoff
          ? Math.min(1000 * Math.pow(2, maxRetries - retries), 30000)
          : 1000;
        console.warn(`Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return executeWithRetry(fn, retries - 1);
      }
      throw error;
    }
  };

  // Process message with concurrency control
  const processMessage = async (
    receivedMessage: any,
  ): Promise<string | null> => {
    if (activeTasks >= maxConcurrentTasks) {
      // Wait for a task to complete
      await new Promise((resolve) => setTimeout(resolve, 10));
      return processMessage(receivedMessage);
    }

    if (gracefulShutdown.isShutdown()) {
      console.log(
        'Graceful shutdown in progress, skipping new message processing',
      );
      return null;
    }

    gracefulShutdown.addProcess();
    activeTasks++;
    const startTime = Date.now();

    try {
      if (
        receivedMessage.message &&
        receivedMessage.message.data &&
        receivedMessage.ackId
      ) {
        metrics.messagesReceived++;

        // Ensure message.data is not null or undefined before Buffer.from
        const messageData = receivedMessage.message.data;
        let messageBodyString: string;

        if (messageData instanceof Buffer) {
          messageBodyString = messageData.toString('utf8');
        } else if (typeof messageData === 'string') {
          // If it's a base64 encoded string, decode it first
          messageBodyString = Buffer.from(messageData, 'base64').toString(
            'utf8',
          );
        } else if (messageData instanceof Uint8Array) {
          messageBodyString = Buffer.from(messageData).toString('utf8');
        } else {
          console.warn(
            'Received message with unknown data type:',
            typeof messageData,
          );
          return null;
        }

        const messageBody = JSON.parse(messageBodyString);
        await executeWithRetry(async () => {
          const result = callback(messageBody);
          if (result instanceof Promise) {
            await result;
          }
        });

        metrics.messagesProcessed++;
        metrics.lastProcessedAt = new Date();

        // Update processing time metrics
        const processingTime = Date.now() - startTime;
        processingTimes.push(processingTime);
        if (processingTimes.length > 100) {
          processingTimes.shift(); // Keep only last 100 times
        }
        metrics.averageProcessingTime =
          processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

        return receivedMessage.ackId;
      } else {
        console.warn(
          'Received a message with missing data or ackId:',
          receivedMessage,
        );
        return null;
      }
    } catch (processingError) {
      metrics.processingErrors++;
      console.error(
        `Error processing message ID ${
          receivedMessage.message?.messageId || 'N/A'
        } from ${subscriptionName}:`,
        processingError,
      );
      return null;
    } finally {
      activeTasks--;
      gracefulShutdown.removeProcess();
    }
  };

  try {
    // This loop runs indefinitely to continuously pull messages.
    while (!gracefulShutdown.isShutdown()) {
      const pullRequest = {
        subscription: formattedSubscription,
        maxMessages: maxMessages,
        // returnImmediately: false (default) enables long polling.
        // The client will wait for a short duration if no messages are available.
      };

      let pullResponse;
      try {
        [pullResponse] = await subscriberClient.pull(pullRequest);
      } catch (pullError) {
        console.error(
          `Error pulling messages from ${subscriptionName}:`,
          pullError,
        );
        // Wait before retrying to avoid a tight loop on persistent errors (e.g., network issues)
        await new Promise((resolve) => setTimeout(resolve, pullIntervalMs * 5));
        continue;
      }

      const receivedMessages = pullResponse.receivedMessages || [];

      if (receivedMessages.length > 0) {
        console.log(
          `Received ${receivedMessages.length} messages from ${subscriptionName}.`,
        );

        // Process messages concurrently
        const messagePromises = receivedMessages.map((receivedMessage) =>
          processMessage(receivedMessage),
        );

        const ackIds = (await Promise.allSettled(messagePromises))
          .map((result) =>
            result.status === 'fulfilled' ? result.value : null,
          )
          .filter((ackId): ackId is string => ackId !== null);

        // Acknowledge successfully processed messages in batches
        if (ackIds.length > 0) {
          try {
            await batchAcknowledge(
              subscriberClient,
              formattedSubscription,
              ackIds,
            );
            metrics.messagesAcknowledged += ackIds.length;
            console.log(
              `Successfully acknowledged ${ackIds.length} messages for ${subscriptionName}.`,
            );
          } catch (ackError) {
            metrics.ackErrors++;
            console.error(
              `Error acknowledging messages for ${subscriptionName}:`,
              ackError,
            );
            // If acknowledgement fails, messages might be redelivered. This is a critical issue to monitor.
            // Depending on the error, some messages might have been acked, some not.
          }
        }

        // Track nacked messages
        const nackedCount = receivedMessages.length - ackIds.length;
        if (nackedCount > 0) {
          metrics.messagesNacked += nackedCount;
        }
      } else {
        // No messages received in this pull attempt.
        // If using long polling (default), this means the long poll timeout was reached.
        // A short pause before the next pull attempt can prevent busy-looping if not relying on long-polling effectively.
        await new Promise((resolve) => setTimeout(resolve, pullIntervalMs));
      }
    }

    // Clean up on graceful shutdown
    console.log(
      'Graceful shutdown completed for subscription:',
      subscriptionName,
    );
    clearInterval(metricsInterval);
  } catch (criticalError) {
    // This catch block handles unexpected errors in the subscriberClient setup or other unrecoverable states.
    console.error(
      `Critical error in pull subscription listener for ${subscriptionName}. The listener will terminate:`,
      criticalError,
    );
    clearInterval(metricsInterval);
    // Re-throw the error to allow any supervising process (e.g., PM2, Kubernetes, Cloud Run)
    // to detect the failure and potentially restart the listener.
    throw criticalError;
  }
}

/**
 * Get current metrics for a subscription
 * This function can be called externally to get real-time metrics
 */
export function getSubscriptionMetrics(
  subscriptionName: string,
): SubscriptionMetrics | null {
  // In a real implementation, you might want to store metrics in a global registry
  // For now, this is a placeholder that would need to be implemented based on your architecture
  console.warn(
    `${subscriptionName} getSubscriptionMetrics is not implemented. Metrics are currently logged periodically.`,
  );
  return null;
}
