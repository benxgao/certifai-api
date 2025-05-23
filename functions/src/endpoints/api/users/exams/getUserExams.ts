import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required.',
      });
      return;
    }

    logger.info(`Fetching exams for user_id: ${user_id}`);

    const exams = await prismaInstance.exams.findMany({
      where: {
        user_id: user_id,
      },
      // Optionally, include related data if needed, for example:
      // include: {
      //   certification: true,
      // },
    });

    // findMany returns an empty array if no records are found, so a 404 might not be appropriate here.
    // Sending a 200 with an empty array is common practice.
    // However, if the requirement is to return 404 for no exams, this check can be modified:
    // if (exams.length === 0) {
    //   res.status(404).json({
    //     success: false,
    //     error: 'No exams found for this user.',
    //   });
    //   return;
    // }

    res.status(200).json({
      success: true,
      data: exams,
    });
  } catch (error) {
    logger.error('Error in getUserExams handler:', error as any);
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
