import { firestoreService } from '../../services/firebase/firestore';
import logger from '../../services/firebase/logger';
import { StripeCustomerData, SubscriptionData } from './service';

/**
 * Unified account data structure for single Firestore collection
 * All Stripe data is prefixed with 'stripe_' and stored in flat structure
 */
export interface AccountData {
  // Primary key - API user ID
  api_user_id: string;

  // Reference data
  firebase_user_id: string;
  email: string;

  // Stripe customer data (prefixed)
  stripe_customer_id?: string;
  stripe_customer_created_at?: string;
  stripe_customer_updated_at?: string;
  stripe_customer_deleted?: boolean;
  stripe_customer_deleted_at?: string;

  // Stripe subscription data (prefixed)
  stripe_subscription_id?: string;
  stripe_subscription_status?: string; // Use string to accept all Stripe.Subscription.Status values
  stripe_current_period_start?: number;
  stripe_current_period_end?: number;
  stripe_plan_id?: string;
  stripe_plan_name?: string;
  stripe_amount?: number;
  stripe_currency?: string;
  stripe_trial_end?: number;
  stripe_cancel_at_period_end?: boolean;
  stripe_canceled_at?: number;
  stripe_subscription_created_at?: string;
  stripe_subscription_updated_at?: string;

  // Stripe invoice data (prefixed) - store latest invoice info
  stripe_latest_invoice_id?: string;
  stripe_latest_invoice_status?: string;
  stripe_latest_invoice_amount?: number;
  stripe_latest_invoice_created_at?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

export class StripeFirestoreService {
  private static readonly ACCOUNTS_COLLECTION = 'accounts';

