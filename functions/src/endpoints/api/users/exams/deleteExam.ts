import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';

/**
 * Deletes an exam that failed question generation along with all associated data
 * Only allows deletion of exams with QUESTION_GENERATION_FAILED status
 * to prevent accidental deletion of active or completed exams
 *
 * This endpoint deletes:
 * 1. All quiz questions that were generated specifically for this exam (generated_from = exam_id)
 * 2. All answer options for those quiz questions
 * 3. All exam user answers for this exam
 * 4. The exam attempt record itself
 */
const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id, exam_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required.',
      });
      return;
    }

    if (!exam_id) {
      res.status(400).json({
        success: false,
        error: 'Exam ID is required.',
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    logger.info(
      `deleteExam: Starting exam deletion for exam_id: ${exam_id}, user_id: ${user_id}`,
    );

    // Get exam details with user information
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id },
      include: {
        user: {
          select: {
            user_id: true,
            firebase_user_id: true,
          },
        },
        certification: {
          select: {
            cert_id: true,
            name: true,
          },
        },
      },
    });

    if (!exam) {
      res.status(404).json({
        success: false,
        error: 'Exam not found.',
      });
      return;
    }

    // Verify the exam belongs to the requesting user
    if (exam.user_id !== user_id) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Exam does not belong to this user.',
      });
      return;
    }

    // Verify user has access to this exam via Firebase token
    if (exam.user.firebase_user_id !== firebaseUserIdFromToken) {
      res.status(403).json({
        success: false,
        error: 'Access denied: You can only delete your own exams.',
      });
      return;
    }

    // Only allow deletion of failed exams to prevent accidental deletion
    if (exam.exam_status !== ExamStatus.QUESTION_GENERATION_FAILED) {
      res.status(400).json({
        success: false,
        error: `Cannot delete exam. Only exams with failed question generation can be deleted. Current status: ${exam.exam_status}`,
      });
      return;
    }

    // Get all quiz questions that were specifically generated for this exam and exam user answers count in parallel
    const [associatedQuizQuestions, examUserAnswersCount] = await Promise.all([
      prismaInstance.quizQuestion.findMany({
        where: { generated_from: exam_id },
        select: { quiz_question_id: true },
      }),
      prismaInstance.examUserAnswer.count({
        where: { exam_id },
      }),
    ]);

    // Extract question IDs once for reuse
    const questionIds = associatedQuizQuestions.map((q) => q.quiz_question_id);

    logger.info(
      `deleteExam: Found ${questionIds.length} quiz questions and ${examUserAnswersCount} user answers to delete for exam ${exam_id}`,
    );

    // Use a transaction to ensure all related data is cleaned up atomically
    await prismaInstance.$transaction(async (prisma) => {
      // Delete any exam user answers (if any exist)
      if (examUserAnswersCount > 0) {
        await prisma.examUserAnswer.deleteMany({
          where: { exam_id },
        });
        logger.info(
          `deleteExam: Deleted ${examUserAnswersCount} exam user answers for exam ${exam_id}`,
        );
      }

      // Delete quiz questions that were generated specifically for this exam
      // Answer options will be automatically deleted due to onDelete: Cascade
      if (questionIds.length > 0) {
        const deletedQuestions = await prisma.quizQuestion.deleteMany({
          where: { generated_from: exam_id },
        });

        logger.info(
          `deleteExam: Deleted ${deletedQuestions.count} quiz questions (and their answer options) generated for exam ${exam_id}`,
        );
      }

      // Delete the exam attempt itself
      await prisma.examAttempt.delete({
        where: { exam_id },
      });

      logger.info(
        `deleteExam: Successfully deleted exam ${exam_id} for user ${user_id}`,
      );
    });

    // Return success response with exam details
    res.status(200).json({
      success: true,
      message: 'Exam deleted successfully.',
      data: {
        exam_id,
        user_id,
        cert_id: exam.cert_id,
        certification_name: exam.certification.name,
        exam_status: exam.exam_status,
        total_questions: exam.total_questions,
        token_cost: exam.token_cost,
        deleted_answers: examUserAnswersCount,
        deleted_quiz_questions: questionIds.length,
        deleted_quiz_question_ids: questionIds,
      },
    });
  } catch (error) {
    logger.error('deleteExam: Error deleting exam:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
