import { Response } from 'express';
import Stripe from 'stripe';
import logger from '../../services/firebase/logger';

export class StripeErrorHandler {
  static handleStripeError(error: any, res: Response, context: string): void {
    logger.error(`STRIPE_ERROR_${context}`, {
      error: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
    });

    if (error instanceof Stripe.errors.StripeError) {
      // Handle different types of Stripe errors
      if (error instanceof Stripe.errors.StripeCardError) {
        res.status(400).json({
          success: false,
          error: 'Card was declined',
          details: error.message,
        });
      } else if (error instanceof Stripe.errors.StripeRateLimitError) {
        res.status(429).json({
          success: false,
          error: 'Too many requests made to the API too quickly',
        });
      } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        res.status(400).json({
          success: false,
          error: 'Invalid parameters were supplied to Stripe API',
          details: error.message,
        });
      } else if (error instanceof Stripe.errors.StripeAuthenticationError) {
        res.status(401).json({
          success: false,
          error: 'Authentication with Stripe API failed',
        });
      } else if (error instanceof Stripe.errors.StripeConnectionError) {
        res.status(502).json({
          success: false,
          error: 'Network communication with Stripe failed',
        });
      } else if (error instanceof Stripe.errors.StripeAPIError) {
        res.status(500).json({
          success: false,
          error: 'An error occurred internally with Stripe API',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'An unexpected Stripe error occurred',
        });
      }
    } else {
      res.status(500).json({
        success: false,
        error: 'An unexpected error occurred',
      });
    }
  }

  static validateRequiredFields(
    fields: Record<string, any>,
    res: Response,
  ): boolean {
    const missingFields = Object.entries(fields)
      .filter(
        ([, value]) => value === undefined || value === null || value === '',
      )
      .map(([key]) => key);

    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
      return false;
    }

    return true;
  }

  static validateSubscriptionStatus(
    subscription: any,
    allowedStatuses: string[],
    res: Response,
  ): boolean {
    if (!subscription) {
      res.status(404).json({
        success: false,
        error: 'No subscription found',
      });
      return false;
    }

    if (!allowedStatuses.includes(subscription.status)) {
      res.status(400).json({
        success: false,
        error: `Subscription status '${subscription.status}' is not valid for this operation`,
      });
      return false;
    }

    return true;
  }
}

export function withStripeErrorHandling(
  handler: (req: any, res: Response) => Promise<void>,
  context: string,
) {
  return async (req: any, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      StripeErrorHandler.handleStripeError(error, res, context);
    }
  };
}
