import * as logger from 'firebase-functions/logger';

const info = (message: string, data?: Record<string, unknown>) => {
  logger.info(message, { structuredData: true, ...data });
};

const error = (message: string, data?: Record<string, unknown>) => {
  logger.error(message, { structuredData: true, ...data });
};

export default {
  info,
  error,
};
