import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { exam_id } = req.params;
    const certIdFromParams = req.params.cert_id; // Keep as string initially for parsing check

    // 1. Collect all submitted answers for this exam to count correct ones
    const allSubmittedAnswers = await prismaInstance.examUserAnswers.findMany({
      where: { exam_id: exam_id },
      select: { is_correct: true },
    });

    const correctlyAnsweredCount = allSubmittedAnswers.filter(
      (ans) => ans.is_correct === true,
    ).length;

    // 2. Determine the total number of questions for this exam's certification.
    let totalQuestionsInExamDefinition = 0;
    let parsedCertId: number | undefined;

    if (certIdFromParams && !isNaN(parseInt(certIdFromParams, 10))) {
      parsedCertId = parseInt(certIdFromParams, 10);
    } else {
      logger.warn(
        `Invalid or missing cert_id in request params for exam_id: ${exam_id}. Param value: '${certIdFromParams}'. Total questions from definition will be 0. Fallback scoring may apply.`,
      );
    }

    if (parsedCertId !== undefined) {
      try {
        totalQuestionsInExamDefinition =
          await prismaInstance.quizQuestions.count({
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

    // 4. Update the exam record with the new score and submission timestamp
    await prismaInstance.exams.update({
      where: { exam_id: exam_id },
      data: {
        score: parseFloat(currentScore.toFixed(2)), // Store score as a float
        submitted_at: new Date(), // Update submitted_at to the current time of this answer submission
      },
    });

    logger.info(
      `Exam score updated for exam_id: ${exam_id}. Score: ${currentScore.toFixed(
        2,
      )}%. Correct answers: ${correctlyAnsweredCount}/${
        scoreDenominator > 0 ? scoreDenominator : 'N/A (check definition)'
      }.`,
    );

    res.status(200).json({
      success: true,
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
