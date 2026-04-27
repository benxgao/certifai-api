import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { ExamGenerationHealthCheck } from '../../../../services/exam-generation-health-check';

/**
 * Get stuck exams endpoint
 * GET /api/admin/exam-generation/stuck-exams?threshold=30
 *
 * Query Parameters:
 * - threshold: Threshold in minutes to consider an exam stuck (default: 30)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "stuck_exams": [
 *       {
 *         "exam_id": "uuid",
 *         "user_id": "uuid",
 *         "cert_id": 123,
 *         "started_at": "2025-01-13T...",
 *         "minutes_stuck": 45
 *       }
 *     ],
 *     "count": 1,
 *     "threshold_minutes": 30
 *   }
 * }
 */
const handler = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const threshold = parseInt(Array.isArray(req.query.threshold) ? req.query.threshold[0] : (req.query.threshold ?? '30')) || 30;

    logger.info('STUCK_EXAMS_REQUESTED', {
      threshold_minutes: threshold,
      user_id: req.firebase_user_info?.user_id,
      timestamp: new Date().toISOString(),
    });

    // Get stuck exams
    const stuckExams = await ExamGenerationHealthCheck.getStuckExams(threshold);

    res.status(200).json({
      success: true,
      data: {
        stuck_exams: stuckExams,
        count: stuckExams.length,
        threshold_minutes: threshold,
      },
    });
  } catch (error) {
    logger.error('STUCK_EXAMS_ENDPOINT_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get stuck exams',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
