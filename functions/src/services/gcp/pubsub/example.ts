import { processPubSubMessages } from './subscribe';
import { PubSubService } from './service';
import { metricsRegistry, withMetrics } from './metrics';
import { MessageHandler } from './types';

/**
 * Example usage of the enhanced PubSub subscription service
 */

// Example 1: Basic usage with default options
async function basicExample() {
  await processPubSubMessages('my-subscription-name', async (messageBody) => {
    console.log('Processing message:', messageBody);
    // Your business logic here
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate processing
  });
}

// Example 2: Advanced usage with custom options
async function advancedExample() {
  await processPubSubMessages(
    'my-subscription-name',
    async (messageBody) => {
      console.log('Processing message:', messageBody);

      // Simulate some async processing
      if (messageBody.type === 'email') {
        await sendEmail(messageBody);
      } else if (messageBody.type === 'webhook') {
        await processWebhook(messageBody);
      }
    },
    {
      maxMessages: 50, // Pull up to 50 messages at once
      pullIntervalMs: 500, // Wait 500ms between empty pulls
      concurrency: 10, // Process up to 10 messages concurrently
      ackDeadlineSeconds: 300, // 5 minutes to process messages
      maxRetries: 5, // Retry failed messages up to 5 times
      exponentialBackoff: true, // Use exponential backoff for retries
      projectId: 'my-gcp-project', // Explicit project ID
    },
  );
}

// Example 3: Using the PubSubService class for comprehensive operations
async function serviceExample() {
  const pubSubService = new PubSubService('my-gcp-project');

  // Create topic and subscription
  await pubSubService.ensureTopicAndSubscriptionExist(
    'user-events',
    'user-events-processor',
    {
      ackDeadlineSeconds: 600,
      deadLetterTopicName: 'user-events-dlq',
      maxDeliveryAttempts: 5,
    },
  );

  // Publish a message
  await pubSubService.publishMessage(
    'user-events',
    {
      userId: '12345',
      event: 'user_registered',
      timestamp: new Date().toISOString(),
    },
    {
      attributes: {
        source: 'auth-service',
        version: '1.0',
      },
    },
  );

  // Start processing messages
  await pubSubService.subscribeToMessages(
    'user-events-processor',
    async (messageBody) => {
      console.log('Processing user event:', messageBody);
      await handleUserEvent(messageBody);
    },
    {
      concurrency: 5,
      maxRetries: 3,
      createSubscriptionIfNotExists: true,
      topicName: 'user-events',
    },
  );
}

// Example 4: Batch publishing
async function batchPublishExample() {
  const pubSubService = new PubSubService();

  const messages = [
    {
      data: { userId: '1', action: 'login' },
      attributes: { priority: 'high' },
    },
    { data: { userId: '2', action: 'logout' } },
    {
      data: { userId: '3', action: 'purchase' },
      attributes: { priority: 'critical' },
    },
  ];

  try {
    const messageIds = await pubSubService.publishBatch(
      'user-activity',
      messages,
    );
    console.log(`Published ${messageIds.length} messages successfully`);
  } catch (error) {
    console.error('Batch publish failed:', error);
  }
}

// Example 5: Using metrics middleware
async function metricsExample() {
  const subscriptionName = 'orders-processor';

  // Register subscription for metrics
  metricsRegistry.register(subscriptionName);

  // Set up metrics callback
  metricsRegistry.onUpdate(subscriptionName, (metrics) => {
    console.log(`[${subscriptionName}] Metrics update:`, metrics);

    // Send to monitoring service
    if (metrics.processingErrors > 10) {
      console.warn(`High error rate detected for ${subscriptionName}`);
    }
  });

  // Use metrics middleware
  const handler = withMetrics(subscriptionName, async (messageBody: any) => {
    console.log('Processing order:', messageBody);
    await processOrder(messageBody);
  });

  await processPubSubMessages(subscriptionName, handler, {
    concurrency: 10,
    maxRetries: 3,
  });
}

