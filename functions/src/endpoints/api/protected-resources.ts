// import { inspect } from 'util';
import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';

const handler = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
    });
  } catch (error) {
    logger.error('Error in strapi endpoint:', error as any);
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
