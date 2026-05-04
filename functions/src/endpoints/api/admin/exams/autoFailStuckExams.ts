import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequest } from '../../../../types/express';
import { ExamGenerationHealthCheck } from '../../../../services/exam-generation-health-check';

/**
 * Admin endpoint to manually trigger auto-failure of stuck exams
 * This endpoint allows administrators to manually run the stuck exam detection
 * and auto-failure process without waiting for the scheduled function
 */
const handler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    // Get threshold from query parameter, default to 10 minutes
    const thresholdMinutes =
      parseInt(Array.isArray(req.query.threshold_minutes) ? String(req.query.threshold_minutes[0]) : String(req.query.threshold_minutes ?? '10')) || 10;

    if (thresholdMinutes < 1 || thresholdMinutes > 1440) {
      // Max 24 hours
      res.status(400).json({
        success: false,
        error: 'Threshold must be between 1 and 1440 minutes (24 hours).',
      });
      return;
    }

    logger.info('MANUAL_AUTO_FAIL_STUCK_EXAMS_START', {
      admin_user: firebaseUserIdFromToken,
      threshold_minutes: thresholdMinutes,
      timestamp: new Date().toISOString(),
    });

    // Run the auto-fail process
    const result = await ExamGenerationHealthCheck.autoFailStuckExams(
      thresholdMinutes,
    );

    logger.info('MANUAL_AUTO_FAIL_STUCK_EXAMS_COMPLETE', {
      admin_user: firebaseUserIdFromToken,
      threshold_minutes: thresholdMinutes,
      success: result.success,
      failed_count: result.failedCount,
      errors_count: result.errors.length,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Auto-fail process completed successfully.`,
      data: {
        threshold_minutes: thresholdMinutes,
        processing_summary: {
          exams_found_stuck: result.failedExams.length,
          successfully_failed: result.failedCount,
          errors_encountered: result.errors.length,
        },
        failed_exams: result.failedExams.map((exam) => ({
          exam_id: exam.exam_id,
          user_id: exam.user_id,
          cert_id: exam.cert_id,
          minutes_stuck: exam.minutes_stuck,
        })),
        errors: result.errors,
        overall_success: result.success,
        admin_user: firebaseUserIdFromToken,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('MANUAL_AUTO_FAIL_STUCK_EXAMS_FAILED', {
      error: errorMessage,
      admin_user: req.firebase_user_info?.user_id || 'unknown',
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      error: `Failed to process auto-fail request: ${errorMessage}`,
      timestamp: new Date().toISOString(),
    });
  }
};

export default handler;
