import { Response } from 'express';
import { StripeService } from './service';
import { StripeFirestoreService } from './db';
import logger from '../../services/firebase/logger';

interface CreateCheckoutSessionRequest {
  price_id: string;
  success_url: string;
  cancel_url: string;
}

export const createCheckoutSession = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    const { price_id, success_url, cancel_url } =
      req.body as CreateCheckoutSessionRequest;

    if (!price_id || !success_url || !cancel_url) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: price_id, success_url, cancel_url',
      });
      return;
    }

    // Get user details from Firebase
    const { auth } = getAdminSDK();
    const userRecord = await auth.getUser(firebaseUserIdFromToken);

    if (!userRecord.email) {
      res.status(400).json({
        success: false,
        error: 'User email is required for Stripe operations',
      });
      return;
    }

    // Get or create Stripe customer
    const customer = await StripeService.createOrGetCustomer(
      userRecord.email,
      firebaseUserIdFromToken,
      userRecord.customClaims?.api_user_id || '',
      userRecord.displayName || undefined,
    );

    // Store customer in Firestore
    await StripeFirestoreService.storeCustomer({
      customer_id: customer.id,
      email: userRecord.email,
      firebase_uid: firebaseUserIdFromToken,
      api_user_id: userRecord.customClaims?.api_user_id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Create checkout session
    const session = await StripeService.createCheckoutSession(
      customer.id,
      price_id,
      success_url,
      cancel_url,
      firebaseUserIdFromToken,
    );

    res.status(200).json({
      success: true,
      data: {
        checkout_url: session.url,
        session_id: session.id,
      },
    });
  } catch (error) {
    logger.error('CREATE_CHECKOUT_SESSION_ERROR', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
    });
  }
};
