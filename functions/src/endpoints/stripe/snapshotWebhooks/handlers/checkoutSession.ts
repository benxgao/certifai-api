import Stripe from 'stripe';
import { firebaseAuth } from '../../../../services/firebase/admin';
import logger from '../../../../services/firebase/logger';
import { StripeFirestoreService } from '../../db';

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const firebaseUid = session.metadata?.firebase_uid;

  if (!firebaseUid) {
    logger.error('STRIPE_CHECKOUT_NO_FIREBASE_UID', { session_id: session.id });
    return;
  }

  try {
    // Get user details from Firebase
    const userRecord = await firebaseAuth.getUser(firebaseUid);
    const apiUserId = userRecord.customClaims?.api_user_id;

    if (!apiUserId) {
      logger.error('STRIPE_CHECKOUT_NO_API_USER_ID', {
        session_id: session.id,
        firebase_uid: firebaseUid,
      });
      return;
    }

    // Store customer data in unified accounts collection
    if (session.customer && userRecord.email) {
      const customerData = {
        customer_id: session.customer as string,
        email: userRecord.email,
        firebase_uid: firebaseUid,
        api_user_id: apiUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await StripeFirestoreService.storeCustomer(customerData);
        logger.info('STRIPE_WEBHOOK_CUSTOMER_STORED', {
          session_id: session.id,
          customer_id: session.customer,
          api_user_id: apiUserId,
        });
      } catch (error) {
        logger.error('STRIPE_WEBHOOK_CUSTOMER_STORE_ERROR', {
          error,
          session_id: session.id,
          customer_id: session.customer,
          api_user_id: apiUserId,
        });
      }
    }

    // Update Firebase custom claims with Stripe customer ID
    await firebaseAuth.setCustomUserClaims(firebaseUid, {
      ...userRecord.customClaims,
      stripe_customer_id: session.customer,
    });

    logger.info('STRIPE_CHECKOUT_COMPLETED', {
      session_id: session.id,
      customer_id: session.customer,
      firebase_uid: firebaseUid,
      api_user_id: apiUserId,
    });
  } catch (error) {
    logger.error('STRIPE_CHECKOUT_PROCESSING_ERROR', {
      error,
      session_id: session.id,
      firebase_uid: firebaseUid,
    });
  }
}
