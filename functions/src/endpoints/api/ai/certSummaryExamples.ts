/**
 * EXAMPLE: How to create another endpoint using the certSummaryService
 *
 * This demonstrates how the refactored service can be easily reused
 * in other endpoints or services.
 */

import { Request, Response } from 'express';
import {
  generateCertSummary,
  certSummaryFirestore,
} from '../../../services/certSummaryService';
import { CustomRequest } from '../../../types';
import logger from '../../../services/firebase/logger';

/**
 * Example: Bulk generate cert summaries for a user
 * POST /api/ai/bulk-cert-summary
 */
export const bulkCertSummaryHandler = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id, cert_ids } = req.body;
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    if (!user_id || !cert_ids || !Array.isArray(cert_ids)) {
      res.status(400).json({
        success: false,
        error: 'user_id and cert_ids array are required',
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const results = [];
    const errors = [];

    for (const cert_id of cert_ids) {
      try {
        const summary = await generateCertSummary(
          user_id,
          cert_id,
          firebaseUserIdFromToken,
        );
        results.push(summary);
      } catch (error) {
        errors.push({
          cert_id,
          error: (error as Error).message,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        successful: results,
        failed: errors,
        total_requested: cert_ids.length,
        successful_count: results.length,
        failed_count: errors.length,
      },
      message: `Processed ${cert_ids.length} certifications`,
    });
  } catch (error) {
    logger.error('BULK_CERT_SUMMARY_ERROR:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error during bulk cert summary generation',
    });
  }
};

/**
 * Example: Get existing cert summary without regenerating
 * GET /api/ai/cert-summary/:user_id/:cert_id
 */
export const getCertSummaryHandler = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id, cert_id } = req.params;
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    if (!user_id || !cert_id) {
      res.status(400).json({
        success: false,
        error: 'user_id and cert_id are required',
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Get existing summary from Firestore
    const existingSummary = await certSummaryFirestore.getCertSummary(
      user_id,
      cert_id,
    );

    if (!existingSummary) {
      res.status(404).json({
        success: false,
        error: 'Certification summary not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: existingSummary,
      message: 'Certification summary retrieved successfully',
    });
  } catch (error) {
    logger.error('GET_CERT_SUMMARY_ERROR:', error as any);
    res.status(500).json({
      success: false,
      error: 'Internal server error during cert summary retrieval',
    });
  }
};
