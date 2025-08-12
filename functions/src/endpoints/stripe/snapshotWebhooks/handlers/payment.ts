import Stripe from 'stripe';
import logger from '../../../../services/firebase/logger';
import { StripeFirestoreService } from '../../db';
import { firebaseAuth } from '../../../../services/firebase/admin';
import ResendService from '../../../../services/resend/index.js';

export async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const invoiceData = {
    invoice_id: invoice.id,
    customer_id: invoice.customer as string,
    status: invoice.status || '',
    amount: invoice.amount_paid || 0,
    period_start: invoice.period_start,
    period_end: invoice.period_end,
    created_at: new Date(invoice.created * 1000).toISOString(),
  };

  // Store in unified accounts collection (new approach)
  try {
    await StripeFirestoreService.storeInvoice(invoiceData);
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_INVOICE_STORE_ERROR', {
      error,
      invoice_id: invoice.id,
      customer_id: invoice.customer,
      action: 'store_payment_succeeded',
    });
  }

  logger.info('STRIPE_PAYMENT_SUCCEEDED', {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_paid,
  });
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceData = {
    invoice_id: invoice.id,
    customer_id: invoice.customer as string,
    status: invoice.status || '',
    amount: invoice.amount_due || 0,
    created_at: new Date(invoice.created * 1000).toISOString(),
  };

  // Store in unified accounts collection (new approach)
  try {
    await StripeFirestoreService.storeInvoice(invoiceData);
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_INVOICE_STORE_ERROR', {
      error,
      invoice_id: invoice.id,
      customer_id: invoice.customer,
      action: 'store_payment_failed',
    });
  }

  logger.warn('STRIPE_PAYMENT_FAILED', {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_due,
  });

  // Send payment failed notification to user
  if (invoice.customer && typeof invoice.customer === 'string') {
    try {
      // Get Firebase user by Stripe customer ID
      const userAccount = await StripeFirestoreService.getAccountByCustomerId(
        invoice.customer,
      );

      if (userAccount?.firebase_user_id) {
        const userRecord = await firebaseAuth.getUser(
          userAccount.firebase_user_id,
        );

        if (userRecord.email) {
          await ResendService.sendPaymentFailed({
            email: userRecord.email,
            userName: userRecord.displayName || undefined,
            subscriptionId: (userAccount.stripe_subscription_id ||
              invoice.id) as string,
            amount: invoice.amount_due || 0,
            currency: invoice.currency || 'usd',
            // For retry date, we could add it to the invoice data if needed
            retryDate: undefined,
          });

          logger.info('PAYMENT_FAILED_EMAIL_SENT', {
            invoice_id: invoice.id,
            customer_id: invoice.customer,
            email: userRecord.email,
          });
        }
      }
    } catch (error) {
      logger.error('PAYMENT_FAILED_EMAIL_ERROR', {
        error,
        invoice_id: invoice.id,
        customer_id: invoice.customer,
      });
    }
  }
}

export async function handleUpcomingInvoice(invoice: Stripe.Invoice) {
  const invoiceData = {
    invoice_id: invoice.id,
    customer_id: invoice.customer as string,
    status: invoice.status || '',
    amount: invoice.amount_due || 0,
    created_at: new Date(invoice.created * 1000).toISOString(),
  };

  // Store in unified accounts collection (new approach)
  try {
    await StripeFirestoreService.storeInvoice(invoiceData);
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_INVOICE_STORE_ERROR', {
      error,
      invoice_id: invoice.id,
      customer_id: invoice.customer,
      action: 'store_upcoming_invoice',
    });
  }

  logger.info('STRIPE_UPCOMING_INVOICE', {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_due,
  });

  // TODO: Send upcoming payment notification to user
}
