import { prisma } from '../prisma';
import logger from '../firebase/logger';

export interface IncorrectAnswerData {
  exam_id: string;
  question_id: string;
  topic: string | null;
  question_text: string;
  correct_answer: string;
  user_selected_answer: string;
  explanation: string | null;
}

/**
 * Fetches all incorrect answers for a specific exam
 */
export const getIncorrectAnswersForExam = async (
  examId: string,
  userId: string,
): Promise<{
  incorrectAnswers: IncorrectAnswerData[];
  examInfo: {
    exam_id: string;
    cert_id: number;
    certification_name: string;
    exam_guide_url: string | null;
    submitted_at: Date | null;
  };
}> => {
  try {
    logger.info(
      `Fetching incorrect answers for exam_id: ${examId}, user_id: ${userId}`,
    );

    // First, get exam info and verify ownership
    const exam = await prisma.examAttempt.findUnique({
      where: { exam_id: examId },
      include: {
        certification: {
          select: {
            cert_id: true,
            name: true,
            exam_guide_url: true,
          },
        },
      },
    });

    if (!exam) {
      throw new Error(`Exam with ID ${examId} not found`);
    }

    if (exam.user_id !== userId) {
      throw new Error(`Exam ${examId} does not belong to user ${userId}`);
    }

    if (!exam.submitted_at) {
      throw new Error(`Exam ${examId} has not been submitted yet`);
    }

    // Get all incorrect answers for this specific exam
    const incorrectAnswers = await prisma.examUserAnswer.findMany({
      where: {
        exam_id: examId,
        is_correct: false, // Only incorrect answers
      },
      include: {
        quizQuestion: {
          select: {
            quiz_question_id: true,
            question_text: true,
            explanations: true,
            exam_topic: true,
            answerOptions: {
              select: {
                option_id: true,
                option_text: true,
                is_correct: true,
              },
            },
          },
        },
        selectedOption: {
          select: {
            option_id: true,
            option_text: true,
          },
        },
      },
      orderBy: {
        quizQuestion: {
          exam_topic: 'asc', // Group by topic
        },
      },
    });

    // Transform the data into the required format
    const incorrectAnswerData: IncorrectAnswerData[] = incorrectAnswers.map(
      (answer) => {
        // Find the correct answer option
        const correctOption = answer.quizQuestion.answerOptions.find(
          (option) => option.is_correct === true,
        );

        return {
          exam_id: examId,
          question_id: answer.quizQuestion.quiz_question_id,
          topic: answer.quizQuestion.exam_topic,
          question_text: answer.quizQuestion.question_text,
          correct_answer: correctOption?.option_text || 'Unknown',
          user_selected_answer:
            answer.selectedOption?.option_text || 'No answer selected',
          explanation: answer.quizQuestion.explanations,
        };
      },
    );

    const examInfo = {
      exam_id: exam.exam_id,
      cert_id: exam.certification.cert_id,
      certification_name: exam.certification.name,
      exam_guide_url: exam.certification.exam_guide_url,
      submitted_at: exam.submitted_at,
    };

    logger.info(
      `Found ${incorrectAnswerData.length} incorrect answers for exam_id: ${examId}`,
      {
        total_incorrect: incorrectAnswerData.length,
        topics_with_errors: [
          ...new Set(
            incorrectAnswerData
              .map((a) => a.topic)
              .filter((topic) => topic !== null),
          ),
        ].length,
        certification: examInfo.certification_name,
      },
    );

    return {
      incorrectAnswers: incorrectAnswerData,
      examInfo,
    };
  } catch (error) {
    logger.error(
      `Error fetching incorrect answers for exam_id: ${examId}, user_id: ${userId}:`,
      { error: error instanceof Error ? error.message : String(error) },
    );
    throw error;
  }
};

/**
 * Get statistics about incorrect answers for a specific exam
 */
export const getIncorrectAnswersStatsForExam = async (
  examId: string,
  userId: string,
): Promise<{
  total_incorrect: number;
  topics_affected: string[];
  exam_info: {
    exam_id: string;
    cert_id: number;
    certification_name: string;
  };
}> => {
  try {
    const { incorrectAnswers, examInfo } = await getIncorrectAnswersForExam(
      examId,
      userId,
    );

    // Get unique topics (excluding null values)
    const topicsAffected = [
      ...new Set(
        incorrectAnswers.map((a) => a.topic).filter((topic) => topic !== null),
      ),
    ] as string[];

    return {
      total_incorrect: incorrectAnswers.length,
      topics_affected: topicsAffected,
      exam_info: {
        exam_id: examInfo.exam_id,
        cert_id: examInfo.cert_id,
        certification_name: examInfo.certification_name,
      },
    };
  } catch (error) {
    logger.error(
      `Error getting incorrect answers stats for exam_id: ${examId}, user_id: ${userId}:`,
      { error: error instanceof Error ? error.message : String(error) },
    );
    throw error;
  }
};
