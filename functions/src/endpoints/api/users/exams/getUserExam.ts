import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id, exam_id } = req.params;

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

    logger.info(`Fetching exam ${exam_id} for user_id: ${user_id}`);

    const examFromDb = await prismaInstance.examAttempt.findFirst({
      where: {
        exam_id: exam_id,
        user_id: user_id,
      },
      include: {
        certification: {
          select: {
            cert_id: true,
            name: true,
            exam_guide_url: true,
            min_quiz_counts: true,
            max_quiz_counts: true,
            pass_score: true,
          },
        }, // Include comprehensive certification details
        answers: {
          include: {
            quizQuestion: {
              include: {
                answerOptions: true,
              },
            },
            selectedOption: true,
          },
        },
      },
    });

    if (!examFromDb) {
      res.status(404).json({
        success: false,
        error: 'Exam not found for this user.',
      });
      return;
    }

    // Calculate exam status
    let status = 'IN_PROGRESS';
    if (examFromDb.submitted_at) {
      if (
        examFromDb.score !== null &&
        examFromDb.certification?.pass_score !== undefined
      ) {
        status =
          examFromDb.score >= examFromDb.certification.pass_score
            ? 'PASSED'
            : 'FAILED';
      } else {
        status = 'COMPLETED'; // Submitted but score or pass_score is not available
      }
    }

    // Calculate additional exam metrics
    const totalQuestions = examFromDb.answers?.length || 0;
    const answeredQuestions =
      examFromDb.answers?.filter((answer) => answer.selected_option_id !== null)
        .length || 0;
    const correctAnswers =
      examFromDb.answers?.filter((answer) => answer.is_correct === true)
        .length || 0;

    const cert = {
      cert_id: examFromDb.certification.cert_id,
      name: examFromDb.certification.name,
      exam_guide_url: examFromDb.certification.exam_guide_url,
      min_quiz_counts: examFromDb.certification.min_quiz_counts,
      max_quiz_counts: examFromDb.certification.max_quiz_counts,
      pass_score: examFromDb.certification.pass_score,
      // Add status indicators for the user's performance
      performance: {
        is_passing:
          examFromDb.score !== null
            ? examFromDb.score >= examFromDb.certification.pass_score
            : null,
        score_needed_to_pass: examFromDb.certification.pass_score,
        current_score: examFromDb.score,
      },
    };

    const exam = {
      exam_id: examFromDb.exam_id,
      user_id: examFromDb.user_id,
      cert_id: examFromDb.cert_id,
      exam_status: examFromDb.exam_status,
      total_questions: examFromDb.total_questions,
      score: examFromDb.score,
      token_cost: examFromDb.token_cost,
      started_at: examFromDb.started_at,
      submitted_at: examFromDb.submitted_at,
      status,
      // Enhanced exam metrics
      progress: {
        total_questions: totalQuestions,
        answered_questions: answeredQuestions,
        correct_answers: correctAnswers,
        completion_percentage:
          totalQuestions > 0
            ? Math.round((answeredQuestions / totalQuestions) * 100)
            : 0,
      },
      // Comprehensive certification details
      certification: examFromDb.certification ? cert : null,
      // Include answers if needed (for debugging or detailed view)
      answers: examFromDb.answers,
    };

    res.status(200).json({
      success: true,
      data: exam,
    });
  } catch (error) {
    logger.error('Error in getUserExam handler:', error as any);
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
