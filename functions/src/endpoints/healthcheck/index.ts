import { Router as createRouter } from 'express';
import * as logger from 'firebase-functions/logger';

const router = createRouter();

router.get('/', (req, res) => {
  logger.info('Healthcheck endpoint hit', { structuredData: true });
  res.send('Hello World!');
});

export default router;
