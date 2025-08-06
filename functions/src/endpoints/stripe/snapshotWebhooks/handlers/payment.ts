import Stripe from 'stripe';
import logger from '../../../../services/firebase/logger';
import { StripeFirestoreService } from '../../db';

export async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // Store invoice data
  const invoiceData = {
    invoice_id: invoice.id,
    customer_id: invoice.customer as string,
    subscription_id: '',
    amount_paid: invoice.amount_paid,
    amount_due: invoice.amount_due,
    currency: invoice.currency,
    status: invoice.status || '',
    period_start: invoice.period_start,
    period_end: invoice.period_end,
    created_at: new Date(invoice.created * 1000).toISOString(),
  };

  await StripeFirestoreService.storeInvoice(invoiceData);

  logger.info('STRIPE_PAYMENT_SUCCEEDED', {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_paid,
  });
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  logger.warn('STRIPE_PAYMENT_FAILED', {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_due,
  });

  // TODO: Send payment failed notification to user
}

export async function handleUpcomingInvoice(invoice: Stripe.Invoice) {
  logger.info('STRIPE_UPCOMING_INVOICE', {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_due,
  });

  // TODO: Send upcoming payment notification to user
}
