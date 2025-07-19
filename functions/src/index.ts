import 'dotenv/config';

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

import apiEndpoints from './endpoints';
import serviceDelegators from './delegators';

// Import scheduled functions
import {
  collectExamGenerationMetrics,
  dailyExamGenerationReport,
  automatedStuckExamCleanup,
  autoFailStuckExams,
} from './scheduledFunctions/examGenerationMonitoring';

setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
});

export const endpoints = onRequest(
  {
    memory: '512MiB',
  },
  apiEndpoints,
);

export const delegators = onRequest(
  {
    timeoutSeconds: 180,
  },
  serviceDelegators,
);

// Export scheduled functions
export {
  collectExamGenerationMetrics,
  dailyExamGenerationReport,
  automatedStuckExamCleanup,
  autoFailStuckExams,
};
