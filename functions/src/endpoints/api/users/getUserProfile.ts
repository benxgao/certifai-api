import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import prismaInstance from '../../../services/prisma';

const handler = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required in path.',
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    logger.info(`Getting user profile for user_id: ${user_id}`);

    // Find the user by the provided user_id (internal UUID)
    const user = await prismaInstance.user.findUnique({
      where: { user_id: user_id },
      select: {
        user_id: true,
        firebase_user_id: true,
        credit_tokens: true,
        energy_tokens: true,
        created_at: true,
        updated_at: true,
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
        `Forbidden: Firebase user ${firebaseUserIdFromToken} attempted to access profile for user ${user_id}.`,
      );
      res.status(403).json({
        success: false,
        error: 'Forbidden: You can only access your own user profile.',
      });
      return;
    }

    logger.info(
      `Successfully retrieved profile for user ${user.user_id} with ${user.credit_tokens} credit tokens.`,
    );

    res.status(200).json({
      success: true,
      data: {
        user_id: user.user_id,
        firebase_user_id: user.firebase_user_id,
        credit_tokens: user.credit_tokens,
        energy_tokens: user.energy_tokens,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error in getUserProfile handler:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