  /**
   * Store or update account data with customer information
   */
  static async storeCustomer(customerData: StripeCustomerData): Promise<void> {
    try {
      const accountData: Partial<AccountData> = {
        api_user_id: customerData.api_user_id,
        firebase_user_id: customerData.firebase_uid,
        email: customerData.email,
        stripe_customer_id: customerData.customer_id,
        stripe_customer_created_at: customerData.created_at,
        stripe_customer_updated_at: customerData.updated_at,
        updated_at: new Date().toISOString(),
      };

      // Check if account already exists
      const existingAccount = await firestoreService.read<AccountData>(
        this.ACCOUNTS_COLLECTION,
        customerData.api_user_id,
      );

      if (existingAccount) {
        // Update existing account
        await firestoreService.update(
          this.ACCOUNTS_COLLECTION,
          customerData.api_user_id,
          accountData,
        );
      } else {
        // Create new account
        accountData.created_at = new Date().toISOString();
        await firestoreService.create(
          this.ACCOUNTS_COLLECTION,
          accountData as AccountData,
          customerData.api_user_id,
        );
      }

      logger.info(
        `FIRESTORE_ACCOUNT_CUSTOMER_STORED: ${customerData.api_user_id}`,
        {
          api_user_id: customerData.api_user_id,
          stripe_customer_id: customerData.customer_id,
          firebase_user_id: customerData.firebase_uid,
          email: customerData.email,
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
    created_at: string;
    updated_at: string;
  }): Promise<void> {
    try {
      const newAccountData: AccountData = {
        api_user_id: accountData.api_user_id,
        firebase_user_id: accountData.firebase_user_id,
        email: accountData.email,
        created_at: accountData.created_at,
        updated_at: accountData.updated_at,
      };

      await firestoreService.create(
        this.ACCOUNTS_COLLECTION,
        newAccountData,
        accountData.api_user_id,
      );

      logger.info('FIRESTORE_ACCOUNT_CREATED', {
        api_user_id: accountData.api_user_id,
        firebase_user_id: accountData.firebase_user_id,
        email: accountData.email,
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

      await firestoreService.update<AccountData>(
        this.ACCOUNTS_COLLECTION,
        apiUserId,
        accountData,
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
        created_at: account.stripe_customer_created_at || account.created_at,
        updated_at: account.stripe_customer_updated_at || account.updated_at,
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
   * Store or update subscription data in account
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
      const subscriptionUpdateData: Partial<AccountData> = {
        stripe_subscription_id: subscriptionData.subscription_id,
        stripe_subscription_status: subscriptionData.status,
        stripe_current_period_start: subscriptionData.current_period_start,
        stripe_current_period_end: subscriptionData.current_period_end,
        stripe_plan_id: subscriptionData.plan_id,
        stripe_plan_name: subscriptionData.plan_name,
        stripe_amount: subscriptionData.amount,
        stripe_currency: subscriptionData.currency,
        stripe_trial_end: subscriptionData.trial_end,
        stripe_cancel_at_period_end: subscriptionData.cancel_at_period_end,
        stripe_canceled_at: subscriptionData.canceled_at,
        stripe_subscription_created_at: subscriptionData.created_at,
        stripe_subscription_updated_at: subscriptionData.updated_at,
        updated_at: new Date().toISOString(),
      };

      await firestoreService.update(
        this.ACCOUNTS_COLLECTION,
        account.api_user_id,
        subscriptionUpdateData,
      );

      logger.info(
        `FIRESTORE_ACCOUNT_SUBSCRIPTION_STORED: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_subscription_id: subscriptionData.subscription_id,
          stripe_customer_id: subscriptionData.customer_id,
          stripe_subscription_status: subscriptionData.status,
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
        stripe_subscription_status: status,
        stripe_subscription_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (currentPeriodStart !== undefined)
        updateData.stripe_current_period_start = currentPeriodStart;
      if (currentPeriodEnd !== undefined)
        updateData.stripe_current_period_end = currentPeriodEnd;
      if (cancelAtPeriodEnd !== undefined)
        updateData.stripe_cancel_at_period_end = cancelAtPeriodEnd;
      if (canceledAt !== undefined) updateData.stripe_canceled_at = canceledAt;

      await firestoreService.update(
        this.ACCOUNTS_COLLECTION,
        account.api_user_id,
        updateData,
      );

      logger.info(
        `FIRESTORE_ACCOUNT_SUBSCRIPTION_UPDATED: ${account.api_user_id}`,
        {
          api_user_id: account.api_user_id,
          stripe_subscription_id: subscriptionId,
          stripe_subscription_status: status,
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
   * @deprecated Use getAccountByFirebaseUid or getAccountByApiUserId instead
   */
  static async getActiveSubscription(
    customerId: string,
  ): Promise<SubscriptionData | null> {
    try {
      const accounts = await firestoreService.list<AccountData>(
        this.ACCOUNTS_COLLECTION,
        {
          where: [
            { field: 'stripe_customer_id', operator: '==', value: customerId },
            {
              field: 'stripe_subscription_status',
              operator: 'in',
              value: ['active', 'trialing'],
            },
          ],
          limit: 1,
        },
      );

      if (accounts.length === 0) return null;

      const account = accounts[0];
      if (!account.stripe_subscription_id) return null;

      // Convert AccountData to SubscriptionData for backward compatibility
      return {
        subscription_id: account.stripe_subscription_id,
        customer_id: account.stripe_customer_id!,
        status:
          account.stripe_subscription_status as SubscriptionData['status'],
        current_period_start: account.stripe_current_period_start || 0,
        current_period_end: account.stripe_current_period_end || 0,
        plan_id: account.stripe_plan_id || '',
        plan_name: account.stripe_plan_name || '',
        amount: account.stripe_amount || 0,
        currency: account.stripe_currency || 'usd',
        trial_end: account.stripe_trial_end,
        cancel_at_period_end: account.stripe_cancel_at_period_end || false,
        canceled_at: account.stripe_canceled_at,
        created_at:
          account.stripe_subscription_created_at || account.created_at,
        updated_at:
          account.stripe_subscription_updated_at || account.updated_at,
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
   * @deprecated Use getAccountByFirebaseUid instead
   */
  static async getSubscriptionByFirebaseUid(
    firebaseUid: string,
  ): Promise<SubscriptionData | null> {
    try {
      const account = await this.getAccountByFirebaseUid(firebaseUid);
      if (!account || !account.stripe_subscription_id) return null;

      // Convert AccountData to SubscriptionData for backward compatibility
      return {
        subscription_id: account.stripe_subscription_id,
        customer_id: account.stripe_customer_id!,
        status:
          account.stripe_subscription_status as SubscriptionData['status'],
        current_period_start: account.stripe_current_period_start || 0,
        current_period_end: account.stripe_current_period_end || 0,
        plan_id: account.stripe_plan_id || '',
        plan_name: account.stripe_plan_name || '',
        amount: account.stripe_amount || 0,
        currency: account.stripe_currency || 'usd',
        trial_end: account.stripe_trial_end,
        cancel_at_period_end: account.stripe_cancel_at_period_end || false,
        canceled_at: account.stripe_canceled_at,
        created_at:
          account.stripe_subscription_created_at || account.created_at,
        updated_at:
          account.stripe_subscription_updated_at || account.updated_at,
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
      const invoiceUpdateData: Partial<AccountData> = {
        stripe_latest_invoice_id: invoiceData.invoice_id,
        stripe_latest_invoice_status: invoiceData.status,
        stripe_latest_invoice_amount: invoiceData.amount,
        stripe_latest_invoice_created_at:
          invoiceData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await firestoreService.update(
        this.ACCOUNTS_COLLECTION,
        account.api_user_id,
        invoiceUpdateData,
      );

      logger.info(`FIRESTORE_ACCOUNT_INVOICE_STORED: ${account.api_user_id}`, {
        api_user_id: account.api_user_id,
        stripe_invoice_id: invoiceData.invoice_id,
        stripe_customer_id: invoiceData.customer_id,
      });
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
}
