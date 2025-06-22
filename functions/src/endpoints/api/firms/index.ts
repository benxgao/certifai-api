import { Request, Response } from 'express';
import firmService from '../../../services/firms';

/**
 * Get all firms
 */
export const getFirms = async (req: Request, res: Response) => {
  try {
    const includeCount = req.query.includeCount === 'true';

    if (includeCount) {
      const firms = await firmService.getFirmsWithCertificationCounts();
      res.status(200).json({
        success: true,
        data: firms,
      });
    } else {
      const firms = await firmService.getAllFirms();
      res.status(200).json({
        success: true,
        data: firms,
      });
    }
  } catch (error) {
    console.error('Error fetching firms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch firms',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get a specific firm by ID
 */
export const getFirmById = async (req: Request, res: Response) => {
  try {
    const { firmId } = req.params;
    const includeCertifications = req.query.includeCertifications === 'true';

    const firmIdNum = parseInt(firmId, 10);
    if (isNaN(firmIdNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid firm ID',
      });
      return;
    }

    if (includeCertifications) {
      const firm = await firmService.getFirmWithCertifications(firmIdNum);
      if (!firm) {
        res.status(404).json({
          success: false,
          message: 'Firm not found',
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
          message: 'Firm not found',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: firm,
      });
    }
  } catch (error) {
    console.error('Error fetching firm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch firm',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Search firms
 */
export const searchFirms = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
      return;
    }

    const firms = await firmService.searchFirms(q);
    res.status(200).json({
      success: true,
      data: firms,
    });
  } catch (error) {
    console.error('Error searching firms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search firms',
      error: error instanceof Error ? error.message : 'Unknown error',
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
