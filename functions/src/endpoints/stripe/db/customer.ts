import { firestoreService } from '../../../services/firebase/firestore';
import logger from '../../../services/firebase/logger';
import { StripeCustomerData } from '../service';
import { AccountData } from './types';
import { cleanFirestoreData } from './utils';

/**
 * STRIPE CUSTOMER OPERATIONS
 *
 * Functions for managing customer data in Firestore
 */

const ACCOUNTS_COLLECTION = 'accounts';

/**
 * Store or update account data with customer information (MINIMAL DATA ONLY)
 */
export async function storeCustomer(
  customerData: StripeCustomerData,
): Promise<void> {
  try {
    const accountData: Partial<AccountData> = {
      api_user_id: customerData.api_user_id,
      firebase_user_id: customerData.firebase_uid,
      email: customerData.email,
      stripe_customer_id: customerData.customer_id,
      // Use Stripe customer timestamp if available, otherwise current time
      updated_at: customerData.updated_at || new Date().toISOString(),
    };

    // Check if account already exists
    const existingAccount = await firestoreService.read<AccountData>(
      ACCOUNTS_COLLECTION,
      customerData.api_user_id,
    );

    if (existingAccount) {
      // Check for changes before updating
      const changes: Partial<AccountData> = {};
      let hasChanges = false;

      // Compare key customer fields
      if (existingAccount.email !== accountData.email) {
        changes.email = accountData.email;
        hasChanges = true;
      }
      if (
        existingAccount.stripe_customer_id !== accountData.stripe_customer_id
      ) {
        changes.stripe_customer_id = accountData.stripe_customer_id;
        hasChanges = true;
      }
      if (accountData.updated_at) {
        changes.updated_at = accountData.updated_at;
        hasChanges = true;
      }

      if (hasChanges) {
        // Update existing account - clean undefined values
        const cleanedAccountData = cleanFirestoreData(changes);
        await firestoreService.update(
          ACCOUNTS_COLLECTION,
          customerData.api_user_id,
          cleanedAccountData,
          { skipAutoTimestamps: true },
        );

        logger.info(
          `FIRESTORE_ACCOUNT_CUSTOMER_UPDATED_WITH_CHANGES: ${customerData.api_user_id}`,
          {
            api_user_id: customerData.api_user_id,
            stripe_customer_id: customerData.customer_id,
            firebase_user_id: customerData.firebase_uid,
            email: customerData.email,
            changes_detected: Object.keys(changes),
            old_values: {
              email: existingAccount.email,
              stripe_customer_id: existingAccount.stripe_customer_id,
            },
            new_values: changes,
            storage_type: 'minimal_data_only',
          },
        );
      } else {
        logger.info(
          `FIRESTORE_ACCOUNT_CUSTOMER_NO_CHANGES: ${customerData.api_user_id}`,
          {
            api_user_id: customerData.api_user_id,
            stripe_customer_id: customerData.customer_id,
            action: 'customer_data_unchanged',
            storage_type: 'minimal_data_only',
          },
        );
      }
    } else {
      // Create new account - use Stripe customer created timestamp if available
      accountData.created_at =
        customerData.created_at || new Date().toISOString();
      const cleanedAccountData = cleanFirestoreData(accountData as AccountData);
      await firestoreService.create(
        ACCOUNTS_COLLECTION,
        cleanedAccountData,
        customerData.api_user_id,
        { skipAutoTimestamps: true },
      );

      logger.info(
        `FIRESTORE_ACCOUNT_CUSTOMER_CREATED: ${customerData.api_user_id}`,
        {
          api_user_id: customerData.api_user_id,
          stripe_customer_id: customerData.customer_id,
          firebase_user_id: customerData.firebase_uid,
          email: customerData.email,
          action: 'new_customer_account_created',
          storage_type: 'minimal_data_only',
        },
      );
    }
  } catch (error) {
    logger.error('FIRESTORE_ACCOUNT_CUSTOMER_STORE_ERROR', {
      error,
      api_user_id: customerData.api_user_id,
      stripe_customer_id: customerData.customer_id,
    });
    throw new Error(`Failed to store customer in accounts: ${error}`);
  }
}
