/**
 * Exam Report API Handler for RESTful route
 * GET/POST /api/users/:user_id/exams/:exam_id/exam-report
 *
 * This handler provides a RESTful interface to the exam report generator
 * Now uses Firestore for storage instead of Prisma exam_report field.
 */

import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { generateExamReport } from '../../ai/examReportGenerator';
import { examReportFirestore } from '../../../../services/firebase/examReportFirestore';

/**
 * GET /api/users/:user_id/exams/:exam_id/exam-report
 * Fetch existing exam report from Firestore or generate if it doesn't exist
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

    logger.info(
      `GET_EXAM_REPORT_FIRESTORE: user_id=${user_id}, exam_id=${exam_id}`,
    );

    // First try to get existing report from Firestore
    const existingReport = await examReportFirestore.getExamReport(exam_id);

    if (existingReport) {
      // Verify the report belongs to the requesting user
      if (existingReport.user_id !== user_id) {
        res.status(403).json({
          success: false,
          error: 'Access denied: Exam report does not belong to this user',
        });
        return;
      }

      // Return existing report
      res.status(200).json({
        success: true,
        data: {
          exam_id: existingReport.exam_id,
          report: existingReport.text_summary,
          structured_data: existingReport,
          already_existed: true,
          generated_at: existingReport.generated_at,
          performance_summary: {
            overall_score: existingReport.overall_score,
            total_questions: existingReport.total_questions,
            correct_answers: existingReport.correct_answers,
            topics_analyzed: existingReport.topic_performance.length,
            topic_breakdown: existingReport.topic_performance.map((topic) => ({
              topic: topic.topic,
              accuracy: Math.round(topic.accuracy_rate * 100),
              questions: topic.total_attempts,
            })),
          },
        },
      });
      return;
    }

    // If no report exists, generate a new one using the existing function
    const result = await generateExamReport(exam_id, firebaseUserIdFromToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('GET_EXAM_REPORT_FIRESTORE_ERROR:', error);

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
 * Force regenerate exam report (overwrites existing report in Firestore)
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
      `REGENERATE_EXAM_REPORT_FIRESTORE: user_id=${user_id}, exam_id=${exam_id}`,
    );

    // Check if report exists and delete it to force regeneration
    const existingReport = await examReportFirestore.getExamReport(exam_id);
    if (existingReport) {
      // Verify the report belongs to the requesting user
      if (existingReport.user_id !== user_id) {
        res.status(403).json({
          success: false,
          error: 'Access denied: Exam report does not belong to this user',
        });
        return;
      }

      // Delete existing report to force regeneration
      await examReportFirestore.deleteExamReport(exam_id);
      logger.info(
        `REGENERATE_EXAM_REPORT: Deleted existing report for exam_id=${exam_id}`,
      );
    }

    // Generate new report (will now store in Firestore since we deleted the old one)
    const result = await generateExamReport(exam_id, firebaseUserIdFromToken);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Exam report regenerated successfully',
    });
  } catch (error: any) {
    logger.error('REGENERATE_EXAM_REPORT_FIRESTORE_ERROR:', error);

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
