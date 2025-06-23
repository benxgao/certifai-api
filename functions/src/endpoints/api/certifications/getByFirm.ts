import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import prismaInstance from '../../../services/prisma';
import {
  extractPaginationParams,
  createPaginatedResponse,
  findManyWithCount,
} from '../../../utils/pagination';
import firmService from '../../../services/firms';

/**
 * Get certifications by firm ID with pagination
 */
const getCertificationsByFirm = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { firmId } = req.params;

    const firmIdNum = parseInt(firmId, 10);
    if (isNaN(firmIdNum)) {
      res.status(400).json({
        success: false,
        error: 'Invalid firm ID. Must be a number.',
      });
      return;
    }

    logger.info(
      `Getting certifications for firm_id: ${firmIdNum}, firebase_user_info: ${JSON.stringify(
        req.firebase_user_info,
      )}`,
    );

    // Check if firm exists
    const firm = await firmService.getFirmById(firmIdNum);
    if (!firm) {
      res.status(404).json({
        success: false,
        error: 'Firm not found',
      });
      return;
    }

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 50,
    });

    // Execute findMany and count in parallel
    const { data: certifications, total } = await findManyWithCount(
      prismaInstance.certification.findMany({
        where: {
          firm_id: firmIdNum,
        },
        skip: paginationParams.skip,
        take: paginationParams.take,
        include: {
          firm: true,
        },
        orderBy: { name: 'asc' },
      }),
      prismaInstance.certification.count({
        where: {
          firm_id: firmIdNum,
        },
      }),
    );

    // Create paginated response
    const response = createPaginatedResponse(
      certifications,
      total,
      paginationParams,
    );

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in /api/certifications/firms/:firmId:', error as any);
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

export default getCertificationsByFirm;
