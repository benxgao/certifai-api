import { processPubSubMessages } from './subscribe';
import { handleExamQuestionsGeneration } from './examQuestionsHandler';
import logger from '../../firebase/logger';

const EXAM_QUESTIONS_GENERATION_SUBSCRIPTION =
  'generate-exam-questions-subscription';
const EXAM_QUESTIONS_GENERATION_TOPIC_NAME = 'generate-exam-questions-topic';

interface QuestionGenerationMessage {
  exam_id: string;
  cert_id: number;
  certification_name: string;
  number_of_questions_to_generate: number;
}

// Start the exam questions generation subscriber
export const startExamQuestionsSubscriber = async (): Promise<void> => {
  logger.info('Starting exam questions generation subscriber...');

  try {
    await processPubSubMessages(
      EXAM_QUESTIONS_GENERATION_SUBSCRIPTION,
      async (messageBody: QuestionGenerationMessage) => {
        await handleExamQuestionsGeneration(messageBody);
      },
      {
        maxMessages: 5, // Process up to 5 messages concurrently
        pullIntervalMs: 2000, // Pull every 2 seconds if no messages
        concurrency: 3, // Process up to 3 messages in parallel
        ackDeadlineSeconds: 600, // 10 minutes to process each message
        maxRetries: 3,
        exponentialBackoff: true,
        createSubscriptionIfNotExists: true,
        topicName: EXAM_QUESTIONS_GENERATION_TOPIC_NAME,
        maxDeliveryAttempts: 5,
      },
    );
  } catch (error) {
    logger.error('Critical error in exam questions subscriber:', error as any);
    throw error;
  }
};

// Export for use in Cloud Functions or other services
export { handleExamQuestionsGeneration };
