import logger from '../firebase/logger';
import { ensureQueueExists, checkQueueExists } from '../gcp/cloudTasks';

// Standard queue names used throughout the application
export const CLOUD_TASK_QUEUE_NAMES = {
  EXAM_QUESTIONS: 'exam-questions-queue',
  KNOWLEDGE_POOLING: 'knowledge-pooling-queue',
} as const;

/**
 * Cloud Task Queue Manager
 * Provides centralized queue management for all cloud task types
 */
export class CloudTaskQueueManager {
  private static instance: CloudTaskQueueManager;

  public static getInstance(): CloudTaskQueueManager {
    if (!CloudTaskQueueManager.instance) {
      CloudTaskQueueManager.instance = new CloudTaskQueueManager();
    }
    return CloudTaskQueueManager.instance;
  }

  /**
   * Ensures all application queues exist
   */
  public async ensureAllQueuesExist(): Promise<void> {
    try {
      logger.info('Ensuring all application queues exist...');

      // Ensure exam generation queue exists
      await ensureQueueExists(CLOUD_TASK_QUEUE_NAMES.EXAM_QUESTIONS);

      // Ensure knowledge pooling queue exists
      await ensureQueueExists(CLOUD_TASK_QUEUE_NAMES.KNOWLEDGE_POOLING);

      logger.info('All application queues verified/created successfully');
    } catch (error) {
      logger.error('Failed to ensure application queues exist:', {
        error: error instanceof Error ? error.message : String(error),
        structuredData: true,
      });
      throw new Error(
        `Queue setup failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Ensures exam-related queues exist
   */
  public async ensureExamQueuesExist(): Promise<void> {
    try {
      logger.info('Ensuring exam generation queues exist...');

      // Ensure the main exam questions queue exists
      await ensureQueueExists(CLOUD_TASK_QUEUE_NAMES.EXAM_QUESTIONS);

      logger.info('All exam generation queues verified/created successfully');
    } catch (error) {
      logger.error('Failed to ensure exam queues exist:', {
        error: error instanceof Error ? error.message : String(error),
        structuredData: true,
      });
      throw new Error(
        `Exam queue setup failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Ensures knowledge pooling queues exist
   */
  public async ensureKnowledgePoolingQueuesExist(): Promise<void> {
    try {
      logger.info('Ensuring knowledge pooling queues exist...');

      // Ensure the knowledge pooling queue exists
      await ensureQueueExists(CLOUD_TASK_QUEUE_NAMES.KNOWLEDGE_POOLING);

      logger.info('All knowledge pooling queues verified/created successfully');
    } catch (error) {
      logger.error('Failed to ensure knowledge pooling queues exist:', {
        error: error instanceof Error ? error.message : String(error),
        structuredData: true,
      });
      throw new Error(
        `Knowledge pooling queue setup failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Checks the health status of all application queues
   */
  public async checkAllQueuesHealth(): Promise<{
    examQuestionsQueue: boolean;
    knowledgePoolingQueue: boolean;
    allQueuesHealthy: boolean;
  }> {
    try {
      const examQuestionsExists = await checkQueueExists(
        CLOUD_TASK_QUEUE_NAMES.EXAM_QUESTIONS,
      );
      const knowledgePoolingExists = await checkQueueExists(
        CLOUD_TASK_QUEUE_NAMES.KNOWLEDGE_POOLING,
      );

      const result = {
        examQuestionsQueue: examQuestionsExists,
        knowledgePoolingQueue: knowledgePoolingExists,
        allQueuesHealthy: examQuestionsExists && knowledgePoolingExists,
      };

      if (!result.allQueuesHealthy) {
        logger.warn('Some application queues are missing or unhealthy', result);
      }

      return result;
    } catch (error) {
      logger.error('Failed to check application queue health:', {
        error: error instanceof Error ? error.message : String(error),
        structuredData: true,
      });
      return {
        examQuestionsQueue: false,
        knowledgePoolingQueue: false,
        allQueuesHealthy: false,
      };
    }
  }

  /**
   * Validates that all required queues exist before starting operations
   */
  public async validateAllQueuesReadiness(): Promise<void> {
    const health = await this.checkAllQueuesHealth();

    if (!health.allQueuesHealthy) {
      logger.warn(
        'Some queues are not healthy, attempting to create missing queues...',
      );
      await this.ensureAllQueuesExist();

      // Re-check after attempting to create
      const recheckHealth = await this.checkAllQueuesHealth();
      if (!recheckHealth.allQueuesHealthy) {
        throw new Error('Failed to ensure all application queues are ready');
      }
    }

    logger.info('All application queues are ready');
  }

  /**
   * Validates exam queue readiness (backward compatibility)
   */
  public async validateExamQueueReadiness(): Promise<void> {
    const health = await this.checkAllQueuesHealth();

    if (!health.examQuestionsQueue) {
      logger.warn(
        'Exam queue is not healthy, attempting to create missing queue...',
      );
      await this.ensureExamQueuesExist();

      // Re-check after attempting to create
      const recheckHealth = await this.checkAllQueuesHealth();
      if (!recheckHealth.examQuestionsQueue) {
        throw new Error('Failed to ensure exam generation queue is ready');
      }
    }

    logger.info('Exam generation queue is ready');
  }

  /**
   * Validates knowledge pooling queue readiness
   */
  public async validateKnowledgePoolingQueueReadiness(): Promise<void> {
    const health = await this.checkAllQueuesHealth();

    if (!health.knowledgePoolingQueue) {
      logger.warn(
        'Knowledge pooling queue is not healthy, attempting to create missing queue...',
      );
      await this.ensureKnowledgePoolingQueuesExist();

      // Re-check after attempting to create
      const recheckHealth = await this.checkAllQueuesHealth();
      if (!recheckHealth.knowledgePoolingQueue) {
        throw new Error('Failed to ensure knowledge pooling queue is ready');
      }
    }

    logger.info('Knowledge pooling queue is ready');
  }
}
