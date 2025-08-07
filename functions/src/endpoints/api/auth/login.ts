// import { inspect } from 'util';
import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import { CustomRequest, FirebaseJwtToken } from '../../../types';
import { StripeFirestoreService } from '../../stripe/db';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const firebaseUser: FirebaseJwtToken = req.firebase_user_info;

    logger.info(`req.firebase_user_info: ${JSON.stringify(firebaseUser)}`);

    if (!firebaseUser) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing Firebase JWT token',
      });
      return;
    }

    // Extract Firebase user ID - this is NOT the api_user_id, it's the Firebase UID
    const firebaseUserId =
      firebaseUser.user_id || firebaseUser.uid || firebaseUser.sub;

    if (!firebaseUserId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase user ID could not be determined',
      });
      return;
    }

    const user = await prismaInstance.user.update({
      where: {
        firebase_user_id: firebaseUserId, // Use Firebase UID to find our user record
      },
      data: {
        updated_at: new Date(), // Update the updatedAt field to the current time
      },
      select: {
        user_id: true, // This is our internal api_user_id (UUID)
        firebase_user_id: true, // This is the Firebase UID for reference
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found for the provided Firebase ID',
      });
      return;
    }

    // Check and create Firestore account record if it doesn't exist
    try {
      let firestoreAccount =
        await StripeFirestoreService.getAccountByFirebaseUid(firebaseUserId);

      if (!firestoreAccount) {
        // Create default Firestore account record
        const defaultAccountData = {
          api_user_id: user.user_id,
          firebase_user_id: firebaseUserId,
          email: firebaseUser.email || '', // Get email from Firebase token
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await StripeFirestoreService.createAccount(defaultAccountData);

        logger.info('FIRESTORE_ACCOUNT_CREATED_ON_LOGIN', {
          api_user_id: user.user_id,
          firebase_user_id: firebaseUserId,
          email: firebaseUser.email,
        });
      } else {
        // Update the existing account's updated_at timestamp
        await StripeFirestoreService.updateAccount(user.user_id, {
          updated_at: new Date().toISOString(),
        });

        logger.info('FIRESTORE_ACCOUNT_UPDATED_ON_LOGIN', {
          api_user_id: user.user_id,
          firebase_user_id: firebaseUserId,
        });
      }
    } catch (firestoreError) {
      // Log the error but don't fail the login process
      logger.warn('FIRESTORE_ACCOUNT_CHECK_ERROR_ON_LOGIN', {
        error: firestoreError,
        api_user_id: user.user_id,
        firebase_user_id: firebaseUserId,
        error_details:
          firestoreError instanceof Error
            ? firestoreError.message
            : 'Unknown error',
      });
    }

    res.status(200).json({
      success: true,
      api_user_id: user.user_id, // Our internal UUID for API operations
      firebase_user_id: firebaseUserId, // Firebase UID for reference
      // Deprecated: keeping for backward compatibility only
      user_id: user.user_id, // @deprecated Use api_user_id instead
    });
  } catch (error) {
    logger.error('Error in /api/auth/login:', error as any);

    res
      .status(
        error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
      )
      .json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
  }
};

export default handler;
