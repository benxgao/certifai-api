import { Request, Response, NextFunction } from 'express';
import logger from '../../services/firebase/logger';

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
