// import { inspect } from 'util';
import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    logger.info(
      `req.firebase_user_info: ${JSON.stringify(req.firebase_user_info)}`,
    );

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    logger.error('Error in /api/users/create:', error as any);
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
