import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from 'firebase-functions/v1';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const GCP_REGION = process.env.GCP_REGION || '';

const cloudTasksClient = new CloudTasksClient();

interface CreateCloudTaskPayload {
  [key: string]: string | number | boolean | undefined | object | any[];
}

/**
 * Creates a Cloud Task to be processed asynchronously.
 *
 * @param {string} relativeUri The relative URI of the HTTP target for the task.
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
