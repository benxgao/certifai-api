/**
 * STRIPE FIRESTORE INTEGRATION - REFACTORED FOR MODULAR STRUCTURE
 *
 * This service now includes intelligent change detection to ensure Firestore
 * is only updated when there are actual differences between stored and enriched
 * Stripe data. Key features:
 *
 * 1. CHANGE DETECTION: All store/update methods now detect changes before writing
 * 2. SELECTIVE UPDATES: Only changed fields are written to Firestore
 * 3. SYNC METHODS: New methods to sync account data with latest Stripe information
 * 4. WEBHOOK SUPPORT: Methods for webhook handlers to update accounts by customer ID
 * 5. BATCH OPERATIONS: Support for bulk syncing multiple accounts
 * 6. MODULAR STRUCTURE: Functions are organized into separate files by responsibility
 *
 * Usage Examples:
 *
 * // Get enriched data and auto-sync Firestore (default behavior)
 * const enrichedAccount = await StripeFirestoreService.getEnrichedAccountData(apiUserId);
 *
 * // Get enriched data without updating Firestore
 * const enrichedAccount = await StripeFirestoreService.getEnrichedAccountData(
 *   apiUserId,
 *   { updateFirestore: false }
 * );
 *
 * // Manually sync account with Stripe
 * await StripeFirestoreService.syncAccountWithStripe(apiUserId);
 *
 * // Sync account by customer ID (useful for webhooks)
 * await StripeFirestoreService.syncAccountWithStripeByCustomerId(customerId);
 *
 * // Batch sync multiple accounts
 * const results = await StripeFirestoreService.batchSyncAccountsWithStripe([
 *   'user1', 'user2', 'user3'
 * ]);
 */

// Re-export types
export { AccountData, FullAccountData } from './types';

// Re-export utility functions
export { cleanFirestoreData, detectAccountDataChanges } from './utils';

// Re-export customer operations
export { storeCustomer } from './customer';

// Re-export account operations
export {
  createAccount,
  getAccountByFirebaseUid,
  getAccountByApiUserId,
  getAccountByCustomerId,
  updateAccount,
  hasActiveSubscription,
  getSubscriptionStatus,
} from './account';

// Re-export subscription operations
export {
  storeSubscription,
  updateSubscriptionStatus,
  convertToSubscriptionData,
  syncLatestSubscriptionFromStripe,
} from './subscription';

// Re-export invoice operations
export { storeInvoice } from './invoice';

// Re-export sync operations
export {
  getEnrichedAccountDataByFirebaseUid,
  getEnrichedAccountData,
  syncAccountWithStripe,
  syncAccountWithStripeByCustomerId,
  batchSyncAccountsWithStripe,
} from './sync';

// Import operations for the main service class
import {
  createAccount,
  getAccountByFirebaseUid,
  getAccountByApiUserId,
  getAccountByCustomerId,
  updateAccount,
  hasActiveSubscription,
  getSubscriptionStatus,
} from './account';

import { storeCustomer } from './customer';

import {
  storeSubscription,
  updateSubscriptionStatus,
  convertToSubscriptionData,
  syncLatestSubscriptionFromStripe,
} from './subscription';

import { storeInvoice } from './invoice';

import {
  getEnrichedAccountDataByFirebaseUid,
  getEnrichedAccountData,
  syncAccountWithStripe,
  syncAccountWithStripeByCustomerId,
  batchSyncAccountsWithStripe,
} from './sync';

import { SubscriptionData } from '../service';
import { AccountData, FullAccountData } from './types';

/**
 * Main service class that provides a unified interface to all Stripe Firestore operations
 * This class maintains backward compatibility while delegating to the modular functions
 */
export class StripeFirestoreService {

  // Customer operations
  static async storeCustomer(customerData: any): Promise<void> {
    return storeCustomer(customerData);
  }

  // Account CRUD operations
  static async createAccount(accountData: {
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
    return createAccount(accountData);
  }

  static async getAccountByFirebaseUid(firebaseUid: string): Promise<AccountData | null> {
    return getAccountByFirebaseUid(firebaseUid);
  }

  static async getAccountByApiUserId(apiUserId: string): Promise<AccountData | null> {
    return getAccountByApiUserId(apiUserId);
  }

  static async getAccountByCustomerId(customerId: string): Promise<AccountData | null> {
    return getAccountByCustomerId(customerId);
  }

  static async updateAccount(apiUserId: string, updateData: Partial<AccountData>): Promise<void> {
    return updateAccount(apiUserId, updateData);
  }

  static async hasActiveSubscription(apiUserId: string): Promise<boolean> {
    return hasActiveSubscription(apiUserId);
  }

  static async getSubscriptionStatus(apiUserId: string): Promise<string | null> {
    return getSubscriptionStatus(apiUserId);
  }

  // Subscription operations
  static async storeSubscription(subscriptionData: SubscriptionData): Promise<void> {
    return storeSubscription(subscriptionData);
  }

  static async updateSubscriptionStatus(
    subscriptionId: string,
    status: string,
    currentPeriodStart?: number,
    currentPeriodEnd?: number,
    cancelAtPeriodEnd?: boolean,
    canceledAt?: number,
    subscriptionUpdatedAt?: string,
  ): Promise<void> {
    return updateSubscriptionStatus(
      subscriptionId,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      canceledAt,
      subscriptionUpdatedAt,
    );
  }

  static convertToSubscriptionData(enrichedAccount: FullAccountData): SubscriptionData | null {
    return convertToSubscriptionData(enrichedAccount);
  }

  static async syncLatestSubscriptionFromStripe(customerId: string): Promise<void> {
    return syncLatestSubscriptionFromStripe(customerId);
  }

  // Invoice operations
  static async storeInvoice(invoiceData: any): Promise<void> {
    return storeInvoice(invoiceData);
  }

  // Sync operations
  static async getEnrichedAccountDataByFirebaseUid(
    firebaseUid: string,
    options: { updateFirestore?: boolean } = { updateFirestore: true },
  ): Promise<FullAccountData | null> {
    return getEnrichedAccountDataByFirebaseUid(firebaseUid, options);
  }

  static async getEnrichedAccountData(
    apiUserId: string,
    options: { updateFirestore?: boolean } = { updateFirestore: true },
  ): Promise<FullAccountData | null> {
    return getEnrichedAccountData(apiUserId, options);
  }

  static async syncAccountWithStripe(apiUserId: string): Promise<void> {
    return syncAccountWithStripe(apiUserId);
  }

  static async syncAccountWithStripeByCustomerId(customerId: string): Promise<void> {
    return syncAccountWithStripeByCustomerId(customerId);
  }

  static async batchSyncAccountsWithStripe(apiUserIds: string[]): Promise<{
    success: string[];
    failed: { apiUserId: string; error: string }[];
  }> {
    return batchSyncAccountsWithStripe(apiUserIds);
  }

  // Legacy methods for backward compatibility
  static async getCompleteAccountData(apiUserId: string): Promise<AccountData | null> {
    return getAccountByApiUserId(apiUserId);
  }

  static async getCompleteAccountDataByFirebaseUid(firebaseUid: string): Promise<AccountData | null> {
    return getAccountByFirebaseUid(firebaseUid);
  }
}
