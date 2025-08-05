import { Request, Response, NextFunction } from 'express';
import logger from '../../services/firebase/logger';

/**
 * Middleware to capture raw body for Stripe webhook signature verification
 */
export const captureRawBody = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.originalUrl?.includes('/webhook')) {
    let data = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      (req as any).rawBody = data;
      next();
    });
  } else {
    next();
  }
};

/**
 * Rate limiting middleware for Stripe endpoints
 */
export const stripeRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Implement custom rate limiting if needed
  // For now, pass through
  next();
};

/**
 * Validation middleware for subscription operations
 */
export const validateSubscriptionOperation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { user_id } = (req as any).firebase_user_info || {};

  if (!user_id) {
    logger.warn('STRIPE_VALIDATION_NO_USER_ID', {
      endpoint: req.originalUrl,
      method: req.method,
    });
    res.status(401).json({
      success: false,
      error: 'Unauthorized: User ID missing',
    });
    return;
  }

  next();
};
