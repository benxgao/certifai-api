import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
import { CacheManager } from '../../../../services/cache';
import { generateExamReport } from '../../ai/examReportGenerator';

const handler = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
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
        user: {
          select: {
            user_id: true,
            credit_tokens: true,
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

    // Automatically generate exam report after successful submission
    try {
      logger.info(
        `AUTO_EXAM_REPORT_INIT: Starting automatic report generation for exam_id=${exam_id}`,
      );

      // Generate exam report automatically (skip auth check since we're in internal service call)
      await generateExamReport(exam_id, undefined, true);

      logger.info(
        `AUTO_EXAM_REPORT_SUCCESS: Automatic report generated for exam_id=${exam_id}`,
      );
    } catch (reportError) {
      // Log the error but don't fail the submission - report generation is supplementary
      logger.error(
        `AUTO_EXAM_REPORT_ERROR: Failed to generate automatic report for exam_id=${exam_id}`,
        {
          error: reportError as any,
          exam_id,
          user_id,
          will_retry: false, // User can manually generate later if needed
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
    logger.error('Error in answerUserExamQuizQuestions handler:', error as any);
    // It's good practice to check for specific Prisma errors if needed, e.g., P2025 (Record not found)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
