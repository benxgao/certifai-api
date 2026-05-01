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
 * Fetches all incorrect answers for a user across all completed exams for a specific certification
 */
export const getIncorrectAnswersForCertification = async (
  userId: string,
  certId: number,
): Promise<IncorrectAnswerData[]> => {
  try {
    logger.info(
      `Fetching incorrect answers for user_id: ${userId}, cert_id: ${certId}`,
    );

    // Query to get all incorrect answers from completed exams for the certification
    const incorrectAnswers = await prisma.examUserAnswer.findMany({
      where: {
        is_correct: false, // Only incorrect answers
        examAttempt: {
          user_id: userId,
          cert_id: certId,
          submitted_at: {
            not: null, // Only from submitted/completed exams
          },
        },
      },
      include: {
        examAttempt: {
          select: {
            exam_id: true,
            cert_id: true,
            submitted_at: true,
          },
        },
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
      orderBy: [
        {
          examAttempt: {
            submitted_at: 'desc', // Most recent exams first
          },
        },
        {
          quizQuestion: {
            exam_topic: 'asc', // Group by topic
          },
        },
      ],
    });

    // Transform the data into the required format
    const incorrectAnswerData: IncorrectAnswerData[] = incorrectAnswers.map(
      (answer) => {
        // Find the correct answer option
        const correctOption = answer.quizQuestion.answerOptions.find(
          (option) => option.is_correct === true,
        );

        return {
          exam_id: answer.examAttempt.exam_id,
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

    logger.info(
      `Found ${incorrectAnswerData.length} incorrect answers for user_id: ${userId}, cert_id: ${certId}`,
      {
        total_incorrect: incorrectAnswerData.length,
        topics_with_errors: [
          ...new Set(
            incorrectAnswerData
              .map((a) => a.topic)
              .filter((topic) => topic !== null),
          ),
        ].length,
      },
    );

    return incorrectAnswerData;
  } catch (error) {
    logger.error(
      `Error fetching incorrect answers for user_id: ${userId}, cert_id: ${certId}:`,
      { error: error instanceof Error ? error.message : String(error) },
    );
    throw error;
  }
};

/**
 * Get statistics about incorrect answers for a user and certification
 */
export const getIncorrectAnswersStats = async (
  userId: string,
  certId: number,
): Promise<{
  total_incorrect: number;
  topics_affected: string[];
  recent_exams_count: number;
}> => {
  try {
    const incorrectAnswers = await getIncorrectAnswersForCertification(
      userId,
      certId,
    );

    // Get unique topics (excluding null values)
    const topicsAffected = [
      ...new Set(
        incorrectAnswers.map((a) => a.topic).filter((topic) => topic !== null),
      ),
    ] as string[];

    // Get count of recent exams (unique exam IDs)
    const recentExamsCount = new Set(incorrectAnswers.map((a) => a.exam_id))
      .size;

    return {
      total_incorrect: incorrectAnswers.length,
      topics_affected: topicsAffected,
      recent_exams_count: recentExamsCount,
    };
  } catch (error) {
    logger.error(
      `Error getting incorrect answers stats for user_id: ${userId}, cert_id: ${certId}:`,
      { error: error instanceof Error ? error.message : String(error) },
    );
    throw error;
  }
};
