import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from 'firebase-functions/v1';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const GCP_REGION = process.env.GCP_REGION || '';

const cloudTasksClient = new CloudTasksClient();

// Queue configuration constants
const QUEUE_CONFIG = {
  maxDispatchesPerSecond: 10,
  retryConfig: {
    maxRetryDuration: { seconds: 86400 }, // 24 hours
    minBackoff: { seconds: 10 },
    maxBackoff: { seconds: 300 },
    maxDoublings: 5,
  },
};

interface CreateCloudTaskPayload {
  [key: string]: string | number | boolean | undefined | object | any[];
}

/**
 * Checks if a Cloud Tasks queue exists
 */
async function queueExists(queueName: string): Promise<boolean> {
  try {
    const queuePath = cloudTasksClient.queuePath(
      GCP_PROJECT_ID,
      GCP_REGION,
      queueName,
    );

    await cloudTasksClient.getQueue({ name: queuePath });
    return true;
  } catch (error: any) {
    if (error.code === 5) {
      // NOT_FOUND
      return false;
    }
    // Re-throw other errors (permissions, etc.)
    throw error;
  }
}

/**
 * Creates a Cloud Tasks queue with the specified configuration
 */
async function createQueue(queueName: string): Promise<void> {
  const parent = cloudTasksClient.locationPath(GCP_PROJECT_ID, GCP_REGION);
  const queuePath = cloudTasksClient.queuePath(
    GCP_PROJECT_ID,
    GCP_REGION,
    queueName,
  );

  const queue = {
    name: queuePath,
    rateLimits: {
      maxDispatchesPerSecond: QUEUE_CONFIG.maxDispatchesPerSecond,
    },
    retryConfig: QUEUE_CONFIG.retryConfig,
  };

  try {
    logger.info(`Creating Cloud Tasks queue: ${queueName} in ${GCP_REGION}`);
    await cloudTasksClient.createQueue({
      parent,
      queue,
    });
    logger.info(`Successfully created Cloud Tasks queue: ${queueName}`);
  } catch (error: any) {
    if (error.code === 6) {
      logger.info(`Queue ${queueName} already exists, continuing...`);
      return;
    }
    logger.error(`Failed to create queue ${queueName}:`, error);
    throw error;
  }
}

/**
 * Ensures a Cloud Tasks queue exists, creating it if necessary
 */
export async function ensureQueueExists(queueName: string): Promise<void> {
  try {
    const exists = await queueExists(queueName);

    if (!exists) {
      logger.info(`Queue ${queueName} does not exist, creating it...`);
      await createQueue(queueName);
    } else {
      logger.info(`Queue ${queueName} already exists`);
    }
  } catch (error) {
    logger.error(`Failed to ensure queue ${queueName} exists:`, error);
    throw error;
  }
}

/**
 * Checks if a Cloud Tasks queue exists
 */
export async function checkQueueExists(queueName: string): Promise<boolean> {
  return queueExists(queueName);
}

/**
 * Creates a Cloud Tasks queue with the specified configuration
 */
export async function createCloudTasksQueue(queueName: string): Promise<void> {
  return createQueue(queueName);
}

/**
 * Creates a Cloud Task to be processed asynchronously.
 * Ensures the queue exists before creating the task.
 *
 * @param {string} queueName The name of the Cloud Tasks queue.
 * @param {string} url The URL endpoint for the task.
 * @param {CreateCloudTaskPayload} payload The payload to send with the task.
 * @param {number} [scheduleTimeInSeconds] Optional. The time in seconds from now to schedule the task.
 * @returns {Promise<string | undefined>} The task name if successful, otherwise undefined.
 */
export const createCloudTask = async (
  queueName: string,
  url: string,
  payload: CreateCloudTaskPayload,
  scheduleTimeInSeconds?: number,
): Promise<string | undefined> => {
  if (!GCP_PROJECT_ID || !GCP_REGION) {
    logger.error(
      'Missing required environment variables for Cloud Tasks: GCP_PROJECT_ID, GCP_REGION',
    );
    return undefined;
  }

  const serviceAccountEmail = process.env.GCP_TASKS_SERVICE_ACCOUNT;
  if (!serviceAccountEmail) {
    logger.error(
      'Missing required environment variable: GCP_TASKS_SERVICE_ACCOUNT',
    );
    return undefined;
  }

  try {
    // Ensure the queue exists before creating the task
    await ensureQueueExists(queueName);
  } catch (error) {
    logger.error(
      `Failed to ensure queue ${queueName} exists before creating task:`,
      error,
    );
    return undefined;
  }

  // Construct the fully qualified queue name.
  const parent = cloudTasksClient.queuePath(
    GCP_PROJECT_ID,
    GCP_REGION,
    queueName,
  );

  // Use the exact audience URL that matches the protected function
  const audience = `https://${GCP_REGION}-${GCP_PROJECT_ID}.cloudfunctions.net/delegators`;

  logger.info(`Creating Cloud Task for queue: ${queueName}, URL: ${url}
    | serviceAccountEmail: ${serviceAccountEmail}
    | audience: ${audience}`);

  // Construct the task body with OIDC authentication for protected Cloud Functions
  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      url,
      oidcToken: {
        serviceAccountEmail,
        audience, // Must match exactly: https://us-central1-certifai-prod.cloudfunctions.net/delegators
      },
    },
    scheduleTime: scheduleTimeInSeconds
      ? { seconds: scheduleTimeInSeconds + Date.now() / 1000 }
      : undefined,
  };

  try {
    // Send create task request with authentication
    logger.info(`Sending authenticated task: ${JSON.stringify(task, null, 2)}`);
    const [response] = await cloudTasksClient.createTask({ parent, task });
    logger.info(`Successfully created authenticated task ${response.name}`);
    return response.name || undefined;
  } catch (error) {
    logger.error('Error creating authenticated Cloud Task:', error);
    // Log specific authentication errors if they occur
    if (error instanceof Error && error.message.includes('permission')) {
      logger.error(
        'Authentication Error: Ensure the service account has Cloud Tasks Enqueuer and Cloud Functions Invoker roles',
      );
    }
    return undefined;
  }
};
