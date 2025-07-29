import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
import {
  getRtdbValue,
  deleteRtdbValue,
} from '../../../../services/firebase/rtdb';
import { CacheManager } from '../../../../services/cache';

/**
 * Deletes exam-related data from Firebase Realtime Database
 * @param exam_id - The exam identifier
 * @returns Promise<{examPlanDeleted: boolean, examDataDeleted: boolean}>
 */
async function deleteExamFromRtdb(exam_id: string): Promise<{
  examPlanDeleted: boolean;
  examDataDeleted: boolean;
}> {
  const results = {
    examPlanDeleted: false,
    examDataDeleted: false,
  };

  try {
    // Delete exam plan data
    const examPlanPath = `exam_plans/${exam_id}`;

    // First check if data exists, but proceed with deletion even if check fails
    let dataExists = false;
    try {
      const examPlanData = await getRtdbValue(examPlanPath);
      dataExists = !!examPlanData;
      if (dataExists) {
        logger.info(
          `deleteExam: Found exam plan data in RTDB at path: ${examPlanPath}`,
        );
      } else {
        logger.info(
          `deleteExam: No exam plan found in RTDB at path: ${examPlanPath}`,
        );
      }
    } catch (readError) {
      logger.warn(
        `deleteExam: Failed to read exam plan from RTDB, will still attempt deletion: ${readError}`,
      );
    }

    // Always attempt deletion regardless of read result (in case of permission issues)
    await deleteRtdbValue(examPlanPath);
    results.examPlanDeleted = true;
    logger.info(
      `deleteExam: Successfully deleted exam plan from RTDB at path: ${examPlanPath}`,
    );
  } catch (error) {
    logger.warn(`deleteExam: Failed to delete exam plan from RTDB: ${error}`);
  }

  try {
    // REFACTORED: Removed exam data deletion as "exams" collection is no longer used in RTDB
    // The exam topics data was only being written but never read by any other part of the application
    logger.info(
      `deleteExam: Skipped exam data deletion from RTDB (exams collection removed as unused)`,
      {
        exam_id,
        reason: 'exams_collection_removed_as_unused',
        structuredData: true,
      },
    );
    results.examDataDeleted = true; // Mark as successful since there's nothing to delete
  } catch (error) {
    logger.warn(`deleteExam: Failed to delete exam data from RTDB: ${error}`);
  }

  return results;
}

/**
 * Validates that all related data has been properly deleted for an exam
 * This is a safety check to ensure complete cleanup
 */
async function validateExamDeletion(exam_id: string): Promise<{
  isCompletelyDeleted: boolean;
  remainingData: {
    examAttempt: number;
    quizQuestions: number;
    answerOptions: number;
    examUserAnswers: number;
  };
}> {
  const [examAttempt, quizQuestions, answerOptions, examUserAnswers] =
    await Promise.all([
      prismaInstance.examAttempt.count({ where: { exam_id } }),
      prismaInstance.quizQuestion.count({ where: { generated_from: exam_id } }),
      prismaInstance.answerOption.count({
        where: {
          quizQuestion: {
            generated_from: exam_id,
          },
        },
      }),
      prismaInstance.examUserAnswer.count({ where: { exam_id } }),
    ]);

  const remainingData = {
    examAttempt,
    quizQuestions,
    answerOptions,
    examUserAnswers,
  };

  const isCompletelyDeleted = Object.values(remainingData).every(
    (count) => count === 0,
  );

  return {
    isCompletelyDeleted,
    remainingData,
  };
}

