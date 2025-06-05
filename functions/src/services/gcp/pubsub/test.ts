/**
 * Test script for PubSub service
 * Run this to validate the service functionality
 */

import { PubSubService } from './service';
import { metricsRegistry, withMetrics } from './metrics';

interface TestMessage {
  id: string;
  message: string;
  timestamp: string;
}

async function testBasicFunctionality() {
  console.log('🧪 Testing basic PubSub functionality...');

  const pubSubService = new PubSubService();
  const topicName = 'test-topic';
  const subscriptionName = 'test-subscription';

  try {
    // Test health check
    console.log('📊 Testing health check...');
    const health = await pubSubService.healthCheck();
    console.log('Health status:', health.status);

    // Test topic and subscription creation
    console.log('🏗️ Creating topic and subscription...');
    await pubSubService.ensureTopicAndSubscriptionExist(
      topicName,
      subscriptionName,
    );

    // Test publishing
    console.log('📤 Testing message publishing...');
    const messageId = await pubSubService.publishMessage(topicName, {
      id: 'test-1',
      message: 'Hello PubSub!',
      timestamp: new Date().toISOString(),
    });
    console.log('Published message with ID:', messageId);

    // Test batch publishing
    console.log('📦 Testing batch publishing...');
    const batchMessages = [
      { data: { id: 'batch-1', message: 'Batch message 1' } },
      { data: { id: 'batch-2', message: 'Batch message 2' } },
      { data: { id: 'batch-3', message: 'Batch message 3' } },
    ];

    const batchResult = await pubSubService.publishBatch(
      topicName,
      batchMessages,
    );
    console.log(`Published ${batchResult.length} messages in batch`);

    // Test listing topics and subscriptions
    console.log('📋 Testing resource listing...');
    const topics = await pubSubService.listTopics();
    const subscriptions = await pubSubService.listSubscriptions();
    console.log(
      `Found ${topics.length} topics and ${subscriptions.length} subscriptions`,
    );

    console.log('✅ Basic functionality tests passed!');
  } catch (error) {
    console.error('❌ Basic functionality test failed:', error);
    throw error;
  }
}

async function testMetrics() {
  console.log('🧪 Testing metrics functionality...');

  const subscriptionName = 'test-metrics-subscription';

  try {
    // Register subscription for metrics
    metricsRegistry.register(subscriptionName);

    // Set up metrics callback
    metricsRegistry.onUpdate(subscriptionName, (metrics) => {
      console.log(`📊 Metrics update for ${subscriptionName}:`, {
        processed: metrics.messagesProcessed,
        errors: metrics.processingErrors,
        avgTime: metrics.averageProcessingTime,
      });
    });

    // Create a test handler with metrics
    const handler = withMetrics(
      subscriptionName,
      async (messageBody: TestMessage) => {
        console.log(`Processing test message: ${messageBody.id}`);

        // Simulate processing time
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 100),
        );

        // Simulate occasional errors
        if (Math.random() < 0.1) {
          throw new Error('Simulated processing error');
        }
      },
    );

    // Simulate processing some messages
    for (let i = 0; i < 10; i++) {
      try {
        await handler({
          id: `test-${i}`,
          message: `Test message ${i}`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.log(
          `Expected error in message ${i}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    }

    // Get final metrics
    const finalMetrics = metricsRegistry.get(subscriptionName);
    console.log('📊 Final metrics:', finalMetrics);

    // Test Prometheus export
    const prometheusMetrics = metricsRegistry.toPrometheusFormat();
    console.log('📈 Prometheus format sample:');
    console.log(prometheusMetrics.split('\n').slice(0, 10).join('\n'));

    console.log('✅ Metrics tests passed!');
  } catch (error) {
    console.error('❌ Metrics test failed:', error);
    throw error;
  }
}

async function testErrorHandling() {
  console.log('🧪 Testing error handling...');

  const pubSubService = new PubSubService();
  const topicName = 'test-error-topic';
  const subscriptionName = 'test-error-subscription';
  const dlqTopicName = 'test-error-dlq';
  const dlqSubscriptionName = 'test-error-dlq-subscription';

  try {
    // Set up main subscription with DLQ
    await pubSubService.ensureTopicAndSubscriptionExist(
      topicName,
      subscriptionName,
      {
        deadLetterTopicName: dlqTopicName,
        maxDeliveryAttempts: 2,
      },
    );

    // Set up DLQ subscription
    await pubSubService.ensureTopicAndSubscriptionExist(
      dlqTopicName,
      dlqSubscriptionName,
    );

    // Publish a test message
    await pubSubService.publishMessage(topicName, {
      id: 'error-test',
      message: 'This message will fail processing',
      timestamp: new Date().toISOString(),
    });

    console.log('📤 Published test message that will fail processing');
    console.log(
      '🔄 This would normally be processed by the subscription with retries',
    );
    console.log(
      '⚠️  After max retries, it would be sent to the dead letter queue',
    );

    console.log('✅ Error handling setup completed!');
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    throw error;
  }
}

async function runAllTests() {
  console.log('🚀 Starting PubSub service tests...\n');

  try {
    await testBasicFunctionality();
    console.log('');

    await testMetrics();
    console.log('');

    await testErrorHandling();
    console.log('');

    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Export test functions for individual testing
export { testBasicFunctionality, testMetrics, testErrorHandling, runAllTests };

// Run all tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}
