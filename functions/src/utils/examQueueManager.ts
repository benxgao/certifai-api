import logger from '../services/firebase/logger';
import {
  ensureQueueExists,
  checkQueueExists,
} from '../services/gcp/cloudTasks';

// Standard queue names used throughout the application
export const EXAM_QUEUE_NAMES = {
  EXAM_QUESTIONS: 'exam-questions-queue',
  // Add other queue names here as needed
} as const;

/**
 * Ensures the exam questions queue exists before exam creation
 * This is called during exam creation to prevent failures due to missing queues
 */
export async function ensureExamQueuesExist(): Promise<void> {
  try {
    logger.info('Ensuring exam generation queues exist...');

    // Ensure the main exam questions queue exists
    await ensureQueueExists(EXAM_QUEUE_NAMES.EXAM_QUESTIONS);

    logger.info('All exam generation queues verified/created successfully');
  } catch (error) {
    logger.error('Failed to ensure exam queues exist:', {
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
 * Checks the health status of all exam-related queues
 * Returns a summary of queue health for monitoring purposes
 */
export async function checkExamQueueHealth(): Promise<{
  examQuestionsQueue: boolean;
  allQueuesHealthy: boolean;
}> {
  try {
    const examQuestionsExists = await checkQueueExists(
      EXAM_QUEUE_NAMES.EXAM_QUESTIONS,
    );

    const result = {
      examQuestionsQueue: examQuestionsExists,
      allQueuesHealthy: examQuestionsExists,
    };

    if (!result.allQueuesHealthy) {
      logger.warn('Some exam queues are missing or unhealthy', result);
    }

    return result;
  } catch (error) {
    logger.error('Failed to check exam queue health:', {
      error: error instanceof Error ? error.message : String(error),
      structuredData: true,
    });
    return {
      examQuestionsQueue: false,
      allQueuesHealthy: false,
    };
  }
}

/**
 * Validates that all required queues exist before starting exam generation
 * Throws an error if any critical queues are missing and cannot be created
 */
export async function validateExamQueueReadiness(): Promise<void> {
  const health = await checkExamQueueHealth();

  if (!health.allQueuesHealthy) {
    logger.warn(
      'Some queues are not healthy, attempting to create missing queues...',
    );
    await ensureExamQueuesExist();

    // Re-check after attempting to create
    const recheckHealth = await checkExamQueueHealth();
    if (!recheckHealth.allQueuesHealthy) {
      throw new Error(
        'Failed to ensure all exam queues are ready for exam generation',
      );
    }
  }

  logger.info('All exam queues are ready for exam generation');
}
