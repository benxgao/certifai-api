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

    // First get the account by Firebase UID to get the API user ID
    const account = await StripeFirestoreService.getAccountByFirebaseUid(
      firebaseUserIdFromToken,
    );

    if (!account) {
      res.status(404).json({
        success: false,
        error: 'Account not found',
      });
      return;
    }

    // Get enriched account data with live Stripe data using API user ID
    const enrichedAccount = await StripeFirestoreService.getEnrichedAccountData(
      account.api_user_id,
    );

    if (!enrichedAccount) {
      res.status(404).json({
        success: false,
        error: 'Account not found',
      });
      return;
    }

    logger.info('ACCOUNT_DATA_ENRICHED_FROM_STRIPE', {
      api_user_id: enrichedAccount.api_user_id,
      firebase_user_id: enrichedAccount.firebase_user_id,
      has_stripe_customer: !!enrichedAccount.stripe_customer_id,
      has_subscription: !!enrichedAccount.stripe_subscription_id,
      subscription_status: enrichedAccount.stripe_subscription_status,
      enriched: enrichedAccount._data_source === 'stripe_live',
      fetched_at: enrichedAccount._stripe_data_fetched_at,
    });

    // Transform data for frontend consumption with flat structure
    const accountData = {
      // Core account info
      api_user_id: enrichedAccount.api_user_id,
      firebase_user_id: enrichedAccount.firebase_user_id,
      email: enrichedAccount.email,

      // Stripe customer status
      has_stripe_customer: !!enrichedAccount.stripe_customer_id,
      stripe_customer_id: enrichedAccount.stripe_customer_id,

      // Subscription status and details
      has_subscription: !!enrichedAccount.stripe_subscription_id,
      subscription_status: enrichedAccount.stripe_subscription_status,
      subscription_id: enrichedAccount.stripe_subscription_id,

      // Subscription details (all prefixed with stripe_)
      stripe_plan_id: enrichedAccount.stripe_plan_id,
      stripe_plan_name: enrichedAccount.stripe_plan_name,
      stripe_amount: enrichedAccount.stripe_amount,
      stripe_currency: enrichedAccount.stripe_currency,
      stripe_current_period_start: enrichedAccount.stripe_current_period_start,
      stripe_current_period_end: enrichedAccount.stripe_current_period_end,
      stripe_trial_end: enrichedAccount.stripe_trial_end,
      stripe_cancel_at_period_end: enrichedAccount.stripe_cancel_at_period_end,
      stripe_canceled_at: enrichedAccount.stripe_canceled_at,

      // Latest invoice info
      stripe_latest_invoice_id: enrichedAccount.stripe_latest_invoice_id,
      stripe_latest_invoice_status: enrichedAccount.stripe_latest_invoice_status,
      stripe_latest_invoice_amount: enrichedAccount.stripe_latest_invoice_amount,

      // Computed fields for easier frontend consumption
      is_active_subscription:
        enrichedAccount.stripe_subscription_status === 'active' ||
        enrichedAccount.stripe_subscription_status === 'trialing',
      is_trial: enrichedAccount.stripe_subscription_status === 'trialing',
      is_canceled: !!enrichedAccount.stripe_cancel_at_period_end,

      // Timestamps
      created_at: enrichedAccount.created_at,
      updated_at: enrichedAccount.updated_at,
    };

    logger.info(`ACCOUNT_DATA_RETRIEVED: ${enrichedAccount.api_user_id}`, {
      api_user_id: enrichedAccount.api_user_id,
      has_stripe_customer: accountData.has_stripe_customer,
      has_subscription: accountData.has_subscription,
      subscription_status: accountData.subscription_status,
      data_source: enrichedAccount._data_source,
    });

    // Add header to indicate data source for debugging
    if (enrichedAccount._data_source === 'stripe_live') {
      res.setHeader('X-Data-Source', 'stripe-live');
      res.setHeader(
        'X-Data-Fetched-At',
        enrichedAccount._stripe_data_fetched_at || 'unknown',
      );
    } else {
      res.setHeader('X-Data-Source', 'firestore-cache');
    }

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

    // Get enriched account data with live Stripe data
    const enrichedAccount = await StripeFirestoreService.getEnrichedAccountData(
      api_user_id,
    );

    if (!enrichedAccount) {
      res.status(404).json({
        success: false,
        error: 'Account not found',
      });
      return;
    }

    // Verify that the requesting user owns this account
    if (enrichedAccount.firebase_user_id !== firebaseUserIdFromToken) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Account access denied',
      });
      return;
    }

    // Return the same transformed data structure as the other endpoint
    const accountData = {
      api_user_id: enrichedAccount.api_user_id,
      firebase_user_id: enrichedAccount.firebase_user_id,
      email: enrichedAccount.email,
      has_stripe_customer: !!enrichedAccount.stripe_customer_id,
      stripe_customer_id: enrichedAccount.stripe_customer_id,
      has_subscription: !!enrichedAccount.stripe_subscription_id,
      subscription_status: enrichedAccount.stripe_subscription_status,
      subscription_id: enrichedAccount.stripe_subscription_id,
      stripe_plan_id: enrichedAccount.stripe_plan_id,
      stripe_plan_name: enrichedAccount.stripe_plan_name,
      stripe_amount: enrichedAccount.stripe_amount,
      stripe_currency: enrichedAccount.stripe_currency,
      stripe_current_period_start: enrichedAccount.stripe_current_period_start,
      stripe_current_period_end: enrichedAccount.stripe_current_period_end,
      stripe_trial_end: enrichedAccount.stripe_trial_end,
      stripe_cancel_at_period_end: enrichedAccount.stripe_cancel_at_period_end,
      stripe_canceled_at: enrichedAccount.stripe_canceled_at,
      stripe_latest_invoice_id: enrichedAccount.stripe_latest_invoice_id,
      stripe_latest_invoice_status: enrichedAccount.stripe_latest_invoice_status,
      stripe_latest_invoice_amount: enrichedAccount.stripe_latest_invoice_amount,
      is_active_subscription:
        enrichedAccount.stripe_subscription_status === 'active' ||
        enrichedAccount.stripe_subscription_status === 'trialing',
      is_trial: enrichedAccount.stripe_subscription_status === 'trialing',
      is_canceled: !!enrichedAccount.stripe_cancel_at_period_end,
      created_at: enrichedAccount.created_at,
      updated_at: enrichedAccount.updated_at,
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
