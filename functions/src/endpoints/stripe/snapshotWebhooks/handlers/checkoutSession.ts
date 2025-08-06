import Stripe from 'stripe';
import { firebaseAuth } from '../../../../services/firebase/admin';
import logger from '../../../../services/firebase/logger';

export async function handleCheckoutSessionCompleted(
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
