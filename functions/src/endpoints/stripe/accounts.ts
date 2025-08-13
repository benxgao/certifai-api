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

    logger.info('DEBUG_PERIOD: getAccountData', {
      api_user_id: enrichedAccount.api_user_id,
      firebase_user_id: enrichedAccount.firebase_user_id,
      has_stripe_customer: !!enrichedAccount.stripe_customer_id,
      has_subscription: !!enrichedAccount.stripe_subscription_id,
      subscription_status: enrichedAccount.stripe_subscription_status,
      enriched: enrichedAccount._data_source === 'stripe_live',
      fetched_at: enrichedAccount._stripe_data_fetched_at,
      current_period_data: {
        start: {
          raw_value: enrichedAccount.stripe_current_period_start,
          type: typeof enrichedAccount.stripe_current_period_start,
          converted_to_date: enrichedAccount.stripe_current_period_start
            ? new Date(
                enrichedAccount.stripe_current_period_start * 1000,
              ).toISOString()
            : null,
          converted_to_readable: enrichedAccount.stripe_current_period_start
            ? new Date(
                enrichedAccount.stripe_current_period_start * 1000,
              ).toLocaleString()
            : null,
        },
        end: {
          raw_value: enrichedAccount.stripe_current_period_end,
          type: typeof enrichedAccount.stripe_current_period_end,
          converted_to_date: enrichedAccount.stripe_current_period_end
            ? new Date(
                enrichedAccount.stripe_current_period_end * 1000,
              ).toISOString()
            : null,
          converted_to_readable: enrichedAccount.stripe_current_period_end
            ? new Date(
                enrichedAccount.stripe_current_period_end * 1000,
              ).toLocaleString()
            : null,
        },
      },
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
      stripe_latest_invoice_status:
        enrichedAccount.stripe_latest_invoice_status,
      stripe_latest_invoice_amount:
        enrichedAccount.stripe_latest_invoice_amount,

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

    // Log the final account data structure being sent to frontend
    logger.info('ACCOUNT_DATA_FINAL_RESPONSE_STRUCTURE', {
      api_user_id: accountData.api_user_id,
      current_period_data_in_response: {
        stripe_current_period_start: {
          raw_value: accountData.stripe_current_period_start,
          type: typeof accountData.stripe_current_period_start,
          converted_to_date: accountData.stripe_current_period_start
            ? new Date(
                accountData.stripe_current_period_start * 1000,
              ).toISOString()
            : null,
          converted_to_readable: accountData.stripe_current_period_start
            ? new Date(
                accountData.stripe_current_period_start * 1000,
              ).toLocaleString()
            : null,
        },
        stripe_current_period_end: {
          raw_value: accountData.stripe_current_period_end,
          type: typeof accountData.stripe_current_period_end,
          converted_to_date: accountData.stripe_current_period_end
            ? new Date(
                accountData.stripe_current_period_end * 1000,
              ).toISOString()
            : null,
          converted_to_readable: accountData.stripe_current_period_end
            ? new Date(
                accountData.stripe_current_period_end * 1000,
              ).toLocaleString()
            : null,
        },
      },
      has_subscription: accountData.has_subscription,
      subscription_status: accountData.subscription_status,
      data_source: enrichedAccount._data_source,
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
