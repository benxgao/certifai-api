import { firestoreService } from '../../services/firebase/firestore';
import logger from '../../services/firebase/logger';
import {
  StripeCustomerData,
  SubscriptionData,
  StripeService,
  stripe,
} from './service';

/**
 * Minimal account data structure for Firestore storage
 * ONLY stores essential identifiers and basic info - detailed data is fetched from Stripe API
 */
export interface AccountData {
  // Primary key - API user ID
  api_user_id: string;

  // Reference data
  firebase_user_id: string;
  email: string;

  // Stripe customer (minimal - just ID)
  stripe_customer_id?: string;

  // Stripe subscription (minimal - just ID and status for quick checks)
  stripe_subscription_id?: string;
  stripe_subscription_status?: string;

  // Essential dates only
  stripe_current_period_end?: number; // Keep for quick expiry checks
  stripe_cancel_at_period_end?: boolean; // Keep for cancellation status

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Complete account data enriched with full Stripe API details
 * This interface includes all detailed subscription information fetched from Stripe
 */
export interface FullAccountData extends AccountData {
  // Full subscription details from Stripe API
  stripe_current_period_start?: number;
  stripe_plan_id?: string;
  stripe_plan_name?: string;
  stripe_amount?: number;
  stripe_currency?: string;
  stripe_trial_end?: number;
  stripe_canceled_at?: number;
  stripe_subscription_created_at?: string;
  stripe_subscription_updated_at?: string;

  // Latest invoice info from Stripe API
  stripe_latest_invoice_id?: string;
  stripe_latest_invoice_status?: string;
  stripe_latest_invoice_amount?: number;
  stripe_latest_invoice_created_at?: string;

  // Customer details from Stripe API
  stripe_customer_created_at?: string;
  stripe_customer_updated_at?: string;
  stripe_customer_deleted?: boolean;
  stripe_customer_deleted_at?: string;

  // Metadata about data source
  _stripe_data_fetched_at?: string;
  _data_source: 'stripe_live';
}

export class StripeFirestoreService {
  private static readonly ACCOUNTS_COLLECTION = 'accounts';

