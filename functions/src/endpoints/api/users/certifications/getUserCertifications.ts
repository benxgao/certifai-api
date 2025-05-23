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

    logger.info(`Fetching certifications for user_id: ${user_id}`); // Changed

    // Assuming 'certification' is the Prisma model for certifications associated with a user.
    // Adjust the model name if yours is different (e.g., userCertification, achievedCertification).
    const certifications = await prismaInstance.userCertification.findMany({
      // Changed model and variable
      where: {
        user_id: user_id,
      },
      include: {
        certification: true, // Include details from the related 'Certification' model
      },
    });

    res.status(200).json({
      success: true,
      data: certifications || [],
    });
  } catch (error) {
    logger.error('Error in getUserCertifications handler:', error as any); // Changed message
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
