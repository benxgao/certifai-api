import { PubSub } from '@google-cloud/pubsub';
import {
  processPubSubMessages,
  ProcessPubSubMessagesOptions,
  SubscriptionMetrics,
  getSubscriptionMetrics,
} from './subscribe';

interface PublishOptions {
  projectId?: string;
  attributes?: Record<string, string>;
}

interface TopicOptions {
  projectId?: string;
}

/**
 * Enhanced PubSub service for publishing and subscribing to messages
 */
export class PubSubService {
  private pubSubClient: PubSub;
  private projectId?: string;

  constructor(projectId?: string) {
    this.projectId = projectId;
    this.pubSubClient = new PubSub(projectId ? { projectId } : {});
  }

  /**
   * Publish a message to a topic
   */
  async publishMessage(
    topicName: string,
    messageData: any,
    options: PublishOptions = {},
  ): Promise<string> {
    try {
      const topic = this.pubSubClient.topic(topicName);

      // Ensure the message is a string or Buffer
      const messageBuffer = Buffer.from(
        typeof messageData === 'string'
          ? messageData
          : JSON.stringify(messageData),
      );

      const messageId = await topic.publish(messageBuffer, options.attributes);
      console.log(`Message ${messageId} published to topic ${topicName}`);
      return messageId;
    } catch (error) {
      console.error(`Error publishing message to topic ${topicName}:`, error);
      throw error;
    }
  }

  /**
   * Publish multiple messages in a batch
   */
  async publishBatch(
    topicName: string,
    messages: Array<{ data: any; attributes?: Record<string, string> }>,
    options: PublishOptions = {},
  ): Promise<string[]> {
    try {
      const topic = this.pubSubClient.topic(topicName);

      const publishPromises = messages.map(({ data, attributes }) => {
        const messageBuffer = Buffer.from(
          typeof data === 'string' ? data : JSON.stringify(data),
        );
        return topic.publish(messageBuffer, {
          ...options.attributes,
          ...attributes,
        });
      });

      const messageIds = await Promise.all(publishPromises);
      console.log(
        `${messageIds.length} messages published to topic ${topicName}`,
      );
      return messageIds;
    } catch (error) {
      console.error(
        `Error publishing batch messages to topic ${topicName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create a topic if it doesn't exist
   */
  async ensureTopicExists(topicName: string): Promise<void> {
    try {
      await this.pubSubClient.topic(topicName).get();
      console.log(`Topic ${topicName} already exists`);
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND
        console.log(`Creating topic ${topicName}...`);
        await this.pubSubClient.createTopic(topicName);
        console.log(`Topic ${topicName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Subscribe to messages from a subscription
   */
  async subscribeToMessages(
    subscriptionName: string,
    callback: (messageBody: any) => Promise<void> | void,
    options: ProcessPubSubMessagesOptions = {},
  ): Promise<void> {
    // Use the enhanced processPubSubMessages function
    return processPubSubMessages(subscriptionName, callback, {
      ...options,
      projectId: options.projectId || this.projectId,
    });
  }

  /**
   * Create a topic and subscription if they don't exist
   */
  async ensureTopicAndSubscriptionExist(
    topicName: string,
    subscriptionName: string,
    subscriptionOptions: {
      ackDeadlineSeconds?: number;
      deadLetterTopicName?: string;
      maxDeliveryAttempts?: number;
    } = {},
  ): Promise<void> {
    // Ensure topic exists first
    await this.ensureTopicExists(topicName);

    // Then ensure subscription exists
    try {
      await this.pubSubClient.subscription(subscriptionName).get();
      console.log(`Subscription ${subscriptionName} already exists`);
    } catch (error: any) {
      if (error.code === 5) {
        // NOT_FOUND
        console.log(`Creating subscription ${subscriptionName}...`);

        const subOptions: any = {
          ackDeadlineSeconds: subscriptionOptions.ackDeadlineSeconds || 600,
        };

        // Configure dead letter queue if specified
        if (
          subscriptionOptions.deadLetterTopicName &&
          subscriptionOptions.maxDeliveryAttempts
        ) {
          // Ensure dead letter topic exists
          await this.ensureTopicExists(subscriptionOptions.deadLetterTopicName);

          subOptions.deadLetterPolicy = {
            deadLetterTopic: this.pubSubClient.topic(
              subscriptionOptions.deadLetterTopicName,
            ).name,
            maxDeliveryAttempts: subscriptionOptions.maxDeliveryAttempts,
          };
        }

        await this.pubSubClient
          .topic(topicName)
          .createSubscription(subscriptionName, subOptions);
        console.log(`Subscription ${subscriptionName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get topic statistics
   */
  async getTopicStats(topicName: string): Promise<any> {
    try {
      const topic = this.pubSubClient.topic(topicName);
      const [metadata] = await topic.getMetadata();
      return metadata;
    } catch (error) {
      console.error(`Error getting topic stats for ${topicName}:`, error);
      throw error;
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats(subscriptionName: string): Promise<any> {
    try {
      const subscription = this.pubSubClient.subscription(subscriptionName);
      const [metadata] = await subscription.getMetadata();
      return metadata;
    } catch (error) {
      console.error(
        `Error getting subscription stats for ${subscriptionName}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * List all topics in the project
   */
  async listTopics(): Promise<string[]> {
    try {
      const [topics] = await this.pubSubClient.getTopics();
      return topics.map((topic) => topic.name);
    } catch (error) {
      console.error('Error listing topics:', error);
      throw error;
    }
  }

  /**
   * List all subscriptions in the project
   */
  async listSubscriptions(): Promise<string[]> {
    try {
      const [subscriptions] = await this.pubSubClient.getSubscriptions();
      return subscriptions.map((sub) => sub.name);
    } catch (error) {
      console.error('Error listing subscriptions:', error);
      throw error;
    }
  }

  /**
   * Delete a topic
   */
  async deleteTopic(topicName: string): Promise<void> {
    try {
      await this.pubSubClient.topic(topicName).delete();
      console.log(`Topic ${topicName} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting topic ${topicName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionName: string): Promise<void> {
    try {
      await this.pubSubClient.subscription(subscriptionName).delete();
      console.log(`Subscription ${subscriptionName} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting subscription ${subscriptionName}:`, error);
      throw error;
    }
  }

  /**
   * Get real-time metrics for a subscription
   */
  getMetrics(subscriptionName: string): SubscriptionMetrics | null {
    return getSubscriptionMetrics(subscriptionName);
  }

  /**
   * Health check for the PubSub service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      // Try to list topics to verify connectivity
      await this.pubSubClient.getTopics({ pageSize: 1 });
      return {
        status: 'healthy',
        details: {
          projectId: this.projectId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          projectId: this.projectId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

// Export types for external use
export type {
  PublishOptions,
  TopicOptions,
  ProcessPubSubMessagesOptions,
  SubscriptionMetrics,
};

// Export the processPubSubMessages function for standalone use
export { processPubSubMessages, getSubscriptionMetrics };
