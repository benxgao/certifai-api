import { firestoreService } from '../../../services/firebase/firestore';
import logger from '../../../services/firebase/logger';
import { SubscriptionData, StripeService } from '../service';
import { AccountData, FullAccountData } from './types';
import { cleanFirestoreData, detectAccountDataChanges } from './utils';

/**
 * STRIPE SUBSCRIPTION OPERATIONS
 *
 * Functions for managing subscription data in Firestore
 */

const ACCOUNTS_COLLECTION = 'accounts';

/**
 * Store or update subscription data in account (MINIMAL DATA ONLY - only if it's the latest subscription)
 */
export async function storeSubscription(
  subscriptionData: SubscriptionData,
): Promise<void> {
  try {
    // Find account by customer ID first
    const accounts = await firestoreService.list<AccountData>(
      ACCOUNTS_COLLECTION,
      {
        where: [
          {
            field: 'stripe_customer_id',
            operator: '==',
            value: subscriptionData.customer_id,
          },
        ],
        limit: 1,
      },
    );

    if (accounts.length === 0) {
      logger.error('FIRESTORE_ACCOUNT_NOT_FOUND_FOR_SUBSCRIPTION', {
        stripe_customer_id: subscriptionData.customer_id,
        stripe_subscription_id: subscriptionData.subscription_id,
      });
      throw new Error(
        `Account not found for customer: ${subscriptionData.customer_id}`,
      );
    }

    const account = accounts[0];

    // For minimal storage, we need to fetch the latest subscription from Stripe
    // to determine if this subscription should be stored
    const latestSubscription = await StripeService.getLatestActiveSubscription(
      subscriptionData.customer_id,
    );

    // Only store if this subscription is the latest active one
    const shouldStoreSubscription =
      latestSubscription &&
      latestSubscription.id === subscriptionData.subscription_id;

    if (!shouldStoreSubscription) {
      logger.info('FIRESTORE_SUBSCRIPTION_SKIPPED_NOT_LATEST', {
        api_user_id: account.api_user_id,
        current_subscription_id: account.stripe_subscription_id,
        new_subscription_id: subscriptionData.subscription_id,
        latest_subscription_id: latestSubscription?.id,
        action: 'skipped_not_latest_subscription',
      });
      return;
    }

    // Store only minimal subscription data
    const subscriptionUpdateData: Partial<AccountData> = {
      stripe_subscription_id: subscriptionData.subscription_id,
      stripe_subscription_status: subscriptionData.status,
      stripe_current_period_start: subscriptionData.current_period_start,
      stripe_current_period_end: subscriptionData.current_period_end,
      stripe_cancel_at_period_end: subscriptionData.cancel_at_period_end,
      // Use subscription timestamp for updated_at if available, otherwise current time
      updated_at: subscriptionData.updated_at || new Date().toISOString(),
    };

    // If this is the first subscription for the account, also update created_at with subscription created_at
    if (!account.stripe_subscription_id && subscriptionData.created_at) {
      subscriptionUpdateData.created_at = subscriptionData.created_at;
    }

    // Check for changes before updating
    const changes = detectAccountDataChanges(
      account,
      subscriptionUpdateData as any,
    );

    if (changes) {
      // Clean undefined values to prevent Firestore errors
      const cleanedUpdateData = cleanFirestoreData(subscriptionUpdateData);

      await firestoreService.update(
        ACCOUNTS_COLLECTION,
        account.api_user_id,
        cleanedUpdateData,
        { skipAutoTimestamps: true },
      );

      logger.info(
        `FIRESTORE_ACCOUNT_SUBSCRIPTION_UPDATED_WITH_CHANGES: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_subscription_id: subscriptionData.subscription_id,
          stripe_customer_id: subscriptionData.customer_id,
          changes_detected: Object.keys(changes),
          old_values: Object.keys(changes).reduce((acc, key) => {
            acc[key] = (account as any)[key];
            return acc;
          }, {} as any),
          new_values: changes,
          action: 'updated_subscription_with_detected_changes',
          storage_type: 'minimal_data_only',
        },
      );
    } else {
      logger.info(
        `FIRESTORE_ACCOUNT_SUBSCRIPTION_NO_CHANGES: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_subscription_id: subscriptionData.subscription_id,
          stripe_customer_id: subscriptionData.customer_id,
          action: 'subscription_data_unchanged',
          storage_type: 'minimal_data_only',
        },
      );
    }
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_SUBSCRIPTION_STORE_ERROR', {
      error,
      stripe_subscription_id: subscriptionData.subscription_id,
      stripe_customer_id: subscriptionData.customer_id,
    });
    throw new Error(`Failed to store subscription in account: ${error}`);
  }
}

