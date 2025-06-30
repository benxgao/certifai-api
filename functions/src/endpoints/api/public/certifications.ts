import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import {
  extractPaginationParams,
  createPaginatedResponse,
  findManyWithCount,
} from '../../../utils/pagination';
import { AuthenticatedRequest } from '../../../middlewares/jwtAuth';

/**
 * Get all certifications with pagination (public endpoint)
 */
export const getPublicCertifications = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    logger.info(
      `Getting public certifications list, user: ${JSON.stringify(req.user)}`,
    );

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 100,
    });

    // Execute findMany and count in parallel
    const { data: certifications, total } = await findManyWithCount(
      prismaInstance.certification.findMany({
        skip: paginationParams.skip,
        take: paginationParams.take,
        select: {
          cert_id: true,
          name: true,
          exam_guide_url: true,
          min_quiz_counts: true,
          max_quiz_counts: true,
          pass_score: true,
          firm: {
            select: {
              firm_id: true,
              name: true,
              code: true,
              logo_url: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
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
    logger.error(`Error getting public certifications: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch certifications',
    });
  }
};

/**
 * Get a specific certification by ID (public endpoint)
 */
export const getPublicCertificationById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const certId = parseInt(req.params.certId, 10);

    if (isNaN(certId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid certification ID',
      });
      return;
    }

    logger.info(
      `Getting public certification by ID: ${certId}, user: ${JSON.stringify(
        req.user,
      )}`,
    );

    const certification = await prismaInstance.certification.findUnique({
      where: {
        cert_id: certId,
      },
      select: {
        cert_id: true,
        name: true,
        exam_guide_url: true,
        min_quiz_counts: true,
        max_quiz_counts: true,
        pass_score: true,
        firm: {
          select: {
            firm_id: true,
            name: true,
            code: true,
            description: true,
            website_url: true,
            logo_url: true,
          },
        },
        _count: {
          select: {
            userCertifications: true,
          },
        },
      },
    });

    if (!certification) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Certification not found',
      });
      return;
    }

    // Get related certifications from the same firm
    const relatedCertifications = await prismaInstance.certification.findMany({
      where: {
        firm_id: certification.firm.firm_id,
        cert_id: {
          not: certId,
        },
      },
      select: {
        cert_id: true,
        name: true,
        exam_guide_url: true,
        min_quiz_counts: true,
        max_quiz_counts: true,
        pass_score: true,
      },
      take: 5,
      orderBy: {
        name: 'asc',
      },
    });

    // Transform the data to match frontend expectations
    const transformedCertification = {
      cert_id: certification.cert_id,
      name: certification.name,
      description:
        certification.exam_guide_url ||
        `Learn about ${certification.name} certification and advance your career.`,
      min_quiz_counts: certification.min_quiz_counts,
      max_quiz_counts: certification.max_quiz_counts,
      pass_score: certification.pass_score,
      created_at: new Date().toISOString(), // Since schema doesn't have created_at, use current time
      updated_at: new Date().toISOString(), // Since schema doesn't have updated_at, use current time
      firm: {
        id: certification.firm.firm_id,
        code: certification.firm.code,
        name: certification.firm.name,
        description: certification.firm.description || '',
        website_url: certification.firm.website_url,
        logo_url: certification.firm.logo_url,
      },
      enrollment_count: certification._count.userCertifications || 0,
      related_certifications: relatedCertifications.map((cert) => ({
        cert_id: cert.cert_id,
        name: cert.name,
        description:
          cert.exam_guide_url || `Learn about ${cert.name} certification.`,
        min_quiz_counts: cert.min_quiz_counts,
        max_quiz_counts: cert.max_quiz_counts,
        pass_score: cert.pass_score,
      })),
    };

    res.status(200).json({
      success: true,
      data: transformedCertification,
      meta: {
        related_count: relatedCertifications.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Error getting public certification by ID: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch certification',
    });
  }
};

/**
 * Get certifications by firm ID (public endpoint)
 */
export const getPublicCertificationsByFirm = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const firmId = parseInt(req.params.firmId, 10);

    if (isNaN(firmId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid firm ID',
      });
      return;
    }

    logger.info(
      `Getting public certifications by firm ID: ${firmId}, user: ${JSON.stringify(
        req.user,
      )}`,
    );

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 50,
    });

    // First check if firm exists
    const firm = await prismaInstance.firm.findUnique({
      where: { firm_id: firmId },
      select: { firm_id: true, name: true, code: true },
    });

    if (!firm) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Firm not found',
      });
      return;
    }

    // Execute findMany and count in parallel
    const { data: certifications, total } = await findManyWithCount(
      prismaInstance.certification.findMany({
        where: {
          firm_id: firmId,
        },
        skip: paginationParams.skip,
        take: paginationParams.take,
        select: {
          cert_id: true,
          name: true,
          exam_guide_url: true,
          min_quiz_counts: true,
          max_quiz_counts: true,
          pass_score: true,
          firm: {
            select: {
              firm_id: true,
              name: true,
              code: true,
              logo_url: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prismaInstance.certification.count({
        where: {
          firm_id: firmId,
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
    logger.error(`Error getting public certifications by firm: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch certifications',
    });
  }
};
