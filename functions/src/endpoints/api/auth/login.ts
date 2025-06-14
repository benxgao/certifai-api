// import { inspect } from 'util';
import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import { CustomRequest, FirebaseJwtToken } from '../../../types';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const firebaseUser: FirebaseJwtToken = req.firebase_user_info;

    logger.info(`req.firebase_user_info: ${JSON.stringify(firebaseUser)}`);

    if (!firebaseUser) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing Firebase JWT token',
      });
    }

    const firebaseUserId = firebaseUser.user_id as string;

    if (!firebaseUserId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase user ID could not be determined',
      });
    }

    const user = await prismaInstance.user.update({
      where: {
        firebase_user_id: firebaseUserId,
      },
      data: {
        updated_at: new Date(), // Update the updatedAt field to the current time
      },
      select: {
        user_id: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found for the provided Firebase ID',
      });
    }

    res.status(200).json({
      success: true,
      user_id: user?.user_id,
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
