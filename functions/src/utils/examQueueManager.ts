import logger from '../services/firebase/logger';
import {
  ensureQueueExists,
  checkQueueExists,
} from '../services/gcp/cloudTasks';

// Standard queue names used throughout the application
export const EXAM_QUEUE_NAMES = {
  EXAM_QUESTIONS: 'exam-questions-queue',
  KNOWLEDGE_POOLING: 'knowledge-pooling-queue',
  EXAM_REPORTS: 'exam-reports-queue',
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
 * Ensures the knowledge pooling queue exists
 * This is called before creating knowledge pooling tasks
 */
export async function ensureKnowledgePoolingQueuesExist(): Promise<void> {
  try {
    logger.info('Ensuring knowledge pooling queues exist...');

    // Ensure the knowledge pooling queue exists
    await ensureQueueExists(EXAM_QUEUE_NAMES.KNOWLEDGE_POOLING);

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
 * Ensures the exam report queue exists
 * This is called before creating exam report tasks
 */
export async function ensureExamReportQueuesExist(): Promise<void> {
  try {
    logger.info('Ensuring exam report queues exist...');

    // Ensure the exam report queue exists
    await ensureQueueExists(EXAM_QUEUE_NAMES.EXAM_REPORTS);

    logger.info('All exam report queues verified/created successfully');
  } catch (error) {
    logger.error('Failed to ensure exam report queues exist:', {
      error: error instanceof Error ? error.message : String(error),
      structuredData: true,
    });
    throw new Error(
      `Exam report queue setup failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

/**
 * Ensures all application queues exist
 */
export async function ensureAllQueuesExist(): Promise<void> {
  try {
    logger.info('Ensuring all application queues exist...');

    // Ensure exam-related queues
    await ensureExamQueuesExist();

    // Ensure knowledge pooling queues
    await ensureKnowledgePoolingQueuesExist();

    // Ensure exam report queues
    await ensureExamReportQueuesExist();

    logger.info('All application queues verified/created successfully');
  } catch (error) {
    logger.error('Failed to ensure all queues exist:', {
      error: error instanceof Error ? error.message : String(error),
      structuredData: true,
    });
    throw new Error(
      `Application queue setup failed: ${
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
  knowledgePoolingQueue: boolean;
  examReportsQueue: boolean;
  allQueuesHealthy: boolean;
}> {
  try {
    const examQuestionsExists = await checkQueueExists(
      EXAM_QUEUE_NAMES.EXAM_QUESTIONS,
    );
    const knowledgePoolingExists = await checkQueueExists(
      EXAM_QUEUE_NAMES.KNOWLEDGE_POOLING,
    );
    const examReportsExists = await checkQueueExists(
      EXAM_QUEUE_NAMES.EXAM_REPORTS,
    );

    const result = {
      examQuestionsQueue: examQuestionsExists,
      knowledgePoolingQueue: knowledgePoolingExists,
      examReportsQueue: examReportsExists,
      allQueuesHealthy:
        examQuestionsExists && knowledgePoolingExists && examReportsExists,
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
      knowledgePoolingQueue: false,
      examReportsQueue: false,
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

  if (!health.examQuestionsQueue) {
    logger.warn(
      'Exam queue is not healthy, attempting to create missing queue...',
    );
    await ensureExamQueuesExist();

    // Re-check after attempting to create
    const recheckHealth = await checkExamQueueHealth();
    if (!recheckHealth.examQuestionsQueue) {
      throw new Error('Failed to ensure exam generation queue is ready');
    }
  }

  logger.info('Exam generation queue is ready');
}

/**
 * Validates that knowledge pooling queue exists
 * Throws an error if the queue is missing and cannot be created
 */
export async function validateKnowledgePoolingQueueReadiness(): Promise<void> {
  const health = await checkExamQueueHealth();

  if (!health.knowledgePoolingQueue) {
    logger.warn(
      'Knowledge pooling queue is not healthy, attempting to create missing queue...',
    );
    await ensureKnowledgePoolingQueuesExist();

    // Re-check after attempting to create
    const recheckHealth = await checkExamQueueHealth();
    if (!recheckHealth.knowledgePoolingQueue) {
      throw new Error('Failed to ensure knowledge pooling queue is ready');
    }
  }

  logger.info('Knowledge pooling queue is ready');
}

/**
 * Validates that exam report queue exists
 * Throws an error if the queue is missing and cannot be created
 */
export async function validateExamReportQueueReadiness(): Promise<void> {
  const health = await checkExamQueueHealth();

  if (!health.examReportsQueue) {
    logger.warn(
      'Exam report queue is not healthy, attempting to create missing queue...',
    );
    await ensureExamReportQueuesExist();

    // Re-check after attempting to create
    const recheckHealth = await checkExamQueueHealth();
    if (!recheckHealth.examReportsQueue) {
      throw new Error('Failed to ensure exam report queue is ready');
    }
  }

  logger.info('Exam report queue is ready');
}

/**
 * Validates that all application queues exist
 * Throws an error if any critical queues are missing and cannot be created
 */
export async function validateAllQueuesReadiness(): Promise<void> {
  const health = await checkExamQueueHealth();

  if (!health.allQueuesHealthy) {
    logger.warn(
      'Some queues are not healthy, attempting to create missing queues...',
    );
    await ensureAllQueuesExist();

    // Re-check after attempting to create
    const recheckHealth = await checkExamQueueHealth();
    if (!recheckHealth.allQueuesHealthy) {
      throw new Error('Failed to ensure all application queues are ready');
    }
  }

  logger.info('All application queues are ready');
}
