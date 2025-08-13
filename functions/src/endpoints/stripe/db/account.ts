import { firestoreService } from '../../../services/firebase/firestore';
import logger from '../../../services/firebase/logger';
import { AccountData } from './types';
import { cleanFirestoreData } from './utils';

/**
 * STRIPE ACCOUNT CRUD OPERATIONS
 *
 * Functions for basic account management in Firestore
 */

const ACCOUNTS_COLLECTION = 'accounts';

/**
 * Create a new account record with default values
 */
export async function createAccount(accountData: {
  api_user_id: string;
  firebase_user_id: string;
  email: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_subscription_status?: string;
  stripe_current_period_start?: number;
  stripe_current_period_end?: number;
  stripe_cancel_at_period_end?: boolean;
  created_at: string;
  updated_at: string;
}): Promise<void> {
  try {
    const newAccountData: AccountData = {
      api_user_id: accountData.api_user_id,
      firebase_user_id: accountData.firebase_user_id,
      email: accountData.email,
      stripe_customer_id: accountData.stripe_customer_id,
      stripe_subscription_id: accountData.stripe_subscription_id,
      stripe_subscription_status: accountData.stripe_subscription_status,
      stripe_current_period_start: accountData.stripe_current_period_start,
      stripe_current_period_end: accountData.stripe_current_period_end,
      stripe_cancel_at_period_end: accountData.stripe_cancel_at_period_end,
      created_at: accountData.created_at,
      updated_at: accountData.updated_at,
    };

    // Clean undefined values to prevent Firestore errors
    const cleanedAccountData = cleanFirestoreData(newAccountData);

    await firestoreService.create(
      ACCOUNTS_COLLECTION,
      cleanedAccountData,
      accountData.api_user_id,
      { skipAutoTimestamps: true },
    );

    logger.info('FIRESTORE_ACCOUNT_CREATED', {
      api_user_id: accountData.api_user_id,
      firebase_user_id: accountData.firebase_user_id,
      email: accountData.email,
      stripe_customer_id: accountData.stripe_customer_id,
      stripe_subscription_id: accountData.stripe_subscription_id,
      stripe_subscription_status: accountData.stripe_subscription_status,
      stripe_data_included: !!accountData.stripe_customer_id,
      subscription_data_included: !!accountData.stripe_subscription_id,
      account_data_completeness: {
        customer: !!accountData.stripe_customer_id,
        subscription: !!accountData.stripe_subscription_id,
        subscription_status: !!accountData.stripe_subscription_status,
        current_period_end: !!accountData.stripe_current_period_end,
        cancel_at_period_end:
          accountData.stripe_cancel_at_period_end !== undefined,
      },
    });
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_CREATE_ERROR', {
      error,
      api_user_id: accountData.api_user_id,
      firebase_user_id: accountData.firebase_user_id,
      error_details: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error(`Failed to create account: ${error}`);
  }
}

/**
 * Get account by Firebase UID
 */
export async function getAccountByFirebaseUid(
  firebaseUid: string,
): Promise<AccountData | null> {
  try {
    const accounts = await firestoreService.list<AccountData>(
      ACCOUNTS_COLLECTION,
      {
        where: [
          { field: 'firebase_user_id', operator: '==', value: firebaseUid },
        ],
        limit: 1,
      },
    );

    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_GET_BY_FIREBASE_UID_ERROR', {
      error,
      firebase_user_id: firebaseUid,
      error_details: error instanceof Error ? error.message : 'Unknown error',
      error_code: (error as any)?.code || 'UNKNOWN',
    });
    // Don't return null for permission errors, throw them so we can handle them properly
    if (
      (error as any)?.code === 7 ||
      (error as any)?.message?.includes('permission')
    ) {
      throw new Error(
        `Firestore permission error: ${
          error instanceof Error ? error.message : 'Unknown permission error'
        }`,
      );
    }
    return null;
  }
}

/**
 * Get account by API user ID
 */
export async function getAccountByApiUserId(
  apiUserId: string,
): Promise<AccountData | null> {
  try {
    return await firestoreService.read<AccountData>(
      ACCOUNTS_COLLECTION,
      apiUserId,
    );
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_GET_BY_API_USER_ID_ERROR', {
      error,
      api_user_id: apiUserId,
      error_details: error instanceof Error ? error.message : 'Unknown error',
      error_code: (error as any)?.code || 'UNKNOWN',
    });
    return null;
  }
}

/**
 * Get account by Stripe customer ID
 */
export async function getAccountByCustomerId(
  customerId: string,
): Promise<AccountData | null> {
  try {
    const accounts = await firestoreService.list<AccountData>(
      ACCOUNTS_COLLECTION,
      {
        where: [
          { field: 'stripe_customer_id', operator: '==', value: customerId },
        ],
        limit: 1,
      },
    );

    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_GET_BY_CUSTOMER_ID_ERROR', {
      error,
      customer_id: customerId,
      error_details: error instanceof Error ? error.message : 'Unknown error',
      error_code: (error as any)?.code || 'UNKNOWN',
    });
    return null;
  }
}

/**
 * Update account data
 */
export async function updateAccount(
  apiUserId: string,
  updateData: Partial<AccountData>,
): Promise<void> {
  try {
    const accountData: Partial<AccountData> = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // Clean undefined values to prevent Firestore errors
    const cleanedAccountData = cleanFirestoreData(accountData);

    await firestoreService.update<AccountData>(
      ACCOUNTS_COLLECTION,
      apiUserId,
      cleanedAccountData,
      { skipAutoTimestamps: true },
    );

    logger.info('FIRESTORE_ACCOUNT_UPDATED', {
      api_user_id: apiUserId,
      fields_updated: Object.keys(updateData),
    });
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_UPDATE_ERROR', {
      error,
      api_user_id: apiUserId,
      update_data: updateData,
      error_details: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error(`Failed to update account: ${error}`);
  }
}

/**
 * Check if account has active subscription
 */
export async function hasActiveSubscription(
  apiUserId: string,
): Promise<boolean> {
  try {
    const account = await getAccountByApiUserId(apiUserId);
    return !!(
      account?.stripe_subscription_id &&
      (account.stripe_subscription_status === 'active' ||
        account.stripe_subscription_status === 'trialing')
    );
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_CHECK_ACTIVE_SUBSCRIPTION_ERROR', {
      error,
      api_user_id: apiUserId,
    });
    return false;
  }
}

/**
 * Get subscription status for account
 */
export async function getSubscriptionStatus(
  apiUserId: string,
): Promise<string | null> {
  try {
    const account = await getAccountByApiUserId(apiUserId);
    return account?.stripe_subscription_status || null;
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_GET_SUBSCRIPTION_STATUS_ERROR', {
      error,
      api_user_id: apiUserId,
    });
    return null;
  }
}
