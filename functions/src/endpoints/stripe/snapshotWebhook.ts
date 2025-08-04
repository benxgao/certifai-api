import { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from './service';
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

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
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
  const { auth } = getAdminSDK();
  const userRecord = await auth.getUser(firebaseUid);

  await auth.setCustomUserClaims(firebaseUid, {
    ...userRecord.customClaims,
    stripe_customer_id: session.customer,
  });

  logger.info('STRIPE_CHECKOUT_COMPLETED', {
    session_id: session.id,
    customer_id: session.customer,
    firebase_uid: firebaseUid,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Get price details
  const price = subscription.items.data[0]?.price;

  const subscriptionData = {
    subscription_id: subscription.id,
    customer_id: customerId,
    status: subscription.status,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    plan_id: price?.id || '',
    plan_name: price?.nickname || price?.lookup_key || 'Unknown Plan',
    amount: price?.unit_amount || 0,
    currency: price?.currency || 'usd',
    created_at: new Date(subscription.created * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  await StripeFirestoreService.storeSubscription(subscriptionData);

  logger.info('STRIPE_SUBSCRIPTION_UPDATED', {
    subscription_id: subscription.id,
    status: subscription.status,
    customer_id: customerId,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await StripeFirestoreService.updateSubscriptionStatus(
    subscription.id,
    'canceled',
  );

  logger.info('STRIPE_SUBSCRIPTION_DELETED', {
    subscription_id: subscription.id,
    customer_id: subscription.customer,
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string,
    );
    await handleSubscriptionUpdated(subscription);
  }

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
}
