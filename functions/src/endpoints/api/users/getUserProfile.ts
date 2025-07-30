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
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;
    const verifiedUser = (req as any).verified_user; // Added by verifyUserAccess middleware

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required.',
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

    // User verification is now handled by verifyUserAccess middleware
    // We can use the verified user directly
    if (!verifiedUser) {
      res.status(500).json({
        success: false,
        error: 'User verification middleware not properly configured',
      });
      return;
    }

    logger.info(`Getting user profile for user_id: ${user_id}`);

    // Get the full user profile data
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

    logger.info(
      `Successfully retrieved profile for user ${user.user_id} with ${user.credit_tokens} credit tokens.`,
    );

    res.status(200).json({
      success: true,
      data: {
        api_user_id: user.user_id, // Our internal UUID for API operations
        firebase_user_id: user.firebase_user_id, // Firebase UID for reference
        credit_tokens: user.credit_tokens,
        energy_tokens: user.energy_tokens,
        created_at: user.created_at,
        updated_at: user.updated_at,
        // Deprecated: keeping for backward compatibility only
        user_id: user.user_id, // @deprecated Use api_user_id instead
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
