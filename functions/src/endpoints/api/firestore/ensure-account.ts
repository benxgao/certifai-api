import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest, FirebaseJwtToken } from '../../../types';
import { StripeFirestoreService } from '../../stripe/db';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const firebaseUser: FirebaseJwtToken = req.firebase_user_info;

    if (!firebaseUser) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing Firebase JWT token',
      });
      return;
    }

    // Extract Firebase user ID
    const firebaseUserId =
      firebaseUser.user_id || firebaseUser.uid || firebaseUser.sub;

    if (!firebaseUserId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase user ID could not be determined',
      });
      return;
    }

    // Get request body
    const { api_user_id, email } = req.body;

    if (!api_user_id) {
      res.status(400).json({
        success: false,
        error: 'API user ID is required',
      });
      return;
    }

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      });
      return;
    }

    let accountCreated = false;

    try {
      // Check if Firestore account already exists
      let firestoreAccount =
        await StripeFirestoreService.getAccountByFirebaseUid(firebaseUserId);

      if (!firestoreAccount) {
        // Create default Firestore account record
        const defaultAccountData = {
          api_user_id: api_user_id,
          firebase_user_id: firebaseUserId,
          email: email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await StripeFirestoreService.createAccount(defaultAccountData);
        accountCreated = true;

        logger.info('FIRESTORE_ACCOUNT_CREATED_VIA_ENSURE_ENDPOINT', {
          api_user_id: api_user_id,
          firebase_user_id: firebaseUserId,
          email: email,
        });
      } else {
        // Update the existing account's updated_at timestamp
        await StripeFirestoreService.updateAccount(api_user_id, {
          updated_at: new Date().toISOString(),
        });

        logger.info('FIRESTORE_ACCOUNT_UPDATED_VIA_ENSURE_ENDPOINT', {
          api_user_id: api_user_id,
          firebase_user_id: firebaseUserId,
        });
      }
    } catch (firestoreError) {
      logger.error('FIRESTORE_ACCOUNT_ENSURE_ERROR', {
        error: firestoreError,
        api_user_id: api_user_id,
        firebase_user_id: firebaseUserId,
        error_details:
          firestoreError instanceof Error
            ? firestoreError.message
            : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to ensure Firestore account',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: accountCreated
        ? 'Firestore account created successfully'
        : 'Firestore account already exists',
      account_created: accountCreated,
      api_user_id: api_user_id,
      firebase_user_id: firebaseUserId,
    });
  } catch (error) {
    logger.error('Error in firestore ensure-account endpoint:', error as any);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
