import logger from '../../../services/firebase/logger';
import { stripe, StripeService } from '../service';
import { FullAccountData } from './types';
import { detectAccountDataChanges } from './utils';
import {
  getAccountByApiUserId,
  getAccountByCustomerId,
  updateAccount,
} from './account';

/**
 * STRIPE SYNC OPERATIONS
 *
 * Functions for syncing data between Stripe and Firestore
 */

/**
 * Get enriched account data by Firebase UID (recommended replacement for getSubscriptionByFirebaseUid)
 * This provides the same interface but with live Stripe data
 */
export async function getEnrichedAccountDataByFirebaseUid(
  firebaseUid: string,
  options: { updateFirestore?: boolean } = { updateFirestore: true },
): Promise<FullAccountData | null> {
  try {
    const { getAccountByFirebaseUid } = await import('./account.js');
    const account = await getAccountByFirebaseUid(firebaseUid);
    if (!account) return null;

    return await getEnrichedAccountData(account.api_user_id, options);
  } catch (error) {
    logger.error('FIRESTORE_STRIPE_ENRICHED_BY_UID_ERROR', {
      error,
      firebase_uid: firebaseUid,
    });
    return null;
  }
}

/**
 * Get enriched account data with fresh Stripe API details and update Firestore if data differs
 * This combines Firestore data with live Stripe subscription and invoice data
 */
export async function getEnrichedAccountData(
  apiUserId: string,
  options: { updateFirestore?: boolean } = { updateFirestore: true },
): Promise<FullAccountData | null> {
  try {
    // Get base account data from Firestore
    const account = await getAccountByApiUserId(apiUserId);

    if (!account) {
      return null;
    }

    // If no Stripe customer, return basic account data
    if (!account.stripe_customer_id) {
      return {
        ...account,
        _data_source: 'stripe_live' as const,
        _stripe_data_fetched_at: new Date().toISOString(),
      };
    }

    let enrichedAccount: FullAccountData = {
      ...account,
      _data_source: 'stripe_live' as const,
      _stripe_data_fetched_at: new Date().toISOString(),
    };

    // Fetch fresh subscription data from Stripe if customer has subscription
    if (account.stripe_subscription_id) {
      try {
        const subscription = await StripeService.getSubscription(
          account.stripe_subscription_id,
        );

        logger.info(
          `DEBUG_PERIOD_START: ${JSON.stringify(subscription, null, 2)}`,
        );

        const subscriptionItem = subscription.items.data[0];
        const price = subscriptionItem?.price;

        // Enrich with fresh Stripe data
        enrichedAccount = {
          ...enrichedAccount,
          stripe_subscription_status: subscription.status,
          stripe_current_period_start: subscriptionItem.current_period_start,
          stripe_current_period_end: subscriptionItem.current_period_end,
          stripe_plan_id: price?.id,
          stripe_plan_name: price?.nickname || price?.lookup_key || undefined,
          stripe_amount: price?.unit_amount || undefined,
          stripe_currency: price?.currency,
          stripe_trial_end: subscription.trial_end || undefined,
          stripe_cancel_at_period_end: subscription.cancel_at_period_end,
          stripe_canceled_at: subscription.canceled_at || undefined,
        };

        // Get latest invoice if available
        if (subscription.latest_invoice) {
          const invoiceId =
            typeof subscription.latest_invoice === 'string'
              ? subscription.latest_invoice
              : subscription.latest_invoice.id;

          if (invoiceId) {
            try {
              const invoice = await stripe.invoices.retrieve(invoiceId);
              enrichedAccount.stripe_latest_invoice_id = invoice.id;
              enrichedAccount.stripe_latest_invoice_status =
                invoice.status || undefined;
              enrichedAccount.stripe_latest_invoice_amount = invoice.amount_due;
              enrichedAccount.stripe_latest_invoice_created_at = new Date(
                invoice.created * 1000,
              ).toISOString();
            } catch (invoiceError) {
              logger.warn('ENRICH_ACCOUNT_INVOICE_FETCH_ERROR', {
                api_user_id: apiUserId,
                invoice_id: invoiceId,
                error: invoiceError,
              });
            }
          }
        }

        // Check if we need to update Firestore with the latest data
        if (options.updateFirestore) {
          const changes = detectAccountDataChanges(account, enrichedAccount);

          if (changes) {
            logger.info('FIRESTORE_ACCOUNT_DATA_CHANGES_DETECTED', {
              api_user_id: apiUserId,
              changes_detected: Object.keys(changes),
              old_values: Object.keys(changes).reduce((acc, key) => {
                acc[key] = (account as any)[key];
                return acc;
              }, {} as any),
              new_values: changes,
            });

            // Update Firestore with the changed data
            await updateAccount(apiUserId, changes);

            logger.info('FIRESTORE_ACCOUNT_UPDATED_FROM_STRIPE_SYNC', {
              api_user_id: apiUserId,
              stripe_subscription_id: subscription.id,
              fields_updated: Object.keys(changes),
              sync_source: 'enriched_account_data_fetch',
            });
          } else {
            logger.info('FIRESTORE_ACCOUNT_DATA_UP_TO_DATE', {
              api_user_id: apiUserId,
              stripe_subscription_id: subscription.id,
              action: 'no_update_needed',
            });
          }
        }

        logger.info('ACCOUNT_DATA_ENRICHED_SUCCESS', {
          api_user_id: apiUserId,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          firestore_updated:
            options.updateFirestore &&
            !!detectAccountDataChanges(account, enrichedAccount),
        });
      } catch (subscriptionError) {
        logger.warn('ENRICH_ACCOUNT_SUBSCRIPTION_FETCH_ERROR', {
          api_user_id: apiUserId,
          stripe_subscription_id: account.stripe_subscription_id,
          error: subscriptionError,
          action: 'using_cached_data',
        });
      }
    }

    logger.info(`DEBUG_PERIOD: getEnrichedAccountData
          | enrichedAccount: ${JSON.stringify(enrichedAccount, null, 2)}`);

    return enrichedAccount;
  } catch (error) {
    logger.error('GET_ENRICHED_ACCOUNT_DATA_ERROR', {
      error,
      api_user_id: apiUserId,
    });
    // Fallback to basic account data
    const basicAccount = await getAccountByApiUserId(apiUserId);
    return basicAccount
      ? {
          ...basicAccount,
          _data_source: 'stripe_live' as const,
          _stripe_data_fetched_at: new Date().toISOString(),
        }
      : null;
  }
}

