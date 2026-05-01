import logger from '../firebase/logger';
import { createCloudTask } from '../gcp/cloudTasks';

/**
 * Base Cloud Task Service
 * Provides reusable methods for creating and managing cloud tasks
 */
export abstract class BaseCloudTaskService {
  protected abstract getQueueName(): string;
  protected abstract getTaskEndpoint(): string;

  /**
   * Creates a cloud task with the specified payload
   * @param payload - The payload to send with the task
   * @param scheduleTimeInSeconds - Optional delay in seconds
   * @returns Task name if successful, undefined otherwise
   */
  protected async createTask<TPayload extends object>(
    payload: TPayload,
    scheduleTimeInSeconds?: number,
  ): Promise<string | undefined> {
    const queueName = this.getQueueName();
    const endpoint = this.getTaskEndpoint();

    logger.info(`16. CLOUD_TASK: CREATING: for ${this.constructor.name}`, {
      queue: queueName,
      endpoint,
      payload_keys: Object.keys(payload),
      schedule_delay: scheduleTimeInSeconds,
      structuredData: true,
    });

    try {
      const taskName = await createCloudTask(
        queueName,
        endpoint,
        payload as Record<string, unknown>,
        scheduleTimeInSeconds,
      );

      if (taskName) {
        logger.info(`17. CLOUD_TASK: CREATED: for ${this.constructor.name}`,
          {
            task_name: taskName,
            queue: queueName,
            structuredData: true,
          },
        );
      } else {
        logger.error(
          `Failed to create cloud task for ${this.constructor.name}`,
          {
            queue: queueName,
            endpoint,
            structuredData: true,
          },
        );
      }

      return taskName;
    } catch (error) {
      logger.error(`Error creating cloud task for ${this.constructor.name}`, {
        error: error instanceof Error ? error.message : String(error),
        queue: queueName,
        endpoint,
        structuredData: true,
      });
      return undefined;
    }
  }

  /**
   * Validates that required environment variables are set
   */
  protected validateEnvironment(): boolean {
    const requiredEnvVars = [
      'GCP_PROJECT_ID',
      'GCP_REGION',
      'GCP_TASKS_SERVICE_ACCOUNT',
      'GCP_TASKS_HOST',
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );

    if (missingVars.length > 0) {
      logger.error(
        `Missing required environment variables for ${this.constructor.name}`,
        {
          missing_variables: missingVars,
          structuredData: true,
        },
      );
      return false;
    }

    return true;
  }
}
