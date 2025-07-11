import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import {
  extractPaginationParams,
  createPaginatedResponse,
  findManyWithCount,
} from '../../../utils/pagination';
import { AuthenticatedRequest } from '../../../middlewares/jwtAuth';
import {
  CACHE_CONFIG,
  generatePaginatedCacheKey,
  generateItemCacheKey,
} from '../../../services/redis';
import { CacheHierarchyService } from '../../../services/cache/cacheHierarchy';

/**
 * Get all firms with pagination (public endpoint)
 */
export const getPublicFirms = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    logger.info(`Getting public firms list, user: ${JSON.stringify(req.user)}`);

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 100,
    });

    // Generate cache key for this specific page and size
    const cacheKey = generatePaginatedCacheKey(
      CACHE_CONFIG.KEYS.FIRMS_LIST,
      paginationParams.page,
      paginationParams.take,
    );

    // Try to get from cache first, or fetch and cache
    const response = await CacheHierarchyService.getOrSet(
      cacheKey,
      async () => {
        logger.info('Cache miss - fetching firms from database');

        // Execute findMany and count in parallel
        const { data: firms, total } = await findManyWithCount(
          prismaInstance.firm.findMany({
            skip: paginationParams.skip,
            take: paginationParams.take,
            select: {
              firm_id: true,
              name: true,
              code: true,
              description: true,
              website_url: true,
              logo_url: true,
              created_at: true,
              _count: {
                select: {
                  certifications: true,
                },
              },
            },
            orderBy: {
              name: 'asc',
            },
          }),
          prismaInstance.firm.count(),
        );

        // Create paginated response
        return createPaginatedResponse(firms, total, paginationParams);
      },
      CACHE_CONFIG.FIRMS_TTL,
    );

    res.status(200).json(response);
  } catch (error) {
    logger.error(`Error getting public firms: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch firms',
    });
  }
};

/**
 * Get a specific firm by ID (public endpoint)
 */
export const getPublicFirmById = async (
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
      `Getting public firm by ID: ${firmId}, user: ${JSON.stringify(req.user)}`,
    );

    // Generate cache key for this specific firm
    const cacheKey = generateItemCacheKey(CACHE_CONFIG.KEYS.FIRM_BY_ID, firmId);

    // Try to get from cache first, or fetch and cache
    const firm = await CacheHierarchyService.getOrSet(
      cacheKey,
      async () => {
        logger.info(`Cache miss - fetching firm ${firmId} from database`);

        return await prismaInstance.firm.findUnique({
          where: {
            firm_id: firmId,
          },
          select: {
            firm_id: true,
            name: true,
            code: true,
            description: true,
            website_url: true,
            logo_url: true,
            created_at: true,
            _count: {
              select: {
                certifications: true,
              },
            },
          },
        });
      },
      CACHE_CONFIG.FIRM_BY_ID_TTL,
    );

    if (!firm) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Firm not found',
      });
      return;
    }

    res.status(200).json({
      data: firm,
    });
  } catch (error) {
    logger.error(`Error getting public firm by ID: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch firm',
    });
  }
};
