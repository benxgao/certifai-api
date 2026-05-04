import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequest } from '../../../../types/express';
import { ExamGenerationHealthCheck } from '../../../../services/exam-generation-health-check';

/**
 * Metrics report endpoint for exam generation system
 * GET /api/admin/exam-generation/metrics?timeWindow=60
 *
 * Query Parameters:
 * - timeWindow: Time window in minutes (default: 60)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "timestamp": "2025-01-13T...",
 *     "system_health": {...},
 *     "metrics": {...},
 *     "stuck_exams": [...],
 *     "recommendations": [...]
 *   }
 * }
 */
const handler = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const timeWindow = parseInt(Array.isArray(req.query.timeWindow) ? String(req.query.timeWindow[0]) : String(req.query.timeWindow ?? '60')) || 60;

    logger.info('METRICS_REPORT_REQUESTED', {
      timestamp: new Date().toISOString(),
      time_window_minutes: timeWindow,
      user_id: req.firebase_user_info?.user_id,
    });

    // Generate comprehensive metrics report
    const metricsReport =
      await ExamGenerationHealthCheck.generateMetricsReport();

    if (!metricsReport) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate metrics report',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: metricsReport,
    });
  } catch (error) {
    logger.error('METRICS_REPORT_ENDPOINT_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate metrics report',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
