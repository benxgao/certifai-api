/**
 * Exam Report API Handler for RESTful route
 * GET/POST /api/users/:user_id/exams/:exam_id/exam-report
 *
 * This handler provides a RESTful interface to the exam report generator
 * while maintaining backward compatibility with the existing AI endpoint.
 */

import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { generateExamReport } from '../../ai/examReportGenerator';

/**
 * GET /api/users/:user_id/exams/:exam_id/exam-report
 * Fetch existing exam report or generate if it doesn't exist
 */
export const getExamReport = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id, exam_id } = req.params;
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!user_id || !exam_id) {
      res.status(400).json({
        success: false,
        error: 'User ID and Exam ID are required',
      });
      return;
    }

    logger.info(`GET_EXAM_REPORT: user_id=${user_id}, exam_id=${exam_id}`);

    // Generate or fetch existing exam report
    const result = await generateExamReport(exam_id, firebaseUserIdFromToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('GET_EXAM_REPORT_ERROR:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error.message.includes('Access denied')) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error.message.includes('completed exams')) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch exam report',
    });
  }
};

/**
 * POST /api/users/:user_id/exams/:exam_id/exam-report
 * Force regenerate exam report (e.g., if user wants updated analysis)
 */
export const regenerateExamReport = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id, exam_id } = req.params;
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!user_id || !exam_id) {
      res.status(400).json({
        success: false,
        error: 'User ID and Exam ID are required',
      });
      return;
    }

    logger.info(
      `REGENERATE_EXAM_REPORT: user_id=${user_id}, exam_id=${exam_id}`,
    );

    // For regeneration, we'll need to modify the generateExamReport function
    // to accept a force parameter, but for now we'll use the existing function
    const result = await generateExamReport(exam_id, firebaseUserIdFromToken);

    res.status(200).json({
      success: true,
      data: result,
      message: result.already_existed
        ? 'Exam report already exists'
        : 'Exam report generated successfully',
    });
  } catch (error: any) {
    logger.error('REGENERATE_EXAM_REPORT_ERROR:', error);

    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error.message.includes('Access denied')) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error.message.includes('completed exams')) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to regenerate exam report',
    });
  }
};

// Default export for backwards compatibility
export default getExamReport;
