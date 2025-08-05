import { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from './service';
import { firebaseAuth } from '../../services/firebase/admin';
import logger from '../../services/firebase/logger';
import { StripeFirestoreService } from './db';

export const stripeSnapshotWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('STRIPE_WEBHOOK_SIGNATURE_ERROR', { error: err });
    res.status(400).send(`Webhook signature verification failed.`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.upcoming':
        await handleUpcomingInvoice(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.info(`STRIPE_WEBHOOK_UNHANDLED_EVENT: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_PROCESSING_ERROR', {
      error,
      event_type: event.type,
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const firebaseUid = session.metadata?.firebase_uid;

  if (!firebaseUid) {
    logger.error('STRIPE_CHECKOUT_NO_FIREBASE_UID', { session_id: session.id });
    return;
  }

  // Update Firebase custom claims with Stripe customer ID
  const userRecord = await firebaseAuth.getUser(firebaseUid);

  await firebaseAuth.setCustomUserClaims(firebaseUid, {
    ...userRecord.customClaims,
    stripe_customer_id: session.customer,
    has_subscription: true,
  });

  logger.info('STRIPE_CHECKOUT_COMPLETED', {
    session_id: session.id,
    customer_id: session.customer,
    firebase_uid: firebaseUid,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const firebaseUid = subscription.metadata?.firebase_uid;

  // Get price details
  const price = subscription.items.data[0]?.price;

  const subscriptionData = {
    subscription_id: subscription.id,
    customer_id: customerId,
    status: subscription.status,
    current_period_start: (subscription as any).current_period_start || 0,
    current_period_end: (subscription as any).current_period_end || 0,
    plan_id: price?.id || '',
    plan_name: price?.nickname || price?.lookup_key || 'Unknown Plan',
    amount: price?.unit_amount || 0,
    currency: price?.currency || 'usd',
    trial_end: subscription.trial_end || undefined,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at || undefined,
    created_at: new Date(subscription.created * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  await StripeFirestoreService.storeSubscription(subscriptionData);

  // Update Firebase custom claims
  if (firebaseUid) {
    const userRecord = await firebaseAuth.getUser(firebaseUid);

    await firebaseAuth.setCustomUserClaims(firebaseUid, {
      ...userRecord.customClaims,
      subscription_status: subscription.status,
      subscription_id: subscription.id,
      has_subscription: ['active', 'trialing'].includes(subscription.status),
    });
  }

  logger.info('STRIPE_SUBSCRIPTION_UPDATED', {
    subscription_id: subscription.id,
    status: subscription.status,
    customer_id: customerId,
    firebase_uid: firebaseUid,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const firebaseUid = subscription.metadata?.firebase_uid;

  await StripeFirestoreService.updateSubscriptionStatus(
    subscription.id,
    'canceled',
    (subscription as any).current_period_start || 0,
    (subscription as any).current_period_end || 0,
    subscription.cancel_at_period_end,
    subscription.canceled_at || undefined,
  );

  // Update Firebase custom claims
  if (firebaseUid) {
    const userRecord = await firebaseAuth.getUser(firebaseUid);

    await firebaseAuth.setCustomUserClaims(firebaseUid, {
      ...userRecord.customClaims,
      subscription_status: 'canceled',
      has_subscription: false,
    });
  }

  logger.info('STRIPE_SUBSCRIPTION_DELETED', {
    subscription_id: subscription.id,
    customer_id: subscription.customer,
    firebase_uid: firebaseUid,
  });
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const firebaseUid = subscription.metadata?.firebase_uid;

  // Send notification about trial ending
  logger.info('STRIPE_TRIAL_WILL_END', {
    subscription_id: subscription.id,
    firebase_uid: firebaseUid,
    trial_end: subscription.trial_end,
  });

  // TODO: Send email notification to user
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
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

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  logger.warn('STRIPE_PAYMENT_FAILED', {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_due,
  });

  // TODO: Send payment failed notification to user
}

async function handleUpcomingInvoice(invoice: Stripe.Invoice) {
  logger.info('STRIPE_UPCOMING_INVOICE', {
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount: invoice.amount_due,
  });

  // TODO: Send upcoming payment notification to user
}
