import { Response } from 'express';
import { StripeFirestoreService } from './db';
import { StripeService } from './service';
import logger from '../../services/firebase/logger';

interface CreatePortalSessionRequest {
  return_url: string;
}

export const createPortalSession = async (req: any, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    const { return_url } = req.body as CreatePortalSessionRequest;

    if (!return_url) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: return_url',
      });
      return;
    }

    // Get customer from Firestore
    const customerData = await StripeFirestoreService.getCustomerByFirebaseUid(
      firebaseUserIdFromToken,
    );

    if (!customerData) {
      res.status(404).json({
        success: false,
        error: 'Customer not found. Please create a subscription first.',
      });
      return;
    }

    // Create portal session
    const session = await StripeService.createPortalSession(
      customerData.customer_id,
      return_url,
    );

    res.status(200).json({
      success: true,
      data: {
        portal_url: session.url,
      },
    });
  } catch (error) {
    logger.error('CREATE_PORTAL_SESSION_ERROR', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create portal session',
    });
  }
};
