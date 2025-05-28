import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';

interface CreateExamForUserBody {
  cert_id: number;
  numberOfQuestions?: number;
}

const DEFAULT_NUMBER_OF_QUESTIONS = 20;
const MAX_NUMBER_OF_QUESTIONS = 100; // Set a reasonable max

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id } = req.params;
    const {
      cert_id,
      numberOfQuestions: numQuestionsBody,
    }: CreateExamForUserBody = req.body;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!user_id) {
      res
        .status(400)
        .json({ success: false, error: 'User ID is required in path.' });
      return;
    }

    if (!firebaseUserIdFromToken) {
      // This should ideally be caught by the verifyFirebaseToken middleware
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    if (typeof cert_id !== 'number') {
      res.status(400).json({
        success: false,
        error: 'cert_id (number) is required in body.',
      });
      return;
    }

    const numberOfQuestions =
      typeof numQuestionsBody === 'number' && numQuestionsBody > 0
        ? Math.min(numQuestionsBody, MAX_NUMBER_OF_QUESTIONS)
        : DEFAULT_NUMBER_OF_QUESTIONS;

    logger.info(`createExamForUser: initialized:
      | user_id: ${user_id}
      | cert_id: ${cert_id}
      | questions: ${numberOfQuestions}`);

    // 1. Find the user by the provided user_id (internal UUID)
    const user = await prismaInstance.users.findUnique({
      where: { user_id: user_id },
    });

    if (!user) {
      res
        .status(404)
        .json({ success: false, error: `User with ID: ${user_id} not found.` });
      return;
    }

    // 2. Authorization: Check if the firebase_user_id from token matches the user's firebase_user_id
    // This ensures the authenticated user is the one for whom the exam is being created,
    // or you might have admin roles that bypass this.
    if (user.firebase_user_id !== firebaseUserIdFromToken) {
      logger.warn(
        `Forbidden: Firebase user ${firebaseUserIdFromToken} attempted to create exam for user ${user_id} (firebase_user_id: ${user.firebase_user_id}).`,
      );
      res.status(403).json({
        success: false,
        error:
          'Forbidden: You can only create exams for your own user account.',
      });
      return;
    }

    // 3. Verify the certification exists
    const certification = await prismaInstance.certifications.findUnique({
      where: { cert_id: cert_id },
    });

    if (!certification) {
      res.status(404).json({
        success: false,
        error: `Certification with ID: ${cert_id} not found.`,
      });
      return;
    }

    // 4. Fetch quiz questions for the target certification
    const questions = await prismaInstance.quizQuestions.findMany({
      where: { cert_id: cert_id },
      take: numberOfQuestions,
      select: { quiz_question_id: true },
      // Add orderBy if you want consistent question selection, e.g., by ID or a random seed if supported
      // orderBy: { quiz_question_id: 'asc' }
    });

    if (questions.length === 0) {
      res.status(400).json({
        success: false,
        error: `No quiz questions found for cert ID: ${cert_id}. Cannot create exam.`,
      });
      return;
    }

    if (questions.length < numberOfQuestions) {
      logger.warn(
        `Fetched only ${questions.length} questions for cert ID: ${cert_id} (requested ${numberOfQuestions}). Exam for user ${user.user_id} will be created with these available questions.`,
      );
    }

    // 5. Create the exam and link answers
    const newExam = await prismaInstance.exams.create({
      data: {
        user: {
          connect: { user_id: user.user_id },
        },
        certification: {
          connect: { cert_id: cert_id },
        },
        // score and submitted_at will be null/default initially
        answers: {
          create: questions.map((question) => ({
            quizQuestion: {
              connect: { quiz_question_id: question.quiz_question_id },
            },
            // selected_option_id and is_correct will be null initially
          })),
        },
      },
      include: {
        // Include answers and their questions for the response
        answers: {
          select: {
            user_answer_id: true,
            quiz_question_id: true,
          },
        },
      },
    });

    logger.info(
      `Successfully created exam ID: ${newExam.exam_id} for user ${user.user_id} with ${questions.length} questions.`,
    );

    res.status(201).json({
      success: true,
      message: 'Exam created successfully.',
      data: newExam,
    });
  } catch (error) {
    logger.error('Error in createExamForUser handler:', error as any);
    if (
      error instanceof Error &&
      error.message.includes('Foreign key constraint failed')
    ) {
      res.status(400).json({
        success: false,
        error: 'Invalid user_id or cert_id provided.',
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
