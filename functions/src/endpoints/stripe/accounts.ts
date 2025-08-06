import { Response } from 'express';
import { StripeFirestoreService } from './db';
import logger from '../../services/firebase/logger';

/**
 * Get complete account data including all Stripe information
 * This endpoint demonstrates the new unified approach
 */
export const getAccountData = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    // Get complete account data using new unified method
    const account =
      await StripeFirestoreService.getCompleteAccountDataByFirebaseUid(
        firebaseUserIdFromToken,
      );

    if (!account) {
      res.status(404).json({
        success: false,
        error: 'Account not found',
      });
      return;
    }

    // Transform data for frontend consumption with flat structure
    const accountData = {
      // Core account info
      api_user_id: account.api_user_id,
      firebase_user_id: account.firebase_user_id,
      email: account.email,

      // Stripe customer status
      has_stripe_customer: !!account.stripe_customer_id,
      stripe_customer_id: account.stripe_customer_id,

      // Subscription status and details
      has_subscription: !!account.stripe_subscription_id,
      subscription_status: account.stripe_subscription_status,
      subscription_id: account.stripe_subscription_id,

      // Subscription details (all prefixed with stripe_)
      stripe_plan_id: account.stripe_plan_id,
      stripe_plan_name: account.stripe_plan_name,
      stripe_amount: account.stripe_amount,
      stripe_currency: account.stripe_currency,
      stripe_current_period_start: account.stripe_current_period_start,
      stripe_current_period_end: account.stripe_current_period_end,
      stripe_trial_end: account.stripe_trial_end,
      stripe_cancel_at_period_end: account.stripe_cancel_at_period_end,
      stripe_canceled_at: account.stripe_canceled_at,

      // Latest invoice info
      stripe_latest_invoice_id: account.stripe_latest_invoice_id,
      stripe_latest_invoice_status: account.stripe_latest_invoice_status,
      stripe_latest_invoice_amount: account.stripe_latest_invoice_amount,

      // Computed fields for easier frontend consumption
      is_active_subscription:
        account.stripe_subscription_status === 'active' ||
        account.stripe_subscription_status === 'trialing',
      is_trial: account.stripe_subscription_status === 'trialing',
      is_canceled: !!account.stripe_cancel_at_period_end,

      // Timestamps
      created_at: account.created_at,
      updated_at: account.updated_at,
    };

    logger.info(`ACCOUNT_DATA_RETRIEVED: ${account.api_user_id}`, {
      api_user_id: account.api_user_id,
      has_stripe_customer: accountData.has_stripe_customer,
      has_subscription: accountData.has_subscription,
      subscription_status: accountData.subscription_status,
    });

    res.status(200).json({
      success: true,
      data: accountData,
    });
  } catch (error) {
    logger.error('GET_ACCOUNT_DATA_ERROR', {
      error,
      firebase_user_id: req.firebase_user_info?.user_id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get account data',
    });
  }
};

/**
 * Get account data by API user ID
 * Alternative endpoint using API user ID instead of Firebase UID
 */
export const getAccountDataByApiUserId = async (req: any, res: Response) => {
  try {
    const { api_user_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    if (!api_user_id) {
      res.status(400).json({
        success: false,
        error: 'API user ID is required',
      });
      return;
    }

    // Get account data directly by API user ID
    const account = await StripeFirestoreService.getCompleteAccountData(
      api_user_id,
    );

    if (!account) {
      res.status(404).json({
        success: false,
        error: 'Account not found',
      });
      return;
    }

    // Verify that the requesting user owns this account
    if (account.firebase_user_id !== firebaseUserIdFromToken) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You can only access your own account data',
      });
      return;
    }

    // Return the same transformed data structure as the other endpoint
    const accountData = {
      api_user_id: account.api_user_id,
      firebase_user_id: account.firebase_user_id,
      email: account.email,
      has_stripe_customer: !!account.stripe_customer_id,
      stripe_customer_id: account.stripe_customer_id,
      has_subscription: !!account.stripe_subscription_id,
      subscription_status: account.stripe_subscription_status,
      subscription_id: account.stripe_subscription_id,
      stripe_plan_id: account.stripe_plan_id,
      stripe_plan_name: account.stripe_plan_name,
      stripe_amount: account.stripe_amount,
      stripe_currency: account.stripe_currency,
      stripe_current_period_start: account.stripe_current_period_start,
      stripe_current_period_end: account.stripe_current_period_end,
      stripe_trial_end: account.stripe_trial_end,
      stripe_cancel_at_period_end: account.stripe_cancel_at_period_end,
      stripe_canceled_at: account.stripe_canceled_at,
      stripe_latest_invoice_id: account.stripe_latest_invoice_id,
      stripe_latest_invoice_status: account.stripe_latest_invoice_status,
      stripe_latest_invoice_amount: account.stripe_latest_invoice_amount,
      is_active_subscription:
        account.stripe_subscription_status === 'active' ||
        account.stripe_subscription_status === 'trialing',
      is_trial: account.stripe_subscription_status === 'trialing',
      is_canceled: !!account.stripe_cancel_at_period_end,
      created_at: account.created_at,
      updated_at: account.updated_at,
    };

    res.status(200).json({
      success: true,
      data: accountData,
    });
  } catch (error) {
    logger.error('GET_ACCOUNT_DATA_BY_API_USER_ID_ERROR', {
      error,
      api_user_id: req.params.api_user_id,
      firebase_user_id: req.firebase_user_info?.user_id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get account data',
    });
  }
};
