import { PubSub } from '@google-cloud/pubsub';

function createMessageOption(
  messageBody: string | Record<string, any>,
): { data: Buffer } | null {
  let dataBuffer: Buffer;

  if (typeof messageBody === 'string') {
    dataBuffer = Buffer.from(messageBody);
  } else if (typeof messageBody === 'object' && messageBody !== null) {
    dataBuffer = Buffer.from(JSON.stringify(messageBody));
  } else {
    console.warn('Invalid message type. Skipping message:', messageBody);
    return null;
  }
  return { data: dataBuffer };
}

/**
 * Core function to publish messages to a specified Pub/Sub topic.
 * This function is used internally by both public functions.
 *
 * @param topicName The name of the Pub/Sub topic (e.g., 'my-topic').
 * @param messages An array of messages to publish.
 * @returns A Promise that resolves to an array of message IDs.
 */
async function publishMessages(
  topicName: string,
  messages: Array<string | Record<string, any>>,
): Promise<string[]> {
  const pubSubClient = new PubSub();

  // Ensure the topic exists before publishing messages
  await ensureTopicExists(pubSubClient, topicName);

  const topic = pubSubClient.topic(topicName);

  const messagePromises: Promise<string>[] = messages.map(
    async (messageBody) => {
      const messageOption = createMessageOption(messageBody);

      if (!messageOption) {
        // Warning already logged by createMessageOption
        return ''; // Resolve with an empty string for skipped messages
      }

      // Publishes the message
      const messageId = await topic.publishMessage(messageOption);
      console.log(`Message ${messageId} published to ${topicName}.`);
      return messageId;
    },
  );

  const messageIds = await Promise.all(messagePromises);
  // Filter out any empty strings if we skipped messages
  return messageIds.filter((id) => id !== '');
}

/**
 * Ensures that a Pub/Sub topic exists. If the topic does not exist, it creates the topic.
 *
 * @param pubSubClient The PubSub client instance.
 * @param topicName The name of the Pub/Sub topic to check or create.
 * @returns A Promise that resolves when the topic exists (or has been created).
 */
async function ensureTopicExists(
  pubSubClient: PubSub,
  topicName: string,
): Promise<void> {
  const [topics] = await pubSubClient.getTopics();
  const topicExists = topics.some((topic) => topic.name.endsWith(topicName));

  if (!topicExists) {
    console.log(`Topic ${topicName} does not exist. Creating...`);
    await pubSubClient.createTopic(topicName);
    console.log(`Topic ${topicName} created successfully.`);
  } else {
    console.log(`Topic ${topicName} already exists.`);
  }
}

/**
 * Publishes multiple messages to a specified Pub/Sub topic.
 *
 * @param topicName The name of the Pub/Sub topic (e.g., 'my-topic').
 * @param messages An array of messages to publish. Each message can be a string or an object.
 *                 Objects will be JSON.stringified.
 * @returns A Promise that resolves to an array of message IDs for the published messages.
 * @throws Error if publishing fails.
 */
export async function publishPubSubMessages(
  topicName: string,
  messages: Array<string | Record<string, any>>,
): Promise<string[]> {
  try {
    return await publishMessages(topicName, messages);
  } catch (error) {
    console.error(
      `Received error while publishing messages to ${topicName}:`,
      error,
    );
    throw error;
  }
}

/*
Example Usage:

async function example() {
  const TOPIC_NAME = 'your-topic-name'; // Replace with your topic name

  try {
    // Example with individual publishing
    const messageIds1 = await publishPubSubMessages(TOPIC_NAME, [
      'Hello, Pub/Sub!',
      { user: 'Alice', action: 'login' },
      'Another text message'
    ]);
    console.log('Published message IDs (individual):', messageIds1);
  } catch (error) {
    console.error('Failed to publish messages:', error);
  }
}

// Call the example function if you want to test it directly
// example();
*/
