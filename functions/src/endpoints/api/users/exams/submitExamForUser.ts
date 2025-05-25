import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';

const handler = async (req: any | CustomRequest, res: Response) => {
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
      `Updating answer for user_id: ${user_id}, exam_id: ${exam_id}, quiz_question_id: ${quiz_question_id}`,
    );

    // Check if the specific exam question entry exists for this exam
    const existingExamUserAnswer =
      await prismaInstance.examUserAnswers.findUnique({
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
        },
      });

    if (!existingExamUserAnswer) {
      res.status(404).json({
        success: false,
        error: 'Exam question not found for this user and exam.',
      });
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
    }

    // Determine if the selected answer is correct
    const selectedOption =
      existingExamUserAnswer?.quizQuestion.answerOptions.find(
        (option) => option.option_id === answer_option_id,
      );
    const is_correct = selectedOption ? selectedOption.is_correct : false;

    // Update the existing answer
    const updatedAnswer = await prismaInstance.examUserAnswers.update({
      where: {
        // Use the unique user_answer_id from the fetched record
        user_answer_id: existingExamUserAnswer?.user_answer_id,
      },
      data: {
        selected_option_id: answer_option_id,
        is_correct: is_correct,
      },
    });

    logger.info('Answer updated successfully.');

    // After updating the answer, recalculate and update the exam score
    const allAnswersForExam = await prismaInstance.examUserAnswers.findMany({
      where: { exam_id: exam_id },
      select: { is_correct: true },
    });

    const totalQuestionsInExam = allAnswersForExam.length;
    const correctAnswers = allAnswersForExam.filter(
      (ans) => ans.is_correct === true,
    ).length;

    let currentScore = 0;
    if (totalQuestionsInExam > 0) {
      currentScore = (correctAnswers / totalQuestionsInExam) * 100;
    }

    await prismaInstance.exams.update({
      where: { exam_id: exam_id },
      data: {
        score: parseFloat(currentScore.toFixed(2)), // Store score as a float, e.g., 85.50
        submitted_at: new Date(), // Update submitted_at to the current time
      },
    });

    logger.info(
      `Exam score updated for exam_id: ${exam_id} to ${currentScore.toFixed(
        2,
      )}%`,
    );

    res.status(200).json({
      success: true,
      data: updatedAnswer,
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
