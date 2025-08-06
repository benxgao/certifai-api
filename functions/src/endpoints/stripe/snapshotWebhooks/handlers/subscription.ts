import Stripe from 'stripe';
import { firebaseAuth } from '../../../../services/firebase/admin';
import logger from '../../../../services/firebase/logger';
import { StripeFirestoreService } from '../../db';

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
) {
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

  // Store in unified accounts collection (new approach)
  try {
    await StripeFirestoreService.storeSubscription(subscriptionData);
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_ACCOUNT_UPDATE_ERROR', {
      error,
      subscription_id: subscription.id,
      customer_id: customerId,
      action: 'store_subscription',
    });
    // Continue with Firebase claims update even if account storage fails
  }

  // Update Firebase custom claims
  if (firebaseUid) {
    try {
      const userRecord = await firebaseAuth.getUser(firebaseUid);

      await firebaseAuth.setCustomUserClaims(firebaseUid, {
        ...userRecord.customClaims,
        subscription_status: subscription.status,
        subscription_id: subscription.id,
        has_subscription: ['active', 'trialing'].includes(subscription.status),
      });

      logger.info('STRIPE_WEBHOOK_FIREBASE_CLAIMS_UPDATED', {
        firebase_uid: firebaseUid,
        subscription_id: subscription.id,
        subscription_status: subscription.status,
      });
    } catch (error) {
      logger.error('STRIPE_WEBHOOK_FIREBASE_CLAIMS_ERROR', {
        error,
        firebase_uid: firebaseUid,
        subscription_id: subscription.id,
      });
    }
  }

  logger.info('STRIPE_SUBSCRIPTION_UPDATED', {
    subscription_id: subscription.id,
    status: subscription.status,
    customer_id: customerId,
    firebase_uid: firebaseUid,
  });
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
) {
  const firebaseUid = subscription.metadata?.firebase_uid;

  // Update unified accounts collection (new approach)
  try {
    await StripeFirestoreService.updateSubscriptionStatus(
      subscription.id,
      'canceled',
      (subscription as any).current_period_start || 0,
      (subscription as any).current_period_end || 0,
      subscription.cancel_at_period_end,
      subscription.canceled_at || undefined,
    );
  } catch (error) {
    logger.error('STRIPE_WEBHOOK_ACCOUNT_UPDATE_ERROR', {
      error,
      subscription_id: subscription.id,
      customer_id: subscription.customer,
      action: 'update_subscription_status',
    });
    // Continue with Firebase claims update even if account storage fails
  }

  // Update Firebase custom claims
  if (firebaseUid) {
    try {
      const userRecord = await firebaseAuth.getUser(firebaseUid);

      await firebaseAuth.setCustomUserClaims(firebaseUid, {
        ...userRecord.customClaims,
        subscription_status: 'canceled',
        has_subscription: false,
      });

      logger.info('STRIPE_WEBHOOK_FIREBASE_CLAIMS_UPDATED', {
        firebase_uid: firebaseUid,
        subscription_id: subscription.id,
        subscription_status: 'canceled',
      });
    } catch (error) {
      logger.error('STRIPE_WEBHOOK_FIREBASE_CLAIMS_ERROR', {
        error,
        firebase_uid: firebaseUid,
        subscription_id: subscription.id,
      });
    }
  }

  logger.info('STRIPE_SUBSCRIPTION_DELETED', {
    subscription_id: subscription.id,
    customer_id: subscription.customer,
    firebase_uid: firebaseUid,
  });
}

export async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const firebaseUid = subscription.metadata?.firebase_uid;

  // Send notification about trial ending
  logger.info('STRIPE_TRIAL_WILL_END', {
    subscription_id: subscription.id,
    firebase_uid: firebaseUid,
    trial_end: subscription.trial_end,
  });

  // TODO: Send email notification to user
}
