import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { ExamGenerationHealthCheck } from '../../../../services/exam-generation-health-check';
/**
 * Health check endpoint for exam generation system
 * GET /api/admin/exam-generation/health
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "timestamp": "2025-01-13T...",
 *     "overall_status": "healthy",
 *     "queue_status": "healthy",
 *     "database_status": "healthy",
 *     "ai_service_status": "healthy",
 *     "active_generations": 5,
 *     "error_rate_percent": 2.5,
 *     "performance_metrics": {...},
 *     "alerts": []
 *   }
 * }
 */
const handler = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    logger.info('HEALTH_CHECK_REQUESTED', {
      timestamp: new Date().toISOString(),
      user_id: req.firebase_user_info?.user_id,
    });

    // Perform comprehensive health check
    const healthReport = await ExamGenerationHealthCheck.performHealthCheck();

    res.status(200).json({
      success: true,
      data: healthReport,
    });
  } catch (error) {
    logger.error('HEALTH_CHECK_ENDPOINT_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to perform health check',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
