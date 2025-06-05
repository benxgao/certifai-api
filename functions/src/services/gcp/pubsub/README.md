# PubSub Service Documentation

A comprehensive, production-ready Google Cloud PubSub service for Node.js applications with advanced features like concurrency control, retry mechanisms, metrics tracking, and graceful shutdown handling.

## Features

- 🚀 **High Performance**: Concurrent message processing with configurable concurrency limits
- 🔄 **Retry Logic**: Exponential backoff retry mechanisms for failed messages
- 📊 **Metrics & Monitoring**: Built-in metrics tracking and Prometheus export
- 🛡️ **Error Handling**: Dead letter queues and comprehensive error handling
- 🎯 **Type Safety**: Full TypeScript support with type-safe message handlers
- 🔧 **Flexible Configuration**: Extensive configuration options for fine-tuning
- 🛑 **Graceful Shutdown**: Proper cleanup and graceful shutdown handling
- 📦 **Batch Operations**: Efficient batch publishing and acknowledgment

## Installation

```bash
npm install @google-cloud/pubsub
```

## Quick Start

### Basic Subscription Processing

```typescript
import { processPubSubMessages } from './subscribe';

// Simple message processing
await processPubSubMessages('my-subscription', async (messageBody) => {
  console.log('Processing:', messageBody);
  // Your business logic here
});
```

### Using the PubSubService Class

```typescript
import { PubSubService } from './service';

const pubSubService = new PubSubService('your-project-id');

// Publish a message
await pubSubService.publishMessage('my-topic', {
  userId: '12345',
  action: 'user_created',
});

// Subscribe to messages
await pubSubService.subscribeToMessages(
  'my-subscription',
  async (messageBody) => {
    await handleMessage(messageBody);
  },
);
```

## Advanced Configuration

### Concurrency and Performance

```typescript
await processPubSubMessages('high-throughput-subscription', messageHandler, {
  maxMessages: 100, // Pull up to 100 messages at once
  concurrency: 20, // Process up to 20 messages concurrently
  pullIntervalMs: 100, // Aggressive polling interval
  ackDeadlineSeconds: 300, // 5 minutes to process each message
});
```

### Retry Configuration

```typescript
await processPubSubMessages('reliable-subscription', messageHandler, {
  maxRetries: 5,
  exponentialBackoff: true,
  deadLetterTopicName: 'failed-messages-dlq',
  maxDeliveryAttempts: 3,
});
```

### Auto-Creation of Resources

```typescript
await processPubSubMessages('auto-subscription', messageHandler, {
  createSubscriptionIfNotExists: true,
  topicName: 'my-topic',
  ackDeadlineSeconds: 600,
});
```

## Metrics and Monitoring

### Built-in Metrics

The service automatically tracks:

- Messages received/processed/acknowledged/nacked
- Processing errors and acknowledgment errors
- Average processing time
- Subscription uptime

### Using the Metrics Registry

```typescript
import { metricsRegistry, withMetrics } from './metrics';

// Register subscription for metrics
metricsRegistry.register('my-subscription');

// Use metrics middleware
const handler = withMetrics('my-subscription', async (messageBody) => {
  await processMessage(messageBody);
});

// Get metrics
const metrics = metricsRegistry.get('my-subscription');
console.log('Current metrics:', metrics);
```

### Prometheus Export

```typescript
// Export metrics in Prometheus format
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metricsRegistry.toPrometheusFormat());
});
```

## Error Handling and Dead Letter Queues

### Setting up Dead Letter Queues

```typescript
const pubSubService = new PubSubService();

await pubSubService.ensureTopicAndSubscriptionExist(
  'main-topic',
  'main-subscription',
  {
    deadLetterTopicName: 'dlq-topic',
    maxDeliveryAttempts: 3,
  },
);

// Process main messages
await pubSubService.subscribeToMessages(
  'main-subscription',
  async (messageBody) => {
    if (shouldFail(messageBody)) {
      throw new Error('Processing failed');
    }
    await processMessage(messageBody);
  },
);

// Process failed messages from DLQ
await pubSubService.subscribeToMessages(
  'dlq-subscription',
  async (messageBody) => {
    await handleFailedMessage(messageBody);
  },
);
```

