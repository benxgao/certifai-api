import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequestHandler } from '../../../../types/express';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
import { CacheManager } from '../../../../services/cache';
import { KnowledgePoolingTaskService } from '../../../../services/cloudTasks/knowledgePoolingTaskService';
import { ExamReportTaskService } from '../../../../services/cloudTasks/examReportTaskService';

const handler: AuthenticatedRequestHandler<
  unknown,
  Record<string, unknown>,
  { user_id: string; cert_id: string; exam_id: string }
> = async (req, res): Promise<void> => {
  try {
    const { user_id, cert_id, exam_id } = req.params;

    logger.info(
      `EXAM_SUBMIT_INIT: user_id=${user_id}, exam_id=${exam_id}, cert_id=${cert_id}`,
    );

    // Validate user authentication
    if (!user_id) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    // 0. Get the exam details to check token cost and current status (optimized with field selection)
    const examAttempt = await prismaInstance.examAttempt.findUnique({
      where: { exam_id: exam_id },
      select: {
        exam_id: true,
        user_id: true,
        token_cost: true,
        score: true,
        submitted_at: true,
        total_questions: true,
        cert_id: true, // Add cert_id for knowledge pooling task
        user: {
          select: {
            user_id: true,
            credit_tokens: true,
          },
        },
        certification: {
          // Add certification details for knowledge pooling task
          select: {
            cert_id: true,
            name: true,
          },
        },
      },
    });

    if (!examAttempt) {
      res.status(404).json({
        success: false,
        error: 'Exam not found',
      });
      return;
    }

    if (examAttempt.user_id !== user_id) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized to submit this exam',
      });
      return;
    }

    // Check if exam has already been submitted
    if (examAttempt.submitted_at) {
      res.status(400).json({
        success: false,
        error: 'Exam has already been submitted',
      });
      return;
    }

    // 1. Collect all submitted answers for this exam BY THIS SPECIFIC USER to count correct ones
    const allSubmittedAnswers = await prismaInstance.examUserAnswer.findMany({
      where: {
        exam_id: exam_id,
        examAttempt: {
          user_id, // Filter by current user through the exam attempt
        },
      },
      select: { is_correct: true },
    });

    const correctlyAnsweredCount = allSubmittedAnswers.filter(
      (ans) => ans.is_correct === true,
    ).length;

    // Summary log before score calculation
    logger.info(
      `Preparing to calculate score for exam_id: ${exam_id}. ` +
        `Correctly answered: ${correctlyAnsweredCount}. ` +
        `Total questions in this exam: ${examAttempt.total_questions}. ` +
        `Total submitted answers: ${allSubmittedAnswers.length}.`,
    );

    // 3. Calculate the score based on actual exam questions, not certification pool
    let currentScore = 0;
    let scoreDenominator = examAttempt.total_questions || 0;

    if (examAttempt.total_questions && examAttempt.total_questions > 0) {
      // Use the actual number of questions in THIS exam, not the entire certification pool
      currentScore = Math.round(
        (correctlyAnsweredCount / examAttempt.total_questions) * 100,
      );
    } else if (allSubmittedAnswers.length > 0) {
      // Fallback: If total questions in exam is 0 or null (shouldn't happen),
      // score based on the number of answered questions.
      logger.warn(
        `Scoring exam_id ${exam_id} based on ${allSubmittedAnswers.length} answered questions ` +
          'due to zero or null total questions in exam record. This indicates a data issue.',
      );
      scoreDenominator = allSubmittedAnswers.length;
      currentScore = Math.round(
        (correctlyAnsweredCount / allSubmittedAnswers.length) * 100,
      );
    }
    // If total_questions is 0/null and allSubmittedAnswers.length is 0, score remains 0.

    // 4. Deduct credit tokens from user's account
    const tokenCost = examAttempt.token_cost;

    if (examAttempt.user.credit_tokens < tokenCost) {
      res.status(400).json({
        success: false,
        error: `Insufficient credit tokens to submit exam. Required: ${tokenCost}, Available: ${examAttempt.user.credit_tokens}`,
      });
      return;
    }

    // Calculate energy tokens to award (2x the number of correct answers)
    const energyTokensToAward = correctlyAnsweredCount * 2;

    // Use an optimized transaction with proper isolation level for better concurrent performance
    await prismaInstance.$transaction(
      async (prisma) => {
        // Batch update both user tokens and exam status in parallel for better performance
        await Promise.all([
          // Deduct credit tokens and award energy tokens to user
          prisma.user.update({
            where: { user_id: user_id },
            data: {
              credit_tokens: {
                decrement: tokenCost,
              },
              energy_tokens: {
                increment: energyTokensToAward,
              },
            },
          }),
          // Update the exam record with the new score and submission timestamp
          prisma.examAttempt.update({
            where: { exam_id: exam_id },
            data: {
              score: currentScore, // Use integer score directly
              submitted_at: new Date(),
              exam_status: ExamStatus.COMPLETED,
            },
          }),
        ]);

        // Invalidate user exam cache when exam is completed
        await CacheManager.invalidateUserExamCacheForGenerationChange(
          user_id,
          'exam_completed',
        );

        // Invalidate user profile cache since tokens were updated
        await CacheManager.invalidateUserProfileCache(user_id);

        // Log the parallel update performance
        logger.info(
          `PARALLEL_UPDATE_SUCCESS: Completed user and exam updates concurrently`,
          {
            exam_id,
            user_id,
            tokens_deducted: tokenCost,
            energy_awarded: energyTokensToAward,
            performance_optimization: 'parallel_updates',
            structuredData: true,
          },
        );
      },
      {
        // Optimized transaction settings for concurrent writes
        timeout: 10000, // 10 seconds
        maxWait: 5000, // 5 seconds max wait
        isolationLevel: 'ReadCommitted', // Better for concurrent operations
      },
    );

    logger.info(
      `EXAM_SUBMIT_SUCCESS: exam_id=${exam_id}, score=${currentScore}%, correct=${correctlyAnsweredCount}/${scoreDenominator}, tokens_deducted=${tokenCost}, energy_awarded=${energyTokensToAward}`,
    );

    // Trigger exam report generation in the background (non-blocking)
    try {
      logger.info(
        `EXAM_REPORT_TASK_INIT: Triggering background exam report generation for exam_id=${exam_id}`,
      );

      const examReportService = ExamReportTaskService.getInstance();
      const reportTaskName =
        await examReportService.createPostSubmissionReportTask(
          exam_id,
          user_id,
          examAttempt.cert_id,
          examAttempt.certification?.name || 'Unknown Certification',
        );

      if (reportTaskName) {
        logger.info(
          `EXAM_REPORT_TASK_SUCCESS: Background report task created for exam_id=${exam_id}`,
          {
            task_name: reportTaskName,
            cert_id: examAttempt.cert_id,
            certification_name: examAttempt.certification?.name,
            trigger_source: 'exam_submission',
            structuredData: true,
          },
        );
      } else {
        logger.warn(
          `EXAM_REPORT_TASK_FAILED: Failed to create background report task for exam_id=${exam_id}`,
          {
            cert_id: examAttempt.cert_id,
            certification_name: examAttempt.certification?.name,
            reason: 'task_creation_failed',
            structuredData: true,
          },
        );
      }
    } catch (reportError) {
      // Log the error but don't fail the submission - report generation is supplementary
      logger.error(
        `EXAM_REPORT_TASK_ERROR: Failed to trigger background report generation for exam_id=${exam_id}`,
        {
          error_message:
            reportError instanceof Error
              ? reportError.message
              : String(reportError),
          error_type:
            reportError instanceof Error
              ? reportError.constructor.name
              : typeof reportError,
          error_stack:
            reportError instanceof Error ? reportError.stack : undefined,
          exam_id,
          user_id,
          will_retry: false, // User can manually generate later if needed
        },
      );
    }

    // Trigger knowledge pooling generation in the background (silently, non-blocking)
    try {
      logger.info(
        `KNOWLEDGE_POOLING_TASK_INIT: Triggering background knowledge pooling for exam_id=${exam_id}`,
      );

      const knowledgePoolingService = KnowledgePoolingTaskService.getInstance();
      const taskName = await knowledgePoolingService.createPostSubmissionTask(
        exam_id,
        user_id,
        examAttempt.cert_id,
        examAttempt.certification?.name || 'Unknown Certification',
      );

      if (taskName) {
        logger.info(
          `KNOWLEDGE_POOLING_TASK_SUCCESS: Background task created for exam_id=${exam_id}`,
          {
            task_name: taskName,
            cert_id: examAttempt.cert_id,
            certification_name: examAttempt.certification?.name,
            trigger_source: 'exam_submission',
            structuredData: true,
          },
        );
      } else {
        logger.warn(
          `KNOWLEDGE_POOLING_TASK_FAILED: Failed to create background task for exam_id=${exam_id}`,
          {
            cert_id: examAttempt.cert_id,
            certification_name: examAttempt.certification?.name,
            reason: 'task_creation_failed',
            structuredData: true,
          },
        );
      }
    } catch (knowledgePoolingError) {
      // Log the error but don't fail the submission - knowledge pooling is supplementary
      logger.error(
        `KNOWLEDGE_POOLING_TASK_ERROR: Failed to trigger background knowledge pooling for exam_id=${exam_id}`,
        {
          error_message:
            knowledgePoolingError instanceof Error
              ? knowledgePoolingError.message
              : String(knowledgePoolingError),
          error_type:
            knowledgePoolingError instanceof Error
              ? knowledgePoolingError.constructor.name
              : typeof knowledgePoolingError,
          error_stack:
            knowledgePoolingError instanceof Error
              ? knowledgePoolingError.stack
              : undefined,
          exam_id,
          user_id,
          cert_id: examAttempt.cert_id,
          certification_name: examAttempt.certification?.name,
          will_continue_silently: true, // Background task failure doesn't affect user experience
          structuredData: true,
        },
      );
    }

    res.status(200).json({
      success: true,
      data: {
        score: currentScore, // Return integer score
        tokens_deducted: tokenCost,
        energy_tokens_awarded: energyTokensToAward,
        correct_answers: correctlyAnsweredCount,
      },
    });
  } catch (error) {
    logger.error('Error in answerUserExamQuizQuestions handler:', {
      error_message: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_stack: error instanceof Error ? error.stack : undefined,
    });
    // It's good practice to check for specific Prisma errors if needed, e.g., P2025 (Record not found)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
