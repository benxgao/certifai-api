import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';
import {
  extractPaginationParams,
  createPaginatedResponse,
  findManyWithCount,
} from '../../../../utils/pagination';

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

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 50,
    });

    // Support filtering by cert_id if provided as a query parameter
    const { cert_id } = req.query;
    const whereClause: any = {
      user_id: user_id,
    };
    if (cert_id) {
      whereClause.cert_id = Number(cert_id);
    }

    // Assuming 'certification' is the Prisma model for certifications associated with a user.
    // Adjust the model name if yours is different (e.g., userCertification, achievedCertification).
    const { data: certifications, total } = await findManyWithCount(
      prismaInstance.userCertification.findMany({
        where: whereClause,
        include: {
          certification: true, // Include details from the related 'Certification' model
        },
        skip: paginationParams.skip,
        take: paginationParams.take,
        orderBy: { assigned_at: 'desc' },
      }),
      prismaInstance.userCertification.count({
        where: whereClause,
      }),
    );

    // Create paginated response
    const response = createPaginatedResponse(
      certifications || [],
      total,
      paginationParams,
    );

    res.status(200).json(response);
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
