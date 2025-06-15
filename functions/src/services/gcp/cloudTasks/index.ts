import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from 'firebase-functions/v1';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const GCP_REGION = process.env.GCP_REGION || '';

const cloudTasksClient = new CloudTasksClient();

interface CreateCloudTaskPayload {
  [key: string]: string | number | boolean | undefined;
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
      'Missing required environment variables for Cloud Tasks: GCP_PROJECT, GCP_REGION',
    );
    return undefined;
  }

  // Construct the fully qualified queue name.
  const parent = cloudTasksClient.queuePath(
    GCP_PROJECT_ID,
    GCP_REGION,
    queueName,
  );

  const serviceAccountEmail = process.env.GCP_TASKS_SERVICE_ACCOUNT;
  const audience = `https://${GCP_REGION}-${GCP_PROJECT_ID}.cloudfunctions.net/delegators`;

  logger.info(`Creating Cloud Task for queue: ${queueName}, URL: ${url}
    | serviceAccountEmail: ${serviceAccountEmail}
    | audience: ${audience}`);

  // Construct the task body.
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
        audience,
      },
    },
    scheduleTime: scheduleTimeInSeconds
      ? { seconds: scheduleTimeInSeconds + Date.now() / 1000 }
      : undefined,
  };

  try {
    // Send create task request.
    logger.info(`Sending task: ${JSON.stringify(task)}`);
    const [response] = await cloudTasksClient.createTask({ parent, task });
    logger.info(`Created task ${response.name}`);
    return response.name || undefined;
  } catch (error) {
    logger.error('Error creating Cloud Task:', error);
    return undefined;
  }
};
