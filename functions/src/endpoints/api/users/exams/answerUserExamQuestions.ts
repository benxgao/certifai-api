import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequestHandler } from '../../../../types/express';
import prismaInstance from '../../../../services/prisma';
import { validateQuestionExamConstraint } from '../../../../utils/questionExamConstraint';
import { CacheManager } from '../../../../services/cache';

/**
 * Handles the request to answer a specific quiz question within an exam for a user.
 *
 * @param req - The Express request object. Expected to have:
 *   - `params`: Contains `user_id`, `exam_id`, and `quiz_question_id`.
 *   - `body`: Should be a JSON object containing `answer_option_id` (string).
 *     Example:
 *     {
 *       "answer_option_id": "some-option-uuid"
 *     }
 * @param res - The Express response object.
 */
const handler: AuthenticatedRequestHandler<
  { answer_option_id?: string | null },
  Record<string, unknown>,
  { user_id: string; exam_id: string; quiz_question_id: string }
> = async (req, res): Promise<void> => {
  try {
    const { user_id, exam_id, quiz_question_id } = req.params;
    const { answer_option_id } = req.body; // Assuming the request body sends answer_option_id

    if (!user_id || !exam_id || !quiz_question_id) {
      res.status(400).json({
        success: false,
        error: 'User ID, Exam ID, and Quiz Question ID are required.',
      });
    }

    if (answer_option_id === undefined) {
      res.status(400).json({
        success: false,
        error: 'answer_option_id is required in the request body.',
      });
    }

    logger.info(
      `EXAM_ANSWER_INIT: user_id=${user_id}, exam_id=${exam_id}, question_id=${quiz_question_id}`,
    );

    // Check if the specific exam question entry exists for this exam
    const existingExamUserAnswer =
      await prismaInstance.examUserAnswer.findUnique({
        where: {
          exam_id_quiz_question_id: {
            exam_id: exam_id,
            quiz_question_id: quiz_question_id,
          },
        },
        include: {
          // Include the quiz question to check if the answer option is valid
          quizQuestion: {
            include: {
              answerOptions: true,
            },
          },
          examAttempt: true, // Include the parent exam to check its status
        },
      });

    if (!existingExamUserAnswer) {
      res.status(404).json({
        success: false,
        error: 'Exam question not found for this user and exam.',
      });
      return; // Added return
    }

    // Validate question-exam constraint before allowing the answer
    const constraintValidation = await validateQuestionExamConstraint(
      quiz_question_id,
      exam_id,
    );

    if (!constraintValidation.isValid) {
      logger.warn(
        `Question-exam constraint violation: ${constraintValidation.error}`,
      );
      res.status(400).json({
        success: false,
        error: `Invalid question-exam association: ${constraintValidation.error}`,
      });
      return;
    }

    // Check if the exam has already been submitted
    if (existingExamUserAnswer.examAttempt.submitted_at) {
      res.status(403).json({
        success: false,
        error: 'Exam has already been submitted. Answers cannot be changed.',
      });
      return; // Added return
    }

    // Validate if the provided answer_option_id is valid for the question
    const isValidOption =
      existingExamUserAnswer?.quizQuestion.answerOptions.some(
        (option) => option.option_id === answer_option_id,
      );

    if (!isValidOption) {
      res.status(400).json({
        success: false,
        error: 'Invalid answer_option_id for the given question.',
      });
      return; // Added return
    }

    // Determine if the selected answer is correct
    const selectedOption =
      existingExamUserAnswer?.quizQuestion.answerOptions.find(
        (option) => option.option_id === answer_option_id,
      );
    const is_correct = selectedOption ? selectedOption.is_correct : false;

    // Update the existing answer
    const updatedAnswer = await prismaInstance.examUserAnswer.update({
      where: {
        user_answer_id: existingExamUserAnswer?.user_answer_id,
      },
      data: {
        selected_option_id: answer_option_id,
        is_correct: is_correct,
        // exam_id and quiz_question_id are part of the unique constraint and should not be updated here
      },
    });

    logger.info(
      `EXAM_ANSWER_SUCCESS: user_id=${user_id}, exam_id=${exam_id}, question_id=${quiz_question_id}, option_id=${answer_option_id}, correct=${is_correct}`,
    );

    // Invalidate user exam cache since answer was updated
    await CacheManager.invalidateUserExamCache(user_id);

    res.status(200).json({
      success: true,
      data: updatedAnswer,
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
