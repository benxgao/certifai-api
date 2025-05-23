import { logger } from 'firebase-functions';

const info = (message: string, data?: Record<string, unknown>) => {
  logger.info(message, { ...data });
};

const warn = (message: string, data?: Record<string, unknown>) => {
  logger.warn(message, { ...data });
};

const error = (message: string, data?: Record<string, unknown>) => {
  logger.error(message, { ...data });
};

export default {
  info,
  warn,
  error,
};
