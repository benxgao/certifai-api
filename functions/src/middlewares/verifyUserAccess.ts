import { Response, NextFunction } from 'express';

import prismaInstance from '../services/prisma';
import logger from '../services/firebase/logger';
import { AuthenticatedRequest } from '../types/express';

/**
 * Middleware to verify that the requesting Firebase user has access to the specified user_id
 * This middleware should be used after verifyFirebaseToken middleware
 *
 * Validates:
 * 1. The user_id parameter exists in the request
 * 2. The user exists in the database
 * 3. The Firebase user ID from the token matches the user's firebase_user_id
 *
 * Usage:
 * router.get('/users/:user_id/profile', verifyFirebaseToken, verifyUserAccess, getUserProfile);
 */
export const verifyUserAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { user_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.uid;

    // Check if Firebase token was verified in previous middleware
    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Check if user_id parameter is provided
    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    // logger.info(
    //   `VERIFY_USER_ACCESS: Checking access for user_id=${user_id}, firebase_user=${firebaseUserIdFromToken}`,
    // );

    // Find the user by user_id and get their firebase_user_id
    const user = await prismaInstance.user.findUnique({
      where: { user_id: user_id },
      select: {
        user_id: true,
        firebase_user_id: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: `User with ID: ${user_id} not found.`,
      });
      return;
    }

    // Authorization: Check if the firebase_user_id from token matches the user's firebase_user_id
    if (user.firebase_user_id !== firebaseUserIdFromToken) {
      logger.warn(
        `VERIFY_USER_ACCESS: Forbidden - Firebase user ${firebaseUserIdFromToken} attempted to access resources for user ${user_id} (actual firebase_user_id: ${user.firebase_user_id}).`,
      );
      res.status(403).json({
        success: false,
        error: 'Forbidden: You can only access your own resources.',
      });
      return;
    }

    // Add the verified user to the request object for downstream handlers
    req.verified_user = user;

    // logger.info(
    //   `VERIFY_USER_ACCESS: Access granted for user_id=${user_id}, firebase_user=${firebaseUserIdFromToken}`,
    // );

    next();
  } catch (error) {
    logger.error('VERIFY_USER_ACCESS_ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify user access',
    });
  }
};
