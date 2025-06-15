import 'dotenv/config';

import { onRequest } from 'firebase-functions/v2/https';
// import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { setGlobalOptions } from 'firebase-functions/v2';
// import { handleExamQuestionsGeneration } from './services/gcp/pubsub/examQuestionsHandler';
// import logger from './services/firebase/logger';

import apiEndpoints from './endpoints';
import serviceDelegators from './delegators';

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1', // Adjust to your preferred region
});

// const EXAM_QUESTIONS_GENERATION_TOPIC_NAME = 'generate-exam-questions-topic';

// HTTP endpoints
// const vpcConnectorOptions: HttpsOptions = {
//   vpcConnector: 'firebase-connector',
//   vpcConnectorEgressSettings: 'ALL_TRAFFIC',
// };
// export const endpoints = onRequest(vpcConnectorOptions, apiEndpoints);

export const endpoints = onRequest(apiEndpoints);

export const delegators = onRequest(serviceDelegators);

// Pub/Sub triggered function for exam question generation
// export const generateAndStoreExamQuestions = onMessagePublished(
//   EXAM_QUESTIONS_GENERATION_TOPIC_NAME,
//   async (event) => {
//     logger.info(
//       `Received message from Pub/Sub topic ${EXAM_QUESTIONS_GENERATION_TOPIC_NAME}`,
//       {
//         messageId: event.id,
//       },
//     );

//     try {
//       // Parse the message data
//       const messageData = event.data.message.json;

//       // Type validation could be added here
//       if (
//         !messageData.exam_id ||
//         !messageData.cert_id ||
//         !messageData.certification_name
//       ) {
//         throw new Error('Invalid message format: missing required fields');
//       }

//       await handleExamQuestionsGeneration(messageData);

//       logger.info(`Successfully processed message ${event.id}`);
//     } catch (error) {
//       logger.error(
//         `Error processing Pub/Sub message ${event.id}:`,
//         error as any,
//       );
//       // Firebase will automatically retry or move to dead letter topic based on function configuration
//       throw error;
//     }
//   },
// );
