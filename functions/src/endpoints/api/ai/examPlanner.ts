/**
 *
 * Get an API key at https://aistudio.google.com/app/apikey
 *
 */

import { inspect } from 'util';
import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { AuthenticatedRequest } from '../../../types/express';
import { examPlannerPromise } from '../../../services/genkit/examPlanner.js';

/**
 * Handles exam planning requests to generate an AI-powered study plan
 *
 * @example Request payload:
 * {
 *   "exam_id": "exam_123",
 *   "cert_id": "cert_456",
 *   "cert_name": "AWS Solutions Architect Associate",
 *   "customPrompt": "Focus on advanced networking, security best practices, and cost optimization strategies",
 *   "lastExamReport": "Previous exam showed weakness in VPC networking and strong performance in IAM...",
 *   "totalQuestionCounts": 65
 * }
 *
 * @example Response:
 * {
 *   "success": true,
 *   "data": {
 *     "questions": [
 *       {
 *         "exam_topic": "IAM Policies and Roles",
 *         "question_id": null
 *       },
 *       {
 *         "exam_topic": "VPC Network Configuration",
 *         "question_id": null
 *       }
 *     ],
 *     "cert_id": "cert_456",
 *     "user_id": "user_789",
 *     "created_at": 1721030400,
 *     "customPrompt": "Focus on advanced networking, security best practices, and cost optimization strategies",
 *     "lastExamReport": "Previous exam showed weakness in VPC networking..."
 *   }
 * }
 */
export const examPlannerHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Ensure the AI instance and flow are initialized before proceeding
    const examPlanner = await examPlannerPromise;

    const {
      exam_id,
      cert_id,
      cert_name,
      totalQuestionCounts,
      customPrompt,
      lastExamReport,
    } = req.body;

    // Extract user_id from Firebase auth token
    const user_id = req.firebase_user_info?.user_id;

    // Validate required parameters
    if (!exam_id) {
      res.status(400).json({
        success: false,
        error: 'exam_id is required',
      });
      return;
    }

    if (!cert_id) {
      res.status(400).json({
        success: false,
        error: 'cert_id is required',
      });
      return;
    }

    if (!cert_name) {
      res.status(400).json({
        success: false,
        error: 'cert_name is required',
      });
      return;
    }

    if (!totalQuestionCounts || totalQuestionCounts <= 0) {
      res.status(400).json({
        success: false,
        error: 'totalQuestionCounts must be a positive number',
      });
      return;
    }

    if (!user_id) {
      res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
      return;
    }

    logger.info(
      `Handling exam planner request with cert_name: ${cert_name}, totalQuestionCounts: ${totalQuestionCounts}, exam_id: ${exam_id}, cert_id: ${cert_id}, user_id: ${user_id}${
        customPrompt
          ? `, customPrompt: ${customPrompt.substring(0, 100)}...`
          : ''
      }${
        lastExamReport
          ? `, lastExamReport: ${lastExamReport.substring(0, 100)}...`
          : ''
      }`,
    );

    const examPlan = await examPlanner({
      cert_name,
      totalQuestionCounts,
      exam_id,
      cert_id,
      user_id,
      customPrompt,
      lastExamReport,
    });

    logger.info(
      `Exam planner response for cert_name '${cert_name}', totalQuestionCounts '${totalQuestionCounts}', exam_id '${exam_id}': ${inspect(
        examPlan,
      )}`,
      { structuredData: true },
    );

    res.status(200).json({
      success: true,
      data: examPlan,
    });
  } catch (error) {
    logger.error('Error in examPlannerHandler:', { error: error instanceof Error ? error.message : String(error) });
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    if (errorMessage.includes('Could not initialize AI services')) {
      res.status(503).json({
        success: false,
        error: 'AI service initialization failed. Please try again later.',
      });
    } else {
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
};
