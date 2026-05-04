import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequest } from '../../../../types/express';
import { ExamGenerationHealthCheck } from '../../../../services/exam-generation-health-check';

/**
 * Force complete stuck exam endpoint (emergency procedure)
 * POST /api/admin/exam-generation/force-complete
 *
 * Body:
 * {
 *   "exam_id": "uuid",
 *   "reason": "Stuck for over 1 hour"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "success": true,
 *     "message": "Exam uuid force completed with 25 questions",
 *     "exam_id": "uuid",
 *     "previous_status": "QUESTIONS_GENERATING",
 *     "questions_count": 25
 *   }
 * }
 */
const handler = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { exam_id, reason } = req.body;
    const adminUserId = req.firebase_user_info?.user_id;

    if (!exam_id || !reason) {
      res.status(400).json({
        success: false,
        error: 'exam_id and reason are required',
      });
      return;
    }

    logger.warn('FORCE_COMPLETE_EXAM_REQUESTED', {
      exam_id,
      reason,
      admin_user: adminUserId,
      timestamp: new Date().toISOString(),
    });

    // Force complete the exam
    const result = await ExamGenerationHealthCheck.forceCompleteExam(
      exam_id,
      reason,
      adminUserId,
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        data: result,
      });
    }
  } catch (error) {
    logger.error('FORCE_COMPLETE_ENDPOINT_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      exam_id: req.body?.exam_id,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to force complete exam',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
