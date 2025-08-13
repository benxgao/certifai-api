import { Response } from 'express';
import { StripeService, stripe } from './service';
import { StripeFirestoreService } from './db';
import logger from '../../services/firebase/logger';

/**
 * Get current subscription status
 */
export const getSubscriptionStatus = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    const enrichedAccount =
      await StripeFirestoreService.getEnrichedAccountDataByFirebaseUid(
        firebaseUserIdFromToken,
      );

    if (!enrichedAccount || !enrichedAccount.stripe_subscription_id) {
      res.status(200).json({
        success: true,
        data: null,
        message: 'No subscription found',
      });
      return;
    }

    // Convert to legacy format for API compatibility
    const subscription =
      StripeFirestoreService.convertToSubscriptionData(enrichedAccount);

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    logger.error('GET_SUBSCRIPTION_STATUS_ERROR', {
      error,
      firebase_user_id: req.firebase_user_info?.user_id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status',
    });
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    const { cancel_at_period_end = true } = req.body;

    const enrichedAccount =
      await StripeFirestoreService.getEnrichedAccountDataByFirebaseUid(
        firebaseUserIdFromToken,
      );

    if (!enrichedAccount || !enrichedAccount.stripe_subscription_id) {
      res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
      return;
    }

    const canceledSubscription = await StripeService.cancelSubscription(
      enrichedAccount.stripe_subscription_id,
      cancel_at_period_end,
    );

    // Update Firestore
    await StripeFirestoreService.updateSubscriptionStatus(
      enrichedAccount.stripe_subscription_id,
      canceledSubscription.status,
      (canceledSubscription as any).current_period_start || 0,
      (canceledSubscription as any).current_period_end || 0,
      canceledSubscription.cancel_at_period_end,
      canceledSubscription.canceled_at || undefined,
      new Date().toISOString(), // Use current time for manual cancellation
    );

    res.status(200).json({
      success: true,
      data: {
        subscription_id: enrichedAccount.stripe_subscription_id,
        status: canceledSubscription.status,
        cancel_at_period_end: canceledSubscription.cancel_at_period_end,
        current_period_end:
          (canceledSubscription as any).current_period_end || 0,
      },
    });
  } catch (error) {
    logger.error('CANCEL_SUBSCRIPTION_ERROR', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
    });
  }
};

/**
 * Resume subscription
 */
export const resumeSubscription = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    const enrichedAccount =
      await StripeFirestoreService.getEnrichedAccountDataByFirebaseUid(
        firebaseUserIdFromToken,
      );

    if (!enrichedAccount || !enrichedAccount.stripe_subscription_id) {
      res.status(404).json({
        success: false,
        error: 'No subscription found',
      });
      return;
    }

    const resumedSubscription = await StripeService.resumeSubscription(
      enrichedAccount.stripe_subscription_id,
    );

    // Update Firestore
    await StripeFirestoreService.updateSubscriptionStatus(
      enrichedAccount.stripe_subscription_id,
      resumedSubscription.status,
      (resumedSubscription as any).current_period_start || 0,
      (resumedSubscription as any).current_period_end || 0,
      resumedSubscription.cancel_at_period_end,
      undefined, // No canceled_at for resume
      new Date().toISOString(), // Use current time for manual resume
    );

    res.status(200).json({
      success: true,
      data: {
        subscription_id: enrichedAccount.stripe_subscription_id,
        status: resumedSubscription.status,
        cancel_at_period_end: resumedSubscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    logger.error('RESUME_SUBSCRIPTION_ERROR', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to resume subscription',
    });
  }
};

/**
 * Update subscription plan
 */
export const updateSubscriptionPlan = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    const { new_price_id } = req.body;

    if (!new_price_id) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: new_price_id',
      });
      return;
    }

    const enrichedAccount =
      await StripeFirestoreService.getEnrichedAccountDataByFirebaseUid(
        firebaseUserIdFromToken,
      );

    if (!enrichedAccount || !enrichedAccount.stripe_subscription_id) {
      res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
      return;
    }

    const updatedSubscription = await StripeService.updateSubscriptionPlan(
      enrichedAccount.stripe_subscription_id,
      new_price_id,
    );

    res.status(200).json({
      success: true,
      data: {
        subscription_id: enrichedAccount.stripe_subscription_id,
        status: updatedSubscription.status,
        new_price_id,
      },
    });
  } catch (error) {
    logger.error('UPDATE_SUBSCRIPTION_PLAN_ERROR', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription plan',
    });
  }
};

/**
 * Get pricing plans
 */
export const getPricingPlans = async (req: any, res: Response) => {
  try {
    const plans = await StripeService.getPricingPlans();

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    logger.error('GET_PRICING_PLANS_ERROR', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get pricing plans',
    });
  }
};

/**
 * Get subscription history for a user
 */
export const getSubscriptionHistory = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    // Get account data using the unified approach
    const enrichedAccount =
      await StripeFirestoreService.getEnrichedAccountDataByFirebaseUid(
        firebaseUserIdFromToken,
      );

    if (!enrichedAccount || !enrichedAccount.stripe_customer_id) {
      res.status(404).json({
        success: false,
        error: 'No customer found',
      });
      return;
    }

    // Get all subscriptions for this customer from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: enrichedAccount.stripe_customer_id,
      limit: 100,
    });

    res.status(200).json({
      success: true,
      data: subscriptions.data,
    });
  } catch (error) {
    logger.error('GET_SUBSCRIPTION_HISTORY_ERROR', {
      error,
      firebase_user_id: req.firebase_user_info?.user_id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription history',
    });
  }
};

/**
 * Reactivate a cancelled subscription (only if still in grace period)
 */
export const reactivateSubscription = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    const enrichedAccount =
      await StripeFirestoreService.getEnrichedAccountDataByFirebaseUid(
        firebaseUserIdFromToken,
      );

    if (!enrichedAccount || !enrichedAccount.stripe_subscription_id) {
      res.status(404).json({
        success: false,
        error: 'No subscription found',
      });
      return;
    }

    // Check if subscription can be reactivated (still active but cancelled at period end)
    if (
      enrichedAccount.stripe_subscription_status !== 'active' ||
      !enrichedAccount.stripe_cancel_at_period_end
    ) {
      res.status(400).json({
        success: false,
        error: 'Subscription cannot be reactivated',
      });
      return;
    }

    const reactivatedSubscription = await StripeService.resumeSubscription(
      enrichedAccount.stripe_subscription_id,
    );

    // Update Firestore
    await StripeFirestoreService.updateSubscriptionStatus(
      enrichedAccount.stripe_subscription_id,
      reactivatedSubscription.status,
      (reactivatedSubscription as any).current_period_start || 0,
      (reactivatedSubscription as any).current_period_end || 0,
      reactivatedSubscription.cancel_at_period_end,
      undefined, // No canceled_at for reactivation
      new Date().toISOString(), // Use current time for manual reactivation
    );

    res.status(200).json({
      success: true,
      data: {
        subscription_id: enrichedAccount.stripe_subscription_id,
        status: reactivatedSubscription.status,
        cancel_at_period_end: reactivatedSubscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    logger.error('REACTIVATE_SUBSCRIPTION_ERROR', {
      error,
      firebase_user_id: req.firebase_user_info?.user_id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate subscription',
    });
  }
};
