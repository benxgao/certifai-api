import 'dotenv/config';

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

import apiEndpoints from './endpoints';
import serviceDelegators from './delegators';

// Import scheduled functions
import {
  automatedStuckExamCleanup,
  autoFailStuckExams,
} from './scheduledFunctions/examGenerationMonitoring';
import { isProduction } from './utils/utils';

setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
});

export const endpoints = onRequest(
  {
    memory: isProduction ? '512MiB' : '256MiB',
    timeoutSeconds: 180,
  },
  apiEndpoints,
);

export const delegators = onRequest(
  {
    memory: isProduction ? '512MiB' : '256MiB',
    timeoutSeconds: 180,
  },
  serviceDelegators,
);

// Export scheduled functions
export { automatedStuckExamCleanup, autoFailStuckExams };
