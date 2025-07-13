import { Router as createRouter } from 'express';
// import fetch from 'node-fetch';
import logger from '../services/firebase/logger';
import { getSecret } from '../services/gcp/secretManager';
import {
  getRtdbValue,
  setRtdbValue,
  pushRtdbValue,
} from '../services/firebase/rtdb';
// import prismaInstance from '../services/prisma';

const router = createRouter();

router.get('/', async (req, res) => {
  try {
    const testSecret = await getSecret('NEXT_PUBLIC_FIREBASE_BACKEND_URL');

    logger.info(`Healthcheck endpoint hit
 secret_manager:NEXT_PUBLIC_FIREBASE_BACKEND_URL: ${JSON.stringify(testSecret)}
    | env: ${process.env.GCP_PROJECT_NUMBER}`);

    // Test RTDB functionality
    const timestamp = Date.now();
    const testPath = `healthcheck/test-${timestamp}`;
    const testData = {
      message: 'RTDB test successful',
      timestamp,
      environment: process.env.NODE_ENV || 'unknown',
      projectId: process.env.GCP_PROJECT_ID || 'unknown',
    };

    // Test setRtdbValue
    await setRtdbValue(testPath, testData);
    logger.info('RTDB setValue test completed', { path: testPath });

    // Test getRtdbValue
    const retrievedData = await getRtdbValue(testPath);
    logger.info('RTDB getValue test completed', {
      path: testPath,
      dataMatches: JSON.stringify(retrievedData) === JSON.stringify(testData),
    });

    // Test with nested path
    const nestedPath = `healthcheck/nested/deep/path-${timestamp}`;
    const nestedData = { level: 'deep', working: true };
    await setRtdbValue(nestedPath, nestedData);
    const retrievedNestedData = await getRtdbValue(nestedPath);

    // Test pushRtdbValue (adds items to a list with auto-generated keys)
    const listPath = `healthcheck/test-list-${timestamp}`;
    const pushItem1 = { item: 'first', index: 1, timestamp };
    const pushItem2 = { item: 'second', index: 2, timestamp };

    const generatedKey1 = await pushRtdbValue(listPath, pushItem1);
    const generatedKey2 = await pushRtdbValue(listPath, pushItem2);

    logger.info('RTDB pushValue test completed', {
      listPath,
      generatedKeys: [generatedKey1, generatedKey2],
    });

    // Retrieve the entire list to verify push operations
    const retrievedList = await getRtdbValue(listPath);
    const listKeys = retrievedList ? Object.keys(retrievedList) : [];

    // Cleanup test data (optional)
    // await setRtdbValue(testPath, null); // Delete test data
    // await setRtdbValue(nestedPath, null); // Delete nested test data
    // await setRtdbValue(listPath, null); // Delete push test data

    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      rtdb: {
        setValue: 'working',
        getValue: 'working',
        nestedPaths: 'working',
        pushValue: 'working',
        testData: retrievedData,
        nestedTestData: retrievedNestedData,
        pushTestData: {
          generatedKeys: [generatedKey1, generatedKey2],
          listItemCount: listKeys.length,
          retrievedList: retrievedList,
        },
      },
      secretManager: testSecret ? 'working' : 'error',
      environment: process.env.NODE_ENV || 'unknown',
    };

    res.json(response);
  } catch (error) {
    logger.error('Healthcheck failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
