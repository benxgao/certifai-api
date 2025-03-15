import { Router } from 'express';
import * as logger from 'firebase-functions/logger';

const router = Router();

router.get('/', (req, res) => {
  logger.info('Healthcheck endpoint hit', { structuredData: true });
  res.send('Hello World!');
});

export default router;