/**
 * Update subscription status in account
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: string,
  currentPeriodStart?: number,
  currentPeriodEnd?: number,
  cancelAtPeriodEnd?: boolean,
  canceledAt?: number,
  subscriptionUpdatedAt?: string,
): Promise<void> {
  try {
    // Find account by subscription ID
    const accounts = await firestoreService.list<AccountData>(
      ACCOUNTS_COLLECTION,
      {
        where: [
          {
            field: 'stripe_subscription_id',
            operator: '==',
            value: subscriptionId,
          },
        ],
        limit: 1,
      },
    );

    if (accounts.length === 0) {
      logger.error('FIRESTORE_ACCOUNT_NOT_FOUND_FOR_SUBSCRIPTION_UPDATE', {
        stripe_subscription_id: subscriptionId,
      });
      throw new Error(`Account not found for subscription: ${subscriptionId}`);
    }

    const account = accounts[0];
    const updateData: Partial<AccountData> = {
      // Use subscription timestamp if provided, otherwise current time
      updated_at: subscriptionUpdatedAt || new Date().toISOString(),
    };

    if (status !== undefined)
      updateData.stripe_subscription_status = status as any;

    if (currentPeriodStart !== undefined)
      updateData.stripe_current_period_start = currentPeriodStart;

    if (currentPeriodEnd !== undefined)
      updateData.stripe_current_period_end = currentPeriodEnd;

    if (cancelAtPeriodEnd !== undefined)
      updateData.stripe_cancel_at_period_end = cancelAtPeriodEnd;

    // Check for changes before updating
    const changes = detectAccountDataChanges(account, updateData as any);

    if (changes) {
      // Clean undefined values to prevent Firestore errors
      const cleanedUpdateData = cleanFirestoreData(updateData);

      await firestoreService.update(
        ACCOUNTS_COLLECTION,
        account.api_user_id,
        cleanedUpdateData,
        { skipAutoTimestamps: true },
      );

      logger.info(
        `FIRESTORE_ACCOUNT_SUBSCRIPTION_STATUS_UPDATED_WITH_CHANGES: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
          changes_detected: Object.keys(changes),
          old_values: Object.keys(changes).reduce((acc, key) => {
            acc[key] = (account as any)[key];
            return acc;
          }, {} as any),
          new_values: changes,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          canceled_at: canceledAt,
          action: 'updated_subscription_status_with_detected_changes',
          storage_type: 'minimal_data_only',
        },
      );
    } else {
      logger.info(
        `FIRESTORE_ACCOUNT_SUBSCRIPTION_STATUS_NO_CHANGES: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
          action: 'subscription_status_unchanged',
          storage_type: 'minimal_data_only',
        },
      );
    }
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_SUBSCRIPTION_UPDATE_ERROR', {
      error,
      stripe_subscription_id: subscriptionId,
    });
    throw new Error(`Failed to update subscription in account: ${error}`);
  }
}

/**
 * Convert FullAccountData to legacy SubscriptionData format
 * Helper function for backward compatibility
 */
export function convertToSubscriptionData(
  enrichedAccount: FullAccountData,
): SubscriptionData | null {
  if (!enrichedAccount.stripe_subscription_id) return null;

  return {
    subscription_id: enrichedAccount.stripe_subscription_id,
    customer_id: enrichedAccount.stripe_customer_id!,
    status: (enrichedAccount.stripe_subscription_status as any) || 'active',
    current_period_start: enrichedAccount.stripe_current_period_start || 0,
    current_period_end: enrichedAccount.stripe_current_period_end || 0,
    plan_id: enrichedAccount.stripe_plan_id || '',
    plan_name: enrichedAccount.stripe_plan_name || '',
    amount: enrichedAccount.stripe_amount || 0,
    currency: enrichedAccount.stripe_currency || 'usd',
    trial_end: enrichedAccount.stripe_trial_end,
    cancel_at_period_end: enrichedAccount.stripe_cancel_at_period_end || false,
    canceled_at: enrichedAccount.stripe_canceled_at,
    created_at: enrichedAccount.created_at,
    updated_at: enrichedAccount.updated_at,
  };
}

/**
 * Sync latest subscription from Stripe to Firestore for a customer
 * This ensures we have the most up-to-date subscription information
 */
export async function syncLatestSubscriptionFromStripe(
  customerId: string,
): Promise<void> {
  try {
    // Get the latest active subscription from Stripe
    const latestSubscription = await StripeService.getLatestActiveSubscription(
      customerId,
    );

    if (!latestSubscription) {
      logger.info('SYNC_LATEST_SUBSCRIPTION_NO_SUBSCRIPTION', {
        stripe_customer_id: customerId,
        action: 'no_subscription_to_sync',
      });
      return;
    }

    // Convert Stripe subscription to our format
    const price = latestSubscription.items.data[0]?.price;
    const subscriptionData = {
      subscription_id: latestSubscription.id,
      customer_id: customerId,
      status: latestSubscription.status,
      current_period_start:
        (latestSubscription as any).current_period_start || 0,
      current_period_end: (latestSubscription as any).current_period_end || 0,
      plan_id: price?.id || '',
      plan_name: price?.nickname || price?.lookup_key || 'Unknown Plan',
      amount: price?.unit_amount || 0,
      currency: price?.currency || 'usd',
      trial_end: latestSubscription.trial_end || undefined,
      cancel_at_period_end: latestSubscription.cancel_at_period_end,
      canceled_at: latestSubscription.canceled_at || undefined,
      created_at: new Date(latestSubscription.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store the latest subscription
    await storeSubscription(subscriptionData);

    logger.info('SYNC_LATEST_SUBSCRIPTION_SUCCESS', {
      stripe_customer_id: customerId,
      stripe_subscription_id: latestSubscription.id,
      subscription_status: latestSubscription.status,
      action: 'synced_latest_subscription',
    });
  } catch (error) {
    logger.error('SYNC_LATEST_SUBSCRIPTION_ERROR', {
      error,
      stripe_customer_id: customerId,
    });
    // Don't throw error - this is a sync operation that shouldn't break other flows
  }
}