/**
 * Deletes an exam along with all associated data in proper cascade order
 * Allows deletion of exams in any status to give users full control over their exam data
 *
 * This endpoint explicitly deletes all related data in the correct order:
 * 1. ExamUserAnswer records (foreign key references)
 * 2. AnswerOption records (for quiz questions generated for this exam)
 * 3. QuizQuestion records (generated specifically for this exam)
 * 4. ExamAttempt record (the main exam record)
 * 5. RTDB data: exam plans and exam questions/topics data
 * 6. Cache invalidation
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

    // Define which exam statuses can be safely deleted
    // Allow deletion of all exam statuses as requested
    const deletableStatuses: ExamStatus[] = [
      ExamStatus.PENDING_QUESTIONS,
      ExamStatus.QUESTIONS_GENERATING,
      ExamStatus.READY,
      ExamStatus.IN_PROGRESS,
      ExamStatus.COMPLETED,
      ExamStatus.QUESTION_GENERATION_FAILED,
    ];

    // Allow deletion of exams in any status
    if (!deletableStatuses.includes(exam.exam_status)) {
      res.status(400).json({
        success: false,
        error: `Cannot delete exam with status: ${exam.exam_status}. This is an unexpected status.`,
      });
      return;
    }

    // Get all quiz questions that were specifically generated for this exam
    // and count related data in parallel for better performance
    const [associatedQuizQuestions, examUserAnswersCount] = await Promise.all([
      prismaInstance.quizQuestion.findMany({
        where: { generated_from: exam_id },
        select: {
          quiz_question_id: true,
          _count: {
            select: {
              answerOptions: true,
            },
          },
        },
      }),
      prismaInstance.examUserAnswer.count({
        where: { exam_id },
      }),
    ]);

    // Extract question IDs and calculate total answer options
    const questionIds = associatedQuizQuestions.map((q) => q.quiz_question_id);
    const totalAnswerOptions = associatedQuizQuestions.reduce(
      (sum, q) => sum + q._count.answerOptions,
      0,
    );

    logger.info(
      `deleteExam: Found data to delete for exam ${exam_id}: ${questionIds.length} quiz questions, ${totalAnswerOptions} answer options, ${examUserAnswersCount} user answers`,
    );

    // Use a transaction to ensure all related data is cleaned up atomically
    // Delete in proper cascade order to avoid foreign key constraint violations
    const deletionCounts = await prismaInstance.$transaction(async (prisma) => {
      let deletedAnswerOptions = 0;
      let deletedQuestions = 0;
      let deletedUserAnswers = 0;

      // Step 1: Delete exam user answers first (they reference both exam and questions)
      if (examUserAnswersCount > 0) {
        const userAnswerResult = await prisma.examUserAnswer.deleteMany({
          where: { exam_id },
        });
        deletedUserAnswers = userAnswerResult.count;
        logger.info(
          `deleteExam: Deleted ${deletedUserAnswers} exam user answers for exam ${exam_id}`,
        );

        // Verify we deleted the expected number of user answers
        if (deletedUserAnswers !== examUserAnswersCount) {
          logger.warn(
            `deleteExam: User answer count mismatch for exam ${exam_id}. Expected: ${examUserAnswersCount}, Deleted: ${deletedUserAnswers}`,
          );
        }
      }

      // Step 2: Delete answer options for questions generated for this exam
      if (questionIds.length > 0) {
        const answerOptionsResult = await prisma.answerOption.deleteMany({
          where: {
            quiz_question_id: {
              in: questionIds,
            },
          },
        });
        deletedAnswerOptions = answerOptionsResult.count;
        logger.info(
          `deleteExam: Deleted ${deletedAnswerOptions} answer options for quiz questions of exam ${exam_id}`,
        );

        // Verify we deleted the expected number of answer options
        if (deletedAnswerOptions !== totalAnswerOptions) {
          logger.warn(
            `deleteExam: Answer option count mismatch for exam ${exam_id}. Expected: ${totalAnswerOptions}, Deleted: ${deletedAnswerOptions}`,
          );
        }

        // Step 3: Delete quiz questions generated specifically for this exam
        const questionsResult = await prisma.quizQuestion.deleteMany({
          where: { generated_from: exam_id },
        });
        deletedQuestions = questionsResult.count;
        logger.info(
          `deleteExam: Deleted ${deletedQuestions} quiz questions generated for exam ${exam_id}`,
        );

        // Verify we deleted the expected number of questions
        if (deletedQuestions !== questionIds.length) {
          logger.warn(
            `deleteExam: Quiz question count mismatch for exam ${exam_id}. Expected: ${questionIds.length}, Deleted: ${deletedQuestions}`,
          );
        }
      }

      // Step 4: Delete the exam attempt record itself
      await prisma.examAttempt.delete({
        where: { exam_id },
      });

      logger.info(
        `deleteExam: Successfully deleted exam ${exam_id} for user ${user_id} with all related data:`,
        {
          exam_id,
          user_id,
          deleted_user_answers: deletedUserAnswers,
          deleted_answer_options: deletedAnswerOptions,
          deleted_quiz_questions: deletedQuestions,
        },
      );

      // Return deletion counts for response
      return {
        deletedUserAnswers,
        deletedAnswerOptions,
        deletedQuestions,
      };
    });

    // Clean up RTDB data after successful database deletion
    logger.info(`deleteExam: Starting RTDB cleanup for exam ${exam_id}`);
    const rtdbCleanupResults = await deleteExamFromRtdb(exam_id);

    // Validate that all related data has been completely removed
    const validationResults = await validateExamDeletion(exam_id);
    if (!validationResults.isCompletelyDeleted) {
      logger.warn(
        `deleteExam: Validation check found remaining data for exam ${exam_id}:`,
        validationResults.remainingData,
      );
    } else {
      logger.info(
        `deleteExam: Validation confirmed complete deletion of exam ${exam_id}`,
      );
    }

    // Invalidate user exam cache since exam was deleted
    await CacheManager.invalidateUserExamCache(user_id);

    // Return success response with comprehensive deletion details
    res.status(200).json({
      success: true,
      message: 'Exam and all related data deleted successfully.',
      data: {
        exam_id,
        user_id,
        cert_id: exam.cert_id,
        certification_name: exam.certification.name,
        exam_status: exam.exam_status,
        total_questions: exam.total_questions,
        token_cost: exam.token_cost,
        deletion_summary: {
          exam_user_answers_deleted: deletionCounts.deletedUserAnswers,
          exam_user_answers_expected: examUserAnswersCount,
          answer_options_deleted: deletionCounts.deletedAnswerOptions,
          answer_options_expected: totalAnswerOptions,
          quiz_questions_deleted: deletionCounts.deletedQuestions,
          quiz_questions_expected: questionIds.length,
          quiz_question_ids_deleted: questionIds,
        },
        rtdb_cleanup: {
          exam_plan_deleted: rtdbCleanupResults.examPlanDeleted,
          exam_data_deleted: rtdbCleanupResults.examDataDeleted,
        },
        validation: {
          completely_deleted: validationResults.isCompletelyDeleted,
          remaining_data_check: validationResults.remainingData,
        },
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
