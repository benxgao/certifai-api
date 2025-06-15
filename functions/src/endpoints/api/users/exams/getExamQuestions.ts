import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';

// Define a type for the question response structure for clarity
type AnswerOptionResponse = {
  option_id: string;
  option_text: string;
  is_correct?: boolean;
};

type QuestionResponse = {
  quiz_question_id: string;
  question_text: string;
  difficulty: string | null;
  generated_from: string | null;
  cert_id: number;
  user_answer_id: string; // ID of the ExamUserAnswers record
  selected_option_id: string | null;
  explanations?: string | null;
  user_answer_is_correct?: boolean | null;
  answerOptions: AnswerOptionResponse[];
};

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id, exam_id } = req.params;
    const { page: pageQuery, pageSize: pageSizeQuery } = req.query;

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

    let page = parseInt(pageQuery as string, 10);
    let pageSize = parseInt(pageSizeQuery as string, 10);

    if (isNaN(page) || page <= 0) {
      page = 1;
    }
    if (isNaN(pageSize) || pageSize <= 0) {
      pageSize = 10; // Default page size
    }
    if (pageSize > 100) {
      pageSize = 100; // Max page size
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Verify exam exists and belongs to the user
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id: exam_id },
    });

    if (!exam) {
      res.status(404).json({ success: false, error: 'Exam not found.' });
      return;
    }

    // Authorization: Check if the exam belongs to the user_id specified in the path
    // Further checks might be needed to ensure the authenticated user (from req.firebase_user_info)
    // matches req.params.user_id or has admin rights.
    if (exam.user_id !== user_id) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Exam does not belong to this user.',
      });
      return;
    }

    logger.info(
      `Fetching questions for exam_id: ${exam_id}, user_id: ${user_id}, page: ${page}, pageSize: ${pageSize}`,
    );

    const examUserAnswers = await prismaInstance.examUserAnswer.findMany({
      where: { exam_id: exam_id },
      include: {
        quizQuestion: {
          include: {
            answerOptions: {
              select: {
                option_id: true,
                option_text: true,
                is_correct: true, // Always fetch the true correctness of the option
              },
            },
            // explanations field from QuizQuestion is included by default here
          },
        },
        // selected_option_id and is_correct (for the user's answer) from ExamUserAnswers are included by default
      },
      skip: skip,
      take: take,
      // Ensuring consistent question order for pagination and user experience.
      orderBy: { quizQuestion: { created_at: 'asc' } },
    });

    const totalQuestions = await prismaInstance.examUserAnswer.count({
      where: { exam_id: exam_id },
    });

    const questions = examUserAnswers.map((eau) => {
      const { quizQuestion } = eau;
      const isExamSubmittedAndScored =
        exam.score !== null && exam.submitted_at !== null;

      const questionResponse: QuestionResponse = {
        quiz_question_id: quizQuestion.quiz_question_id,
        question_text: quizQuestion.question_text,
        difficulty: quizQuestion.difficulty,
        generated_from: quizQuestion.generated_from,
        cert_id: quizQuestion.cert_id,

        user_answer_id: eau.user_answer_id,
        selected_option_id: eau.selected_option_id, // Always include user's selection

        answerOptions: quizQuestion.answerOptions.map((ao) => {
          const option: AnswerOptionResponse = {
            option_id: ao.option_id,
            option_text: ao.option_text,
          };
          if (isExamSubmittedAndScored) {
            option.is_correct = ao.is_correct;
          }
          return option;
        }),
      };

      if (isExamSubmittedAndScored) {
        questionResponse.explanations = quizQuestion.explanations;
        questionResponse.user_answer_is_correct = eau.is_correct;
      }

      return questionResponse;
    });

    res.status(200).json({
      success: true,
      data: {
        questions: questions,
      },
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalItems: totalQuestions,
        totalPages: Math.ceil(totalQuestions / pageSize),
      },
    });
  } catch (error) {
    logger.error('Error in get_questions handler:', error as any);
    res
      .status(
        error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
      )
      .json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
  }
};

export default handler;
