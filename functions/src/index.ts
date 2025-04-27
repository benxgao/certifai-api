import { onRequest } from 'firebase-functions/v2/https';

import apiEndpoints from './endpoints';

// const vpcConnectorOptions: HttpsOptions = {
//   vpcConnector: 'firebase-connector',
//   vpcConnectorEgressSettings: 'ALL_TRAFFIC',
// };
// export const endpoints = onRequest(vpcConnectorOptions, apiEndpoints);

export const endpoints = onRequest(apiEndpoints);
