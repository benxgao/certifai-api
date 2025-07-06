import 'dotenv/config';

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

import apiEndpoints from './endpoints';
import serviceDelegators from './delegators';

setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
});

export const endpoints = onRequest(apiEndpoints);

export const delegators = onRequest(
  {
    timeoutSeconds: 180,
  },
  serviceDelegators,
);