  /**
   * Clean undefined values from object to prevent Firestore errors
   * Firestore doesn't allow undefined values, so we convert them to null or remove them
   */
  private static cleanFirestoreData<T extends Record<string, any>>(
    data: T,
  ): Partial<T> {
    const cleaned: any = { ...data };

    // Convert undefined values to null for optional fields that should be nullable
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === undefined) {
        // For optional Stripe fields, set to null instead of undefined
        if (
          key.startsWith('stripe_') ||
          key.includes('_end') ||
          key.includes('_at')
        ) {
          cleaned[key] = null;
        } else {
          // For other fields, remove the property entirely
          delete cleaned[key];
        }
      }
    });

    return cleaned;
  }

  /**
   * Store or update account data with customer information (MINIMAL DATA ONLY)
   */
  static async storeCustomer(customerData: StripeCustomerData): Promise<void> {
    try {
      const accountData: Partial<AccountData> = {
        api_user_id: customerData.api_user_id,
        firebase_user_id: customerData.firebase_uid,
        email: customerData.email,
        stripe_customer_id: customerData.customer_id,
        updated_at: new Date().toISOString(),
      };

      // Check if account already exists
      const existingAccount = await firestoreService.read<AccountData>(
        this.ACCOUNTS_COLLECTION,
        customerData.api_user_id,
      );

      if (existingAccount) {
        // Update existing account - clean undefined values
        const cleanedAccountData = this.cleanFirestoreData(accountData);
        await firestoreService.update(
          this.ACCOUNTS_COLLECTION,
          customerData.api_user_id,
          cleanedAccountData,
          { skipAutoTimestamps: true },
        );
      } else {
        // Create new account
        accountData.created_at = new Date().toISOString();
        const cleanedAccountData = this.cleanFirestoreData(
          accountData as AccountData,
        );
        await firestoreService.create(
          this.ACCOUNTS_COLLECTION,
          cleanedAccountData,
          customerData.api_user_id,
          { skipAutoTimestamps: true },
        );
      }

      logger.info(
        `FIRESTORE_ACCOUNT_CUSTOMER_STORED_MINIMAL: ${customerData.api_user_id}`,
        {
          api_user_id: customerData.api_user_id,
          stripe_customer_id: customerData.customer_id,
          firebase_user_id: customerData.firebase_uid,
          email: customerData.email,
          storage_type: 'minimal_data_only',
        },
      );
    } catch (error) {
      logger.error('FIRESTORE_ACCOUNT_CUSTOMER_STORE_ERROR', {
        error,
        api_user_id: customerData.api_user_id,
        stripe_customer_id: customerData.customer_id,
      });
      throw new Error(`Failed to store customer in accounts: ${error}`);
    }
  }

  /**
   * Create a new account record with default values
   */
  static async createAccount(accountData: {
    api_user_id: string;
    firebase_user_id: string;
    email: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    stripe_subscription_status?: string;
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
        stripe_current_period_end: accountData.stripe_current_period_end,
        stripe_cancel_at_period_end: accountData.stripe_cancel_at_period_end,
        created_at: accountData.created_at,
        updated_at: accountData.updated_at,
      };

      // Clean undefined values to prevent Firestore errors
      const cleanedAccountData = this.cleanFirestoreData(newAccountData);

      await firestoreService.create(
        this.ACCOUNTS_COLLECTION,
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
  static async getAccountByFirebaseUid(
    firebaseUid: string,
  ): Promise<AccountData | null> {
    try {
      const accounts = await firestoreService.list<AccountData>(
        this.ACCOUNTS_COLLECTION,
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
  static async getAccountByApiUserId(
    apiUserId: string,
  ): Promise<AccountData | null> {
    try {
      return await firestoreService.read<AccountData>(
        this.ACCOUNTS_COLLECTION,
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
  static async getAccountByCustomerId(
    customerId: string,
  ): Promise<AccountData | null> {
    try {
      const accounts = await firestoreService.list<AccountData>(
        this.ACCOUNTS_COLLECTION,
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
  static async updateAccount(
    apiUserId: string,
    updateData: Partial<AccountData>,
  ): Promise<void> {
    try {
      const accountData: Partial<AccountData> = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      // Clean undefined values to prevent Firestore errors
      const cleanedAccountData = this.cleanFirestoreData(accountData);

      await firestoreService.update<AccountData>(
        this.ACCOUNTS_COLLECTION,
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
   * Get customer by Firebase UID (Legacy - for backward compatibility)
   * @deprecated Use getAccountByFirebaseUid instead
   */
  static async getCustomerByFirebaseUid(
    firebaseUid: string,
  ): Promise<StripeCustomerData | null> {
    try {
      const account = await this.getAccountByFirebaseUid(firebaseUid);
      if (!account || !account.stripe_customer_id) return null;

      // Convert AccountData to StripeCustomerData for backward compatibility
      return {
        customer_id: account.stripe_customer_id,
        email: account.email,
        firebase_uid: account.firebase_user_id,
        api_user_id: account.api_user_id,
        created_at: account.created_at, // Not stored in minimal data
        updated_at: account.updated_at,
      };
    } catch (error) {
      logger.error('FIRESTORE_STRIPE_CUSTOMER_GET_ERROR', {
        error,
        firebase_uid: firebaseUid,
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
   * Store or update subscription data in account (MINIMAL DATA ONLY - only if it's the latest subscription)
   */
  static async storeSubscription(
    subscriptionData: SubscriptionData,
  ): Promise<void> {
    try {
      // Find account by customer ID first
      const accounts = await firestoreService.list<AccountData>(
        this.ACCOUNTS_COLLECTION,
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
      const latestSubscription =
        await StripeService.getLatestActiveSubscription(
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
        stripe_current_period_end: subscriptionData.current_period_end,
        updated_at: new Date().toISOString(),
      };

      // Clean undefined values to prevent Firestore errors
      const cleanedUpdateData = this.cleanFirestoreData(subscriptionUpdateData);

      await firestoreService.update(
        this.ACCOUNTS_COLLECTION,
        account.api_user_id,
        cleanedUpdateData,
        { skipAutoTimestamps: true },
      );

      logger.info(
        `FIRESTORE_ACCOUNT_SUBSCRIPTION_STORED_MINIMAL: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_subscription_id: subscriptionData.subscription_id,
          stripe_customer_id: subscriptionData.customer_id,
          action: 'stored_latest_subscription_minimal_data',
          storage_type: 'minimal_data_only',
        },
      );
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
  static async updateSubscriptionStatus(
    subscriptionId: string,
    status: string,
    currentPeriodStart?: number,
    currentPeriodEnd?: number,
    cancelAtPeriodEnd?: boolean,
    canceledAt?: number,
  ): Promise<void> {
    try {
      // Find account by subscription ID
      const accounts = await firestoreService.list<AccountData>(
        this.ACCOUNTS_COLLECTION,
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
        throw new Error(
          `Account not found for subscription: ${subscriptionId}`,
        );
      }

      const account = accounts[0];
      const updateData: Partial<AccountData> = {
        updated_at: new Date().toISOString(),
      };

      if (currentPeriodEnd !== undefined)
        updateData.stripe_current_period_end = currentPeriodEnd;

      if (cancelAtPeriodEnd !== undefined)
        updateData.stripe_cancel_at_period_end = cancelAtPeriodEnd;

      // Clean undefined values to prevent Firestore errors
      const cleanedUpdateData = this.cleanFirestoreData(updateData);

      await firestoreService.update(
        this.ACCOUNTS_COLLECTION,
        account.api_user_id,
        cleanedUpdateData,
        { skipAutoTimestamps: true },
      );

      logger.info(
        `FIRESTORE_ACCOUNT_SUBSCRIPTION_UPDATED_MINIMAL: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          canceled_at: canceledAt,
          action: 'updated_minimal_subscription_data',
          storage_type: 'minimal_data_only',
        },
      );
    } catch (error) {
      logger.error('FIRESTORE_ACCOUNT_SUBSCRIPTION_UPDATE_ERROR', {
        error,
        stripe_subscription_id: subscriptionId,
      });
      throw new Error(`Failed to update subscription in account: ${error}`);
    }
  }

  /**
   * Get active subscription for customer (Legacy - for backward compatibility)
   * @deprecated Use getEnrichedAccountData instead
   */
  static async getActiveSubscription(
    customerId: string,
  ): Promise<SubscriptionData | null> {
    try {
      logger.warn('LEGACY_METHOD_CALLED', {
        method: 'getActiveSubscription',
        customerId,
        message: 'Use getEnrichedAccountData instead for live Stripe data',
      });

      const accounts = await firestoreService.list<AccountData>(
        this.ACCOUNTS_COLLECTION,
        {
          where: [
            { field: 'stripe_customer_id', operator: '==', value: customerId },
          ],
          limit: 1,
        },
      );

      if (accounts.length === 0) return null;

      const account = accounts[0];
      if (!account.stripe_subscription_id) return null;

      // Return minimal data from Firestore only - missing fields will be empty
      return {
        subscription_id: account.stripe_subscription_id,
        customer_id: account.stripe_customer_id!,
        status: 'active', // Simplified for legacy compatibility
        current_period_start: 0, // Not stored in minimal data
        current_period_end: account.stripe_current_period_end || 0,
        plan_id: '', // Not stored in minimal data
        plan_name: '', // Not stored in minimal data
        amount: 0, // Not stored in minimal data
        currency: 'usd', // Not stored in minimal data
        trial_end: undefined, // Not stored in minimal data
        cancel_at_period_end: false, // Not stored in minimal data
        canceled_at: undefined, // Not stored in minimal data
        created_at: account.created_at,
        updated_at: account.updated_at,
      };
    } catch (error) {
      logger.error('FIRESTORE_STRIPE_SUBSCRIPTION_GET_ERROR', {
        error,
        customer_id: customerId,
      });
      return null;
    }
  }

  /**
   * Get subscription by Firebase UID (Legacy - for backward compatibility)
   * @deprecated Use getEnrichedAccountData instead
   */
  static async getSubscriptionByFirebaseUid(
    firebaseUid: string,
  ): Promise<SubscriptionData | null> {
    try {
      logger.warn('LEGACY_METHOD_CALLED', {
        method: 'getSubscriptionByFirebaseUid',
        firebaseUid,
        message: 'Use getEnrichedAccountData instead for live Stripe data',
      });

      const account = await this.getAccountByFirebaseUid(firebaseUid);
      if (!account || !account.stripe_subscription_id) return null;

      // Return minimal data from Firestore only - missing fields will be empty
      return {
        subscription_id: account.stripe_subscription_id,
        customer_id: account.stripe_customer_id!,
        status: 'active', // Simplified for legacy compatibility
        current_period_start: 0, // Not stored in minimal data
        current_period_end: account.stripe_current_period_end || 0,
        plan_id: '', // Not stored in minimal data
        plan_name: '', // Not stored in minimal data
        amount: 0, // Not stored in minimal data
        currency: 'usd', // Not stored in minimal data
        trial_end: undefined, // Not stored in minimal data
        cancel_at_period_end: false, // Not stored in minimal data
        canceled_at: undefined, // Not stored in minimal data
        created_at: account.created_at,
        updated_at: account.updated_at,
      };
    } catch (error) {
      logger.error('FIRESTORE_STRIPE_SUBSCRIPTION_BY_UID_ERROR', {
        error,
        firebase_uid: firebaseUid,
      });
      return null;
    }
  }

  /**
   * Store latest invoice data in account
   */
  static async storeInvoice(invoiceData: any): Promise<void> {
    try {
      // Find account by customer ID
      const accounts = await firestoreService.list<AccountData>(
        this.ACCOUNTS_COLLECTION,
        {
          where: [
            {
              field: 'stripe_customer_id',
              operator: '==',
              value: invoiceData.customer_id,
            },
          ],
          limit: 1,
        },
      );

      if (accounts.length === 0) {
        logger.warn('FIRESTORE_ACCOUNT_NOT_FOUND_FOR_INVOICE', {
          stripe_customer_id: invoiceData.customer_id,
          stripe_invoice_id: invoiceData.invoice_id,
        });
        // Don't throw error for invoice storage - it's not critical
        return;
      }

      const account = accounts[0];
      // For minimal storage, we don't store detailed invoice data
      // Only update the account timestamp to indicate activity
      const invoiceUpdateData: Partial<AccountData> = {
        updated_at: new Date().toISOString(),
      };

      await firestoreService.update(
        this.ACCOUNTS_COLLECTION,
        account.api_user_id,
        invoiceUpdateData,
        { skipAutoTimestamps: true },
      );

      logger.info(
        `FIRESTORE_ACCOUNT_INVOICE_ACTIVITY_LOGGED: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_invoice_id: invoiceData.invoice_id,
          action: 'invoice_activity_logged_minimal_storage',
          storage_type: 'minimal_data_only',
          stripe_customer_id: invoiceData.customer_id,
        },
      );
    } catch (error) {
      logger.error('FIRESTORE_ACCOUNT_INVOICE_STORE_ERROR', {
        error,
        stripe_invoice_id: invoiceData.invoice_id,
        stripe_customer_id: invoiceData.customer_id,
      });
      // Don't throw error for invoice storage - it's not critical to the main flow
    }
  }

  /**
   * Get complete account data by API user ID (New unified method)
   */
  static async getCompleteAccountData(
    apiUserId: string,
  ): Promise<AccountData | null> {
    return await this.getAccountByApiUserId(apiUserId);
  }

  /**
   * Get complete account data by Firebase UID (New unified method)
   */
  static async getCompleteAccountDataByFirebaseUid(
    firebaseUid: string,
  ): Promise<AccountData | null> {
    return await this.getAccountByFirebaseUid(firebaseUid);
  }

  /**
   * Check if account has active subscription
   */
  static async hasActiveSubscription(apiUserId: string): Promise<boolean> {
    try {
      const account = await this.getAccountByApiUserId(apiUserId);
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
  static async getSubscriptionStatus(
    apiUserId: string,
  ): Promise<string | null> {
    try {
      const account = await this.getAccountByApiUserId(apiUserId);
      return account?.stripe_subscription_status || null;
    } catch (error) {
      logger.error('FIRESTORE_ACCOUNT_GET_SUBSCRIPTION_STATUS_ERROR', {
        error,
        api_user_id: apiUserId,
      });
      return null;
    }
  }

  /**
   * Sync latest subscription from Stripe to Firestore for a customer
   * This ensures we have the most up-to-date subscription information
   */
  static async syncLatestSubscriptionFromStripe(
    customerId: string,
  ): Promise<void> {
    try {
      // Get the latest active subscription from Stripe
      const latestSubscription =
        await StripeService.getLatestActiveSubscription(customerId);

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
      await this.storeSubscription(subscriptionData);

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

  /**
   * Get enriched account data with fresh Stripe API details
   * This combines Firestore data with live Stripe subscription and invoice data
   */
  static async getEnrichedAccountData(
    apiUserId: string,
  ): Promise<FullAccountData | null> {
    try {
      // Get base account data from Firestore
      const account = await this.getAccountByApiUserId(apiUserId);

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
          const price = subscription.items.data[0]?.price;

          // Enrich with fresh Stripe data
          enrichedAccount = {
            ...enrichedAccount,
            stripe_subscription_status: subscription.status,
            stripe_current_period_start: (subscription as any)
              .current_period_start,
            stripe_current_period_end: (subscription as any).current_period_end,
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
                enrichedAccount.stripe_latest_invoice_amount =
                  invoice.amount_due;
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

          logger.info('ACCOUNT_DATA_ENRICHED_SUCCESS', {
            api_user_id: apiUserId,
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
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

      return enrichedAccount;
    } catch (error) {
      logger.error('GET_ENRICHED_ACCOUNT_DATA_ERROR', {
        error,
        api_user_id: apiUserId,
      });
      // Fallback to basic account data
      const basicAccount = await this.getAccountByApiUserId(apiUserId);
      return basicAccount
        ? {
            ...basicAccount,
            _data_source: 'stripe_live' as const,
            _stripe_data_fetched_at: new Date().toISOString(),
          }
        : null;
    }
  }
}