// Example 6: Error handling and dead letter queues
async function errorHandlingExample() {
  const pubSubService = new PubSubService();

  // Set up main subscription with dead letter queue
  await pubSubService.ensureTopicAndSubscriptionExist(
    'payment-events',
    'payment-processor',
    {
      ackDeadlineSeconds: 300,
      deadLetterTopicName: 'payment-events-dlq',
      maxDeliveryAttempts: 3,
    },
  );

  // Set up dead letter queue processor
  await pubSubService.ensureTopicAndSubscriptionExist(
    'payment-events-dlq',
    'payment-dlq-processor',
  );

  // Main processor
  const mainProcessor = async () => {
    await pubSubService.subscribeToMessages(
      'payment-processor',
      async (messageBody) => {
        try {
          await processPayment(messageBody);
        } catch (error) {
          console.error('Payment processing failed:', error);
          throw error; // This will cause the message to be retried/sent to DLQ
        }
      },
      {
        concurrency: 5,
        maxRetries: 2,
        exponentialBackoff: true,
      },
    );
  };

  // Dead letter queue processor
  const dlqProcessor = async () => {
    await pubSubService.subscribeToMessages(
      'payment-dlq-processor',
      async (messageBody) => {
        console.log('Processing failed payment from DLQ:', messageBody);
        // Handle failed messages - maybe send to manual review queue
        await handleFailedPayment(messageBody);
      },
      {
        concurrency: 2,
        maxRetries: 1,
      },
    );
  };

  // Start both processors
  await Promise.all([mainProcessor(), dlqProcessor()]);
}

// Example 7: Health monitoring and metrics export
async function monitoringExample() {
  const pubSubService = new PubSubService();

  // Health check endpoint
  setInterval(async () => {
    const health = await pubSubService.healthCheck();
    console.log('PubSub Health:', health);

    if (health.status === 'unhealthy') {
      // Alert monitoring system
      console.error('PubSub service is unhealthy!', health.details);
    }
  }, 30000); // Check every 30 seconds

  // Metrics export for Prometheus (example - requires express to be installed)
  // import express from 'express';
  // const app = express();

  // For this example, we'll just simulate the express app
  const app = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    get: (_path: string, handler: (req: any, res: any) => void) => {
      console.log(`Metrics endpoint would be available at ${_path}`);
    },
    listen: (port: number, callback: () => void) => {
      console.log(`Metrics server would listen on port ${port}`);
      callback();
    },
  };

  app.get('/metrics', (_req: any, res: any) => {
    res.set('Content-Type', 'text/plain');
    res.send(metricsRegistry.toPrometheusFormat());
  });

  app.listen(8080, () => {
    console.log('Metrics endpoint available at http://localhost:8080/metrics');
  });
}

// Helper functions
async function sendEmail(messageBody: any): Promise<void> {
  console.log('Sending email:', messageBody.email);
  // Email sending logic
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function processWebhook(messageBody: any): Promise<void> {
  console.log('Processing webhook:', messageBody.webhook);
  // Webhook processing logic
  await new Promise((resolve) => setTimeout(resolve, 150));
}

async function handleUserEvent(messageBody: any): Promise<void> {
  console.log('Handling user event:', messageBody);
  // User event handling logic
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function processOrder(messageBody: any): Promise<void> {
  console.log('Processing order:', messageBody);
  // Order processing logic
  if (Math.random() < 0.1) {
    throw new Error('Random processing error for testing');
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function processPayment(messageBody: any): Promise<void> {
  console.log('Processing payment:', messageBody);
  // Payment processing logic
  if (messageBody.amount > 10000) {
    throw new Error('Amount exceeds limit');
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function handleFailedPayment(messageBody: any): Promise<void> {
  console.log('Handling failed payment:', messageBody);
  // Send to manual review, log for investigation, etc.
  await new Promise((resolve) => setTimeout(resolve, 100));
}

// Example 8: Typed message handlers
interface UserRegistrationEvent {
  userId: string;
  email: string;
  timestamp: string;
  source: string;
}

interface OrderEvent {
  orderId: string;
  userId: string;
  amount: number;
  items: Array<{ id: string; quantity: number }>;
}

const userRegistrationHandler: MessageHandler<UserRegistrationEvent> = async (
  event,
) => {
  console.log(`New user registered: ${event.email}`);
  // Send welcome email, create user profile, etc.
};

const orderHandler: MessageHandler<OrderEvent> = async (order) => {
  console.log(`Processing order ${order.orderId} for user ${order.userId}`);
  // Process payment, update inventory, send confirmation, etc.
};

// Export examples for use in other files
export {
  basicExample,
  advancedExample,
  serviceExample,
  batchPublishExample,
  metricsExample,
  errorHandlingExample,
  monitoringExample,
  userRegistrationHandler,
  orderHandler,
};
