/**
 * Certification Summary REST API Endpoints
 *
 * GET /users/:user_id/certifications/:cert_id/cert-summary - Get existing cert summary
 * POST /users/:user_id/certifications/:cert_id/cert-summary - Regenerate cert summary
 */

import { Request, Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import {
  generateCertSummary,
  certSummaryFirestore,
} from '../../../../services/certSummaryService';

/**
 * GET /users/:user_id/certifications/:cert_id/cert-summary
 *
 * Retrieve an existing certification summary. If no summary exists,
 * automatically attempts to generate one if the user has sufficient exam data.
 * This provides a seamless experience for users accessing their summaries.
 */
export const getCertSummary = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id, cert_id } = req.params as { user_id: string; cert_id: string };
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

    logger.info(
      `GET_CERT_SUMMARY_REQUEST: user_id=${user_id}, cert_id=${cert_id}`,
    );

    // Get existing summary from Firestore (no generation)
    const existingSummary = await certSummaryFirestore.getCertSummary(
      user_id,
      cert_id,
    );

    if (!existingSummary) {
      logger.info(
        `GET_CERT_SUMMARY_NOT_FOUND: user_id=${user_id}, cert_id=${cert_id}, attempting auto-generation`,
      );

      try {
        // Automatically generate the summary instead of returning 404
        const summaryData = await generateCertSummary(
          user_id,
          cert_id,
          firebaseUserIdFromToken,
        );

        logger.info(
          `GET_CERT_SUMMARY_AUTO_GENERATED: user_id=${user_id}, cert_id=${cert_id}`,
          {
            user_id,
            cert_id,
            total_exams: summaryData.summary_stats.total_exams,
            average_score: summaryData.summary_stats.average_score,
          },
        );

        res.status(200).json({
          success: true,
          data: summaryData,
          message: 'Certification summary generated automatically',
        });
        return;
      } catch (generationError) {
        const errorMessage = (generationError as Error).message;

        logger.warn(
          `GET_CERT_SUMMARY_AUTO_GENERATION_FAILED: user_id=${user_id}, cert_id=${cert_id}`,
          { error: generationError },
        );

        // If auto-generation fails, fall back to 404 with helpful message
        if (
          errorMessage.includes('requires at least 2') ||
          errorMessage.includes('Certification summary requires')
        ) {
          res.status(400).json({
            success: false,
            error: errorMessage,
            message: 'Cannot generate summary: insufficient exam data',
          });
          return;
        }

        if (errorMessage.includes('not found')) {
          res.status(404).json({
            success: false,
            error: errorMessage,
            message: 'User or certification not found',
          });
          return;
        }

        // For other errors, return 404 with original message
        res.status(404).json({
          success: false,
          error: 'Certification summary not found and auto-generation failed',
          message: `No certification summary exists yet and automatic generation failed: ${errorMessage}`,
        });
        return;
      }
    }

    logger.info(
      `GET_CERT_SUMMARY_SUCCESS: user_id=${user_id}, cert_id=${cert_id}`,
      {
        user_id,
        cert_id,
        certification: existingSummary.certification_name,
        generated_at: existingSummary.generated_at,
        total_exams: existingSummary.total_exams_taken,
      },
    );

    res.status(200).json({
      success: true,
      data: {
        cert_id,
        user_id,
        summary: existingSummary.ai_summary,
        structured_data: existingSummary,
        generated_at: existingSummary.generated_at,
        summary_stats: {
          total_exams: existingSummary.total_exams_taken,
          average_score: existingSummary.average_score,
          best_score: existingSummary.best_score,
          topics_mastered: existingSummary.topic_mastery.length,
          performance_trend: existingSummary.performance_trend,
          strengths_count: existingSummary.strengths.length,
          improvement_areas_count: existingSummary.areas_for_improvement.length,
        },
      },
      message: 'Certification summary retrieved successfully',
    });
  } catch (error) {
    logger.error(
      `GET_CERT_SUMMARY_ERROR: user_id=${req.params.user_id}, cert_id=${req.params.cert_id}`,
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

    res.status(500).json({
      success: false,
      error: 'Internal server error during cert summary retrieval',
    });
  }
};

/**
 * POST /users/:user_id/certifications/:cert_id/cert-summary
 *
 * Generate or regenerate a certification summary.
 * Will create a new summary or update existing one.
 */
export const regenerateCertSummary = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id, cert_id } = req.params as { user_id: string; cert_id: string };
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

    logger.info(
      `REGENERATE_CERT_SUMMARY_REQUEST: user_id=${user_id}, cert_id=${cert_id}`,
    );

    // Check if summary already exists for response message (handle errors gracefully)
    let existingSummary = null;
    try {
      existingSummary = await certSummaryFirestore.getCertSummary(
        user_id,
        cert_id,
      );
    } catch (error) {
      logger.warn(
        `REGENERATE_CERT_SUMMARY_CHECK_EXISTING_FAILED: user_id=${user_id}, cert_id=${cert_id}`,
        { error },
      );
      // Continue with generation even if we can't check existing summary
    }

    // Generate new summary (this will upsert, replacing any existing summary)
    const summaryData = await generateCertSummary(
      user_id,
      cert_id,
      firebaseUserIdFromToken,
    );

    logger.info(
      `REGENERATE_CERT_SUMMARY_SUCCESS: user_id=${user_id}, cert_id=${cert_id}`,
      {
        user_id,
        cert_id,
        total_exams: summaryData.summary_stats.total_exams,
        average_score: summaryData.summary_stats.average_score,
        updated: true,
      },
    );

    res.status(200).json({
      success: true,
      data: summaryData,
      message: existingSummary
        ? 'Certification summary updated successfully with latest exam data'
        : 'Certification summary generated successfully',
    });
  } catch (error) {
    logger.error(
      `REGENERATE_CERT_SUMMARY_ERROR: user_id=${req.params.user_id}, cert_id=${req.params.cert_id}`,
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

    res.status(500).json({
      success: false,
      error: 'Internal server error during cert summary regeneration',
    });
  }
};
