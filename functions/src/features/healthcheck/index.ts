import { Router } from 'express';
import logger from '../../services/firebase/logger';

const router = Router();

router.get('/', (req, res) => {
  logger.info('Healthcheck endpoint hit');
  res.send('Hello World!');
});

export default router;