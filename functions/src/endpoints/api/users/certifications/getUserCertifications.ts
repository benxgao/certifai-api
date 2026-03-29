import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';
import {
  extractPaginationParams,
  createPaginatedResponse,
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

    // Demo certification IDs that should always appear at the top in this specific order
    const DEMO_CERT_IDS = [11, 8, 10];

    // Fetch all user certifications (without pagination limit) to properly sort demo certs to top
    const allCertifications = await prismaInstance.userCertification.findMany({
      where: whereClause,
      include: {
        certification: true, // Include details from the related 'Certification' model
      },
      orderBy: { assigned_at: 'desc' },
    });

    // Custom sorting: place demo certs at the top in the specified order, then other certs
    const sortedCertifications = allCertifications.sort((a, b) => {
      const aIsDemoIndex = DEMO_CERT_IDS.indexOf(a.cert_id);
      const bIsDemoIndex = DEMO_CERT_IDS.indexOf(b.cert_id);

      // If both are demo certs, maintain their order as specified in DEMO_CERT_IDS
      if (aIsDemoIndex !== -1 && bIsDemoIndex !== -1) {
        return aIsDemoIndex - bIsDemoIndex;
      }

      // If only a is a demo cert, it comes first
      if (aIsDemoIndex !== -1) {
        return -1;
      }

      // If only b is a demo cert, it comes first
      if (bIsDemoIndex !== -1) {
        return 1;
      }

      // For non-demo certs, maintain the original order (assigned_at: desc)
      return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
    });

    // Apply pagination to the sorted results
    const paginatedCertifications = sortedCertifications.slice(
      paginationParams.skip,
      paginationParams.skip + paginationParams.take,
    );

    // Create paginated response
    const response = createPaginatedResponse(
      paginatedCertifications || [],
      allCertifications.length,
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
