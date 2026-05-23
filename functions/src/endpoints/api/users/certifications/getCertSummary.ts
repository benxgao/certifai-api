/**
 * Certification Summary REST API Endpoints
 *
 * GET /users/:user_id/certifications/:cert_id/cert-summary - Get existing cert summary
 * POST /users/:user_id/certifications/:cert_id/cert-summary - Regenerate cert summary
 */

import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequestHandler } from '../../../../types/express';
import {
  CertSummaryPrerequisiteError,
  generateCertSummary,
  certSummaryFirestore,
} from '../../../../services/certSummaryService';

type CertSummaryParams = {
  user_id: string;
  cert_id: string;
};

/**
 * GET /users/:user_id/certifications/:cert_id/cert-summary
 *
 * Retrieve an existing certification summary. If no summary exists,
 * automatically attempts to generate one if the user has sufficient exam data.
 * This provides a seamless experience for users accessing their summaries.
 */
export const getCertSummary: AuthenticatedRequestHandler<
  unknown,
  Record<string, unknown>,
  CertSummaryParams
> = async (req, res): Promise<void> => {
  try {
    const { user_id, cert_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.uid;

    if (!user_id || !cert_id) {
      res.status(400).json({
        success: false,
        error: 'user_id and cert_id are required',
        error_code: 'VALIDATION_ERROR',
        retriable: false,
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        error_code: 'AUTH_REQUIRED',
        retriable: false,
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
      } catch (generationError: unknown) {
        const errorMessage =
          generationError instanceof Error
            ? generationError.message
            : String(generationError);

        logger.warn(
          `GET_CERT_SUMMARY_AUTO_GENERATION_FAILED: user_id=${user_id}, cert_id=${cert_id}`,
          { error: generationError },
        );

        if (generationError instanceof CertSummaryPrerequisiteError) {
          res.status(400).json({
            success: false,
            error: generationError.message,
            error_code: generationError.code,
            retriable: generationError.retriable,
            details: generationError.details,
          });
          return;
        }

        if (errorMessage.includes('not found')) {
          res.status(404).json({
            success: false,
            error: errorMessage,
            error_code: 'NOT_FOUND',
            retriable: false,
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'Certification summary auto-generation failed',
          error_code: 'REPORT_GENERATION_TRANSIENT',
          retriable: true,
          details: {
            original_error: errorMessage,
          },
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
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('not found')) {
      res.status(404).json({
        success: false,
        error: errorMessage,
        error_code: 'NOT_FOUND',
        retriable: false,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error during cert summary retrieval',
      error_code: 'INTERNAL_SERVER_ERROR',
      retriable: true,
    });
  }
};

/**
 * POST /users/:user_id/certifications/:cert_id/cert-summary
 *
 * Generate or regenerate a certification summary.
 * Will create a new summary or update existing one.
 */
export const regenerateCertSummary: AuthenticatedRequestHandler<
  unknown,
  Record<string, unknown>,
  CertSummaryParams
> = async (req, res): Promise<void> => {
  try {
    const { user_id, cert_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.uid;

    if (!user_id || !cert_id) {
      res.status(400).json({
        success: false,
        error: 'user_id and cert_id are required',
        error_code: 'VALIDATION_ERROR',
        retriable: false,
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        error_code: 'AUTH_REQUIRED',
        retriable: false,
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
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    );

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof CertSummaryPrerequisiteError) {
      res.status(400).json({
        success: false,
        error: error.message,
        error_code: error.code,
        retriable: error.retriable,
        details: error.details,
      });
      return;
    }

    if (errorMessage.includes('not found')) {
      res.status(404).json({
        success: false,
        error: errorMessage,
        error_code: 'NOT_FOUND',
        retriable: false,
      });
      return;
    }

    if (errorMessage.includes('Access denied')) {
      res.status(403).json({
        success: false,
        error: errorMessage,
        error_code: 'ACCESS_DENIED',
        retriable: false,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error during cert summary regeneration',
      error_code: 'REPORT_GENERATION_TRANSIENT',
      retriable: true,
      details: {
        original_error: errorMessage,
      },
    });
  }
};
