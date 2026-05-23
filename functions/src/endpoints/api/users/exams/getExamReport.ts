/**
 * Exam Report API Handler for RESTful route
 * GET/POST /api/users/:user_id/exams/:exam_id/exam-report
 *
 * This handler provides a RESTful interface to the exam report generator
 * Now uses Firestore for storage instead of Prisma exam_report field.
 */

import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequestHandler } from '../../../../types/express';
import { generateExamReport } from '../../ai/examReportGenerator';
import { examReportFirestore } from '../../../../services/firebase/examReportFirestore';
import {
  mapExamReportError,
  sendExamReportErrorResponse,
} from '../../examReportErrorMap';

type ExamReportParams = {
  user_id: string;
  exam_id: string;
};

/**
 * GET /api/users/:user_id/exams/:exam_id/exam-report
 * Fetch existing exam report from Firestore or generate if it doesn't exist
 */
export const getExamReport: AuthenticatedRequestHandler<
  unknown,
  Record<string, unknown>,
  ExamReportParams
> = async (req, res): Promise<void> => {
  try {
    const { user_id, exam_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.uid;
    const verifiedUser = req.verified_user;

    if (!firebaseUserIdFromToken) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(
          new Error('Authentication required'),
          'Authentication required',
        ),
      );
      return;
    }

    if (!user_id || !exam_id) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(
          new Error('User ID and Exam ID are required'),
          'User ID and Exam ID are required',
        ),
      );
      return;
    }

    // User verification is now handled by verifyUserAccess middleware
    // We can use the verified user directly
    if (!verifiedUser) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(
          new Error('User verification middleware not properly configured'),
          'User verification middleware not properly configured',
        ),
      );
      return;
    }

    logger.info(
      `GET_EXAM_REPORT_FIRESTORE: user_id=${user_id}, exam_id=${exam_id}`,
    );

    // First, we need to get the exam to retrieve cert_id for the new nested structure
    const { prisma } = await import('../../../../services/prisma/index.js');
    const exam = await prisma.examAttempt.findUnique({
      where: { exam_id },
      select: {
        cert_id: true,
        user_id: true,
      },
    });

    if (!exam) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(new Error('Exam not found'), 'Exam not found'),
      );
      return;
    }

    // Verify the exam belongs to the requesting user
    if (exam.user_id !== user_id) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(
          new Error('Access denied: Exam does not belong to this user'),
          'Access denied: Exam does not belong to this user',
        ),
      );
      return;
    }

    // Now try to get existing report from Firestore using the new nested structure
    const existingReport = await examReportFirestore.getExamReport(
      exam_id,
      user_id,
      exam.cert_id.toString(),
    );

    if (existingReport) {
      // Verify the report belongs to the requesting user
      if (existingReport.user_id !== user_id) {
        sendExamReportErrorResponse(
          res,
          mapExamReportError(
            new Error('Access denied: Exam report does not belong to this user'),
            'Access denied: Exam report does not belong to this user',
          ),
        );
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
  } catch (error: unknown) {
    logger.error('GET_EXAM_REPORT_FIRESTORE_ERROR:', {
      error_message: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_stack: error instanceof Error ? error.stack : undefined,
    });

    sendExamReportErrorResponse(
      res,
      mapExamReportError(error, 'Failed to fetch exam report'),
    );
  }
};

/**
 * POST /api/users/:user_id/exams/:exam_id/exam-report
 * Force regenerate exam report (overwrites existing report in Firestore)
 */
export const regenerateExamReport: AuthenticatedRequestHandler<
  unknown,
  Record<string, unknown>,
  ExamReportParams
> = async (req, res): Promise<void> => {
  try {
    const { user_id, exam_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.uid;
    const verifiedUser = req.verified_user;

    if (!firebaseUserIdFromToken) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(
          new Error('Authentication required'),
          'Authentication required',
        ),
      );
      return;
    }

    if (!user_id || !exam_id) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(
          new Error('User ID and Exam ID are required'),
          'User ID and Exam ID are required',
        ),
      );
      return;
    }

    // User verification is now handled by verifyUserAccess middleware
    // We can use the verified user directly
    if (!verifiedUser) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(
          new Error('User verification middleware not properly configured'),
          'User verification middleware not properly configured',
        ),
      );
      return;
    }

    logger.info(
      `REGENERATE_EXAM_REPORT_FIRESTORE: user_id=${user_id}, exam_id=${exam_id}`,
    );

    // First, we need to get the exam to retrieve cert_id for the new nested structure
    const { prisma } = await import('../../../../services/prisma/index.js');
    const exam = await prisma.examAttempt.findUnique({
      where: { exam_id },
      select: {
        cert_id: true,
        user_id: true,
      },
    });

    if (!exam) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(new Error('Exam not found'), 'Exam not found'),
      );
      return;
    }

    // Verify the exam belongs to the requesting user
    if (exam.user_id !== user_id) {
      sendExamReportErrorResponse(
        res,
        mapExamReportError(
          new Error('Access denied: Exam does not belong to this user'),
          'Access denied: Exam does not belong to this user',
        ),
      );
      return;
    }

    // Check if report exists and delete it to force regeneration
    const existingReport = await examReportFirestore.getExamReport(
      exam_id,
      user_id,
      exam.cert_id.toString(),
    );
    if (existingReport) {
      // Verify the report belongs to the requesting user before deleting
      if (existingReport.user_id !== user_id) {
        sendExamReportErrorResponse(
          res,
          mapExamReportError(
            new Error('Access denied: Exam report does not belong to this user'),
            'Access denied: Exam report does not belong to this user',
          ),
        );
        return;
      }

      // Delete the existing report to force regeneration
      await examReportFirestore.deleteExamReport(
        exam_id,
        user_id,
        exam.cert_id.toString(),
      );
      logger.info(
        `REGENERATE_EXAM_REPORT_FIRESTORE: Deleted existing report for exam_id=${exam_id}`,
      );
    }

    // Generate new report (will now store in Firestore since we deleted the old one)
    const result = await generateExamReport(exam_id, firebaseUserIdFromToken);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Exam report regenerated successfully',
    });
  } catch (error: unknown) {
    logger.error('REGENERATE_EXAM_REPORT_FIRESTORE_ERROR:', {
      error_message: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_stack: error instanceof Error ? error.stack : undefined,
    });

    sendExamReportErrorResponse(
      res,
      mapExamReportError(error, 'Failed to regenerate exam report'),
    );
  }
};

// Default export for backwards compatibility
export default getExamReport;
