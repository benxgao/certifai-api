import { Router as createRouter } from 'express';
import { defineSecret } from 'firebase-functions/params';
import logger from '../../services/firebase/logger';

const testSecret = defineSecret('TEST');

const router = createRouter();

router.get('/', async (req, res) => {
  logger.info(`Healthcheck endpoint hit
    | secret_manager: ${JSON.stringify(testSecret.value())}
    | env_file: ${process.env.TEST_ENV}
    | env: ${process.env.VAR_FIREBASE_PROJECT_ID}`);

  res.send('Hello World!');
});

export default router;
