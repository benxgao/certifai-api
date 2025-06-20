// import { inspect } from 'util';
import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import prismaInstance from '../../../services/prisma';
import {
  extractPaginationParams,
  createPaginatedResponse,
  findManyWithCount,
} from '../../../utils/pagination';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    logger.info(
      `req.firebase_user_info: ${JSON.stringify(req.firebase_user_info)}`,
    );

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 50,
    });

    // Execute findMany and count in parallel
    const { data: certifications, total } = await findManyWithCount(
      prismaInstance.certification.findMany({
        skip: paginationParams.skip,
        take: paginationParams.take,
        orderBy: { cert_id: 'asc' },
      }),
      prismaInstance.certification.count(),
    );

    // Create paginated response
    const response = createPaginatedResponse(
      certifications,
      total,
      paginationParams,
    );

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in /api/certifications/getList:', error as any);
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
