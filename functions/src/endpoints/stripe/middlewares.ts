import { Request, Response, NextFunction } from 'express';
import logger from '../../services/firebase/logger';
import { AuthenticatedRequest } from '../../types/express';

/**
 * Rate limiting middleware for Stripe endpoints
 */
export const stripeRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Implement custom rate limiting if needed
  // For now, pass through
  next();
};

/**
 * Validation middleware for subscription operations
 */
export const validateSubscriptionOperation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const firebaseUserId = req.firebase_user_info?.uid;

  if (!firebaseUserId) {
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
