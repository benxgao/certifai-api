import { Response } from 'express';
import logger from '../../services/firebase/logger';
import { CustomRequest } from '../../types';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    res.status(200).json({});
  } catch (error) {
    logger.error('Error in  handler:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
