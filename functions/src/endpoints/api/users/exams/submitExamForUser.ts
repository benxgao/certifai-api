import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
import { CacheManager } from '../../../../services/cache';

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

    // 2. Determine the total number of questions for this exam's certification.
    let totalQuestionsInExamDefinition = 0;
    let parsedCertId: number | undefined;

    if (cert_id && !isNaN(parseInt(cert_id, 10))) {
      parsedCertId = parseInt(cert_id, 10);
    } else {
      logger.warn(
        `Invalid or missing cert_id in request params for exam_id: ${exam_id}. Param value: '${cert_id}'. Total questions from definition will be 0. Fallback scoring may apply.`,
      );
    }

    if (parsedCertId !== undefined) {
      try {
        totalQuestionsInExamDefinition =
          await prismaInstance.quizQuestion.count({
            where: { cert_id: parsedCertId },
          });
        logger.info(
          `For exam_id: ${exam_id} (using cert_id from params: ${parsedCertId}), determined total questions in definition: ${totalQuestionsInExamDefinition}.`,
        );
        if (totalQuestionsInExamDefinition === 0) {
          logger.warn(
            `No questions found in definition for cert_id: ${parsedCertId} (associated with exam_id: ${exam_id}). Fallback scoring may apply.`,
          );
        }
      } catch (e: any) {
        logger.error(
          `Error while determining total questions for exam_id ${exam_id} (using cert_id from params: ${parsedCertId}): ${
            e instanceof Error ? e.message : String(e)
          }. Total questions from definition will be 0. Fallback scoring may apply.`,
        );
        // totalQuestionsInExamDefinition remains 0 in case of error.
      }
    }
    // If parsedCertId was undefined, totalQuestionsInExamDefinition remains 0, and a warning has already been logged.

    // Summary log before score calculation
    logger.info(
      `Preparing to calculate score for exam_id: ${exam_id}. ` +
        `Correctly answered: ${correctlyAnsweredCount}. ` +
        `Total questions from definition: ${totalQuestionsInExamDefinition} (derived from cert_id in params: ${
          parsedCertId ?? 'N/A'
        }). ` +
        `Total submitted answers: ${allSubmittedAnswers.length}.`,
    );

    // 3. Calculate the score
    let currentScore = 0;
    let scoreDenominator = totalQuestionsInExamDefinition;

    if (totalQuestionsInExamDefinition > 0) {
      currentScore =
        (correctlyAnsweredCount / totalQuestionsInExamDefinition) * 100;
    } else if (allSubmittedAnswers.length > 0) {
      // Fallback: If total questions in definition is 0 (e.g., due to error or setup issue),
      // and answers have been submitted, score based on the number of answered questions.
      logger.warn(
        `Scoring exam_id ${exam_id} based on ${allSubmittedAnswers.length} answered questions ` +
          'due to zero total questions in definition. This might indicate an issue with exam setup or certification linkage.',
      );
      scoreDenominator = allSubmittedAnswers.length;
      currentScore =
        (correctlyAnsweredCount / allSubmittedAnswers.length) * 100;
    }
    // If totalQuestionsInExamDefinition is 0 and allSubmittedAnswers.length is 0, score remains 0.

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
              score: parseFloat(currentScore.toFixed(2)),
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
      `EXAM_SUBMIT_SUCCESS: exam_id=${exam_id}, score=${currentScore.toFixed(
        2,
      )}%, correct=${correctlyAnsweredCount}/${scoreDenominator}, tokens_deducted=${tokenCost}, energy_awarded=${energyTokensToAward}`,
    );

    res.status(200).json({
      success: true,
      data: {
        score: parseFloat(currentScore.toFixed(2)),
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
