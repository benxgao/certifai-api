/**
 * Certification Summary Generator API Handler
 *
 * Generates comprehensive certification summaries based on multiple exam reports from Firestore.
 * The cert summary can be generated when there are more than 1 exam_reports for a user's certification.
 * The cert_summary is stored in Firestore at the path `users/[user_id]/certs/[cert_id]/summaries/cert_summary`
 *
 * Request Body:
 * - user_id (string, required): The user ID to generate cert summary for
 * - cert_id (string, required): The certification ID to generate summary for
 *
 * Response:
 * - success (boolean): Whether the operation was successful
 * - data (object): Contains the generated cert summary and metadata
 *
 * This endpoint will:
 * 1. Validate that the user has more than 1 exam report for the certification
 * 2. Retrieve all exam reports from Firestore for the user's certification
 * 3. Generate both structured data and AI-powered text summary
 * 4. Store the cert_summary in Firestore at users/[user_id]/certs/[cert_id]/summaries/cert_summary
 * 5. Return the summary for immediate use
 */

import { Request, Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import { generateCertSummary } from '../../../services/certSummaryService';

/**
 * Express.js API handler that wraps the core service function
 */
export const certSummaryGeneratorHandler = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id, cert_id } = req.body;

    // Get Firebase user ID if available (for authenticated requests)
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    // Validate required fields
    if (!user_id || !cert_id) {
      res.status(400).json({
        success: false,
        error: 'user_id and cert_id are required',
      });
      return;
    }

    // For API calls, we require authentication
    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Generate the cert summary using the core service
    const summaryData = await generateCertSummary(
      user_id,
      cert_id,
      firebaseUserIdFromToken,
    );

    // Return success response
    res.status(200).json({
      success: true,
      data: summaryData,
      message: summaryData.already_existed
        ? 'Certification summary already exists'
        : 'Certification summary generated successfully',
    });
  } catch (error) {
    logger.error(
      'CERT_SUMMARY_API_ERROR: Error in cert summary API handler:',
      error as any,
    );

    const errorMessage = (error as Error).message;

    if (errorMessage.includes('not found')) {
      res.status(404).json({
        success: false,
        error: errorMessage,
      });
      return;
    }

    if (errorMessage.includes('Access denied')) {
      res.status(403).json({
        success: false,
        error: errorMessage,
      });
      return;
    }

    if (
      errorMessage.includes('requires at least 2') ||
      errorMessage.includes('Certification summary requires')
    ) {
      res.status(400).json({
        success: false,
        error: errorMessage,
      });
      return;
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Internal server error during cert summary generation',
    });
  }
};
