import { firestoreService } from '../../../services/firebase/firestore';
import logger from '../../../services/firebase/logger';
import { AccountData } from './types';

/**
 * STRIPE INVOICE OPERATIONS
 *
 * Functions for managing invoice data in Firestore
 */

const ACCOUNTS_COLLECTION = 'accounts';

/**
 * Store latest invoice data in account
 */
export async function storeInvoice(invoiceData: { customer_id: string; invoice_id: string; [key: string]: unknown }): Promise<void> {
  try {
    // Find account by customer ID
    const accounts = await firestoreService.list<AccountData>(
      ACCOUNTS_COLLECTION,
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
      ACCOUNTS_COLLECTION,
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