## Type Safety

### Defining Message Types

```typescript
interface UserEvent {
  userId: string;
  email: string;
  action: 'created' | 'updated' | 'deleted';
  timestamp: string;
}

const userEventHandler: MessageHandler<UserEvent> = async (event) => {
  console.log(`User ${event.action}: ${event.email}`);
  // Type-safe access to event properties
};
```

## Batch Operations

### Batch Publishing

```typescript
const messages = [
  { data: { userId: '1', action: 'login' } },
  { data: { userId: '2', action: 'logout' } },
  { data: { userId: '3', action: 'purchase' } },
];

const result = await pubSubService.publishBatch('user-events', messages);
console.log(`Published ${result.successCount} messages`);
```

## Health Monitoring

```typescript
// Health check
const health = await pubSubService.healthCheck();
if (health.status === 'unhealthy') {
  console.error('PubSub service is down:', health.details);
}

// Periodic health monitoring
setInterval(async () => {
  const health = await pubSubService.healthCheck();
  console.log('Health status:', health.status);
}, 30000);
```

## Configuration Options

### ProcessPubSubMessagesOptions

| Option                          | Type    | Default | Description                                    |
| ------------------------------- | ------- | ------- | ---------------------------------------------- |
| `maxMessages`                   | number  | 10      | Maximum messages to pull per request           |
| `pullIntervalMs`                | number  | 1000    | Interval between pulls when no messages        |
| `concurrency`                   | number  | 5       | Maximum concurrent message processors          |
| `ackDeadlineSeconds`            | number  | 600     | Message acknowledgment deadline                |
| `maxRetries`                    | number  | 3       | Maximum retries for failed messages            |
| `exponentialBackoff`            | boolean | true    | Use exponential backoff for retries            |
| `createSubscriptionIfNotExists` | boolean | false   | Auto-create subscription                       |
| `topicName`                     | string  | -       | Topic name (required if creating subscription) |
| `deadLetterTopicName`           | string  | -       | Dead letter topic name                         |
| `maxDeliveryAttempts`           | number  | -       | Max attempts before dead letter                |

## Best Practices

### Performance Optimization

1. **Adjust concurrency based on your workload**:

   - CPU-intensive tasks: Lower concurrency (2-5)
   - I/O-intensive tasks: Higher concurrency (10-50)

2. **Use appropriate batch sizes**:

   - High-throughput: Increase `maxMessages` (50-1000)
   - Low-latency: Decrease `maxMessages` (1-10)

3. **Configure ack deadlines appropriately**:
   - Quick processing: 60-300 seconds
   - Complex processing: 300-600 seconds

### Error Handling

1. **Always use dead letter queues** for critical workloads
2. **Implement proper retry logic** with exponential backoff
3. **Monitor error rates** and set up alerts
4. **Log failed messages** for debugging

### Monitoring

1. **Track key metrics**:

   - Processing rate
   - Error rate
   - Processing time
   - Queue depth

2. **Set up alerts** for:

   - High error rates
   - Processing delays
   - Service health issues

3. **Use structured logging** for better observability

## Environment Variables

```bash
# Required
GOOGLE_CLOUD_PROJECT=your-project-id

# Optional
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## Examples

See the [examples file](./example.ts) for comprehensive usage examples including:

- Basic and advanced subscription processing
- Batch publishing
- Metrics collection
- Error handling with dead letter queues
- Health monitoring
- Type-safe message handlers

## API Reference

### Functions

- `processPubSubMessages(subscriptionName, callback, options)` - Main subscription processing function
- `getSubscriptionMetrics(subscriptionName)` - Get metrics for a subscription

### Classes

- `PubSubService` - Comprehensive PubSub service with publish/subscribe capabilities
- `MetricsRegistry` - Metrics tracking and export
- `GracefulShutdown` - Graceful shutdown handling

### Types

- `ProcessPubSubMessagesOptions` - Configuration options
- `SubscriptionMetrics` - Metrics interface
- `MessageHandler<T>` - Type-safe message handler
- `PubSubMessage` - Message interface
- `BatchPublishResult` - Batch publish result

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Use conventional commit messages

## License

[Your License]
