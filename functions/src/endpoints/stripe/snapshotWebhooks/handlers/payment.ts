import Stripe from 'stripe';
import logger from '../../../../services/firebase/logger';
import { StripeFirestoreService } from '../../db';

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

  // TODO: Send payment failed notification to user
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
