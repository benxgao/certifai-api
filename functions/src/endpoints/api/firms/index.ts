import { Request, Response } from 'express';
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
 * Get all firms with pagination
 */
export const getFirms = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    logger.info(
      `Getting firms list, firebase_user_info: ${JSON.stringify(
        req.firebase_user_info,
      )}`,
    );

    const includeCount = req.query.includeCount === 'true';

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 50,
    });

    if (includeCount) {
      // Execute findMany and count in parallel for firms with certification counts
      const { data: firms, total } = await findManyWithCount(
        prismaInstance.firm.findMany({
          skip: paginationParams.skip,
          take: paginationParams.take,
          include: {
            _count: {
              select: {
                certifications: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        }),
        prismaInstance.firm.count(),
      );

      // Create paginated response
      const response = createPaginatedResponse(firms, total, paginationParams);

      res.status(200).json(response);
    } else {
      // Execute findMany and count in parallel for basic firms
      const { data: firms, total } = await findManyWithCount(
        prismaInstance.firm.findMany({
          skip: paginationParams.skip,
          take: paginationParams.take,
          orderBy: { name: 'asc' },
        }),
        prismaInstance.firm.count(),
      );

      // Create paginated response
      const response = createPaginatedResponse(firms, total, paginationParams);

      res.status(200).json(response);
    }
  } catch (error) {
    logger.error('Error in /api/firms:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Get a specific firm by ID
 */
export const getFirmById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { firmId } = req.params;
    const includeCertifications = req.query.includeCertifications === 'true';

    const firmIdNum = parseInt(firmId, 10);
    if (isNaN(firmIdNum)) {
      res.status(400).json({
        success: false,
        error: 'Invalid firm ID. Must be a number.',
      });
      return;
    }

    if (includeCertifications) {
      const firm = await firmService.getFirmWithCertifications(firmIdNum);
      if (!firm) {
        res.status(404).json({
          success: false,
          error: 'Firm not found',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: firm,
      });
    } else {
      const firm = await firmService.getFirmById(firmIdNum);
      if (!firm) {
        res.status(404).json({
          success: false,
          error: 'Firm not found',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: firm,
      });
    }
  } catch (error) {
    logger.error('Error in /api/firms/:firmId:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Search firms with pagination
 */
export const searchFirms = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }

    logger.info(
      `Searching firms with query: ${q}, firebase_user_info: ${JSON.stringify(
        req.firebase_user_info,
      )}`,
    );

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 50,
    });

    // Execute findMany and count in parallel
    const { data: firms, total } = await findManyWithCount(
      prismaInstance.firm.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        skip: paginationParams.skip,
        take: paginationParams.take,
        orderBy: { name: 'asc' },
      }),
      prismaInstance.firm.count({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
      }),
    );

    // Create paginated response
    const response = createPaginatedResponse(firms, total, paginationParams);

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in /api/firms/search:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Create a new firm
 */
export const createFirm = async (req: Request, res: Response) => {
  try {
    const { name, code, description, website_url, logo_url } = req.body;

    if (!name || !code) {
      res.status(400).json({
        success: false,
        message: 'Name and code are required',
      });
      return;
    }

    // Check if firm with same code already exists
    const existingFirm = await firmService.getFirmByCode(code);
    if (existingFirm) {
      res.status(409).json({
        success: false,
        message: 'Firm with this code already exists',
      });
      return;
    }

    const firm = await firmService.createFirm({
      name,
      code: code.toUpperCase(),
      description,
      website_url,
      logo_url,
    });

    res.status(201).json({
      success: true,
      data: firm,
    });
  } catch (error) {
    console.error('Error creating firm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create firm',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update a firm
 */
export const updateFirm = async (req: Request, res: Response) => {
  try {
    const { firmId } = req.params;
    const { name, code, description, website_url, logo_url } = req.body;

    const firmIdNum = parseInt(firmId, 10);
    if (isNaN(firmIdNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid firm ID',
      });
      return;
    }

    // Check if firm exists
    const existingFirm = await firmService.getFirmById(firmIdNum);
    if (!existingFirm) {
      res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
      return;
    }

    // If code is being updated, check if it's already taken by another firm
    if (code && code !== existingFirm.code) {
      const firmWithCode = await firmService.getFirmByCode(code);
      if (firmWithCode && firmWithCode.firm_id !== firmIdNum) {
        res.status(409).json({
          success: false,
          message: 'Firm with this code already exists',
        });
        return;
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (description !== undefined) updateData.description = description;
    if (website_url !== undefined) updateData.website_url = website_url;
    if (logo_url !== undefined) updateData.logo_url = logo_url;

    const updatedFirm = await firmService.updateFirm(firmIdNum, updateData);

    res.status(200).json({
      success: true,
      data: updatedFirm,
    });
  } catch (error) {
    console.error('Error updating firm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update firm',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete a firm
 */
export const deleteFirm = async (req: Request, res: Response) => {
  try {
    const { firmId } = req.params;

    const firmIdNum = parseInt(firmId, 10);
    if (isNaN(firmIdNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid firm ID',
      });
      return;
    }

    // Check if firm exists
    const existingFirm = await firmService.getFirmById(firmIdNum);
    if (!existingFirm) {
      res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
      return;
    }

    // Check if firm has certifications
    const firmWithCerts = await firmService.getFirmWithCertifications(
      firmIdNum,
    );
    if (firmWithCerts && firmWithCerts.certifications.length > 0) {
      res.status(409).json({
        success: false,
        message:
          'Cannot delete firm with existing certifications. Please reassign or delete certifications first.',
      });
      return;
    }

    await firmService.deleteFirm(firmIdNum);

    res.status(200).json({
      success: true,
      message: 'Firm deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting firm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete firm',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
