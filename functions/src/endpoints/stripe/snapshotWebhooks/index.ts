import { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from '../service';
import logger from '../../../services/firebase/logger';
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleTrialWillEnd,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleUpcomingInvoice,
} from './handlers';
import {
  handleCustomerCreated,
  handleCustomerUpdated,
  handleCustomerDeleted,
} from './handlers/customer';

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

export const stripeSnapshotWebhook = async (
  req: StripeWebhookRequest,
  res: Response,
) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    if (!req.rawBody) {
      throw new Error('Webhook has no body.');
    }

    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);

    logger.info('STRIPE_WEBHOOK_VERIFICATION_SUCCESS', {
      eventType: event.type,
      eventId: event.id,
    });
  } catch (err) {
    logger.error('STRIPE_WEBHOOK_SIGNATURE_ERROR', {
      error: err,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      errorCode: err instanceof Error && 'code' in err ? err.code : null,
      hasSignature: !!sig,
      hasEndpointSecret: !!endpointSecret,
      bodyType: typeof req.rawBody,
      bodyLength: req.rawBody?.length || 0,
      isBuffer: Buffer.isBuffer(req.rawBody),
    });

    res.status(400).send(`Webhook signature verification failed.`);
    return;
  }

  try {
    switch (event.type) {
      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;
      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;
      case 'customer.deleted':
        await handleCustomerDeleted(event.data.object as Stripe.Customer);
        break;

      case 'payment_intent.created':
        break;
      case 'charge.succeeded':
        break;
      case 'payment_method.attached':
        break;
      case 'payment_intent.succeeded':
        break;

      case 'invoice.created':
        break;
      case 'invoice.finalized':
        break;
      case 'invoice.paid':
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
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

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
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
