import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';

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
    const exam = await prismaInstance.exams.findUnique({
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

    const examUserAnswers = await prismaInstance.examUserAnswers.findMany({
      where: { exam_id: exam_id },
      include: {
        quizQuestion: {
          include: {
            answerOptions: true, // Includes all answer options
          },
        },
      },
      skip: skip,
      take: take,
      // Add orderBy if a specific question order is required, e.g.,
      // orderBy: { quizQuestion: { position_in_exam: 'asc' } } // if such a field exists
    });

    const totalQuestions = await prismaInstance.examUserAnswers.count({
      where: { exam_id: exam_id },
    });

    const questions = examUserAnswers.map((eau) => eau.quizQuestion);

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