/**
 * Sync account data with latest Stripe information
 * This method specifically focuses on updating Firestore with fresh Stripe data
 */
export async function syncAccountWithStripe(apiUserId: string): Promise<void> {
  try {
    // Force enrichment with Firestore update
    await getEnrichedAccountData(apiUserId, { updateFirestore: true });

    logger.info('ACCOUNT_STRIPE_SYNC_COMPLETED', {
      api_user_id: apiUserId,
      action: 'manual_sync_completed',
    });
  } catch (error) {
    logger.error('ACCOUNT_STRIPE_SYNC_ERROR', {
      error,
      api_user_id: apiUserId,
    });
    throw new Error(`Failed to sync account with Stripe: ${error}`);
  }
}

/**
 * Sync account data by customer ID (useful for webhook handlers)
 * This method finds the account by customer ID and syncs it with Stripe
 */
export async function syncAccountWithStripeByCustomerId(
  customerId: string,
): Promise<void> {
  try {
    const account = await getAccountByCustomerId(customerId);

    if (!account) {
      logger.warn('ACCOUNT_NOT_FOUND_FOR_STRIPE_SYNC', {
        stripe_customer_id: customerId,
        action: 'sync_skipped_no_account',
      });
      return;
    }

    await syncAccountWithStripe(account.api_user_id);

    logger.info('ACCOUNT_STRIPE_SYNC_BY_CUSTOMER_COMPLETED', {
      api_user_id: account.api_user_id,
      stripe_customer_id: customerId,
      action: 'webhook_sync_completed',
    });
  } catch (error) {
    logger.error('ACCOUNT_STRIPE_SYNC_BY_CUSTOMER_ERROR', {
      error,
      stripe_customer_id: customerId,
    });
    throw new Error(`Failed to sync account by customer ID: ${error}`);
  }
}

/**
 * Batch sync multiple accounts with Stripe data
 * Useful for maintenance operations or bulk updates
 */
export async function batchSyncAccountsWithStripe(
  apiUserIds: string[],
): Promise<{
  success: string[];
  failed: { apiUserId: string; error: string }[];
}> {
  const results = {
    success: [] as string[],
    failed: [] as { apiUserId: string; error: string }[],
  };

  for (const apiUserId of apiUserIds) {
    try {
      await syncAccountWithStripe(apiUserId);
      results.success.push(apiUserId);
    } catch (error) {
      results.failed.push({
        apiUserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('BATCH_ACCOUNT_STRIPE_SYNC_COMPLETED', {
    total_accounts: apiUserIds.length,
    successful_syncs: results.success.length,
    failed_syncs: results.failed.length,
    success_rate: `${(
      (results.success.length / apiUserIds.length) *
      100
    ).toFixed(2)}%`,
  });

  return results;
}
