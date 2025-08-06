import Stripe from 'stripe';
import { logger } from 'firebase-functions/v2';
import { StripeFirestoreService } from '../../db';

export async function handleCustomerCreated(customer: Stripe.Customer) {
  try {
    // For customer.created, we might not have the account yet (depends on flow)
    // Just log the event and let other webhook events handle the account update
    logger.info('STRIPE_CUSTOMER_CREATED', {
      customer_id: customer.id,
      email: customer.email,
      action: 'customer_created_logged',
    });

    // Try to find and update existing account
    const existingAccount = await StripeFirestoreService.getAccountByCustomerId(
      customer.id,
    );
    if (existingAccount) {
      const updatedData: Partial<any> = {
        stripe_customer_created_at: new Date(
          customer.created * 1000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      };

      await StripeFirestoreService.updateAccount(
        existingAccount.api_user_id,
        updatedData,
      );

      logger.info('STRIPE_CUSTOMER_CREATED_ACCOUNT_UPDATED', {
        customer_id: customer.id,
        api_user_id: existingAccount.api_user_id,
        email: customer.email,
      });
    }
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_CUSTOMER_CREATED_ERROR', {
      error,
      customer_id: customer.id,
      email: customer.email,
      action: 'handle_customer_created',
    });
  }
}

export async function handleCustomerUpdated(customer: Stripe.Customer) {
  try {
    // Find existing account by customer ID
    const existingAccount = await StripeFirestoreService.getAccountByCustomerId(
      customer.id,
    );
    if (!existingAccount) {
      logger.warn('STRIPE_CUSTOMER_UPDATED_NO_ACCOUNT', {
        customer_id: customer.id,
        email: customer.email,
        action: 'customer_updated_no_account_found',
      });
      return;
    }

    // Update account with latest customer data
    const updatedData: Partial<any> = {
      email: customer.email || existingAccount.email,
      updated_at: new Date().toISOString(),
    };

    await StripeFirestoreService.updateAccount(
      existingAccount.api_user_id,
      updatedData,
    );

    logger.info('STRIPE_CUSTOMER_UPDATED', {
      customer_id: customer.id,
      api_user_id: existingAccount.api_user_id,
      email: customer.email,
      action: 'customer_updated_account_synced',
    });
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_CUSTOMER_UPDATED_ERROR', {
      error,
      customer_id: customer.id,
      email: customer.email,
      action: 'handle_customer_updated',
    });
  }
}

export async function handleCustomerDeleted(customer: Stripe.Customer) {
  try {
    // Find existing account by customer ID
    const existingAccount = await StripeFirestoreService.getAccountByCustomerId(
      customer.id,
    );
    if (!existingAccount) {
      logger.warn('STRIPE_CUSTOMER_DELETED_NO_ACCOUNT', {
        customer_id: customer.id,
        email: customer.email,
        action: 'customer_deleted_no_account_found',
      });
      return;
    }

    // Mark customer as deleted in account
    const updatedData: Partial<any> = {
      stripe_customer_deleted: true,
      stripe_customer_deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await StripeFirestoreService.updateAccount(
      existingAccount.api_user_id,
      updatedData,
    );

    logger.info('STRIPE_CUSTOMER_DELETED', {
      customer_id: customer.id,
      api_user_id: existingAccount.api_user_id,
      email: customer.email,
      action: 'customer_marked_deleted',
    });
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_CUSTOMER_DELETE_ERROR', {
      error,
      customer_id: customer.id,
      email: customer.email,
      action: 'handle_customer_deleted',
    });
  }
}
