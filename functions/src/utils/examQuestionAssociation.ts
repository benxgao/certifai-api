import logger from '../services/firebase/logger';
import prismaInstance, { ExamStatus } from '../services/prisma';

export interface QuestionAssociationOptions {
  exam_id: string;
  cert_id: number;
  targetQuestionCount?: number;
  existingQuestionIds?: Set<string>;
}

export interface QuestionAssociationResult {
  success: boolean;
  associatedQuestionCount: number;
  selectedQuestionIds: string[];
  certification: {
    cert_id: number;
    name: string;
    min_quiz_counts: number;
    max_quiz_counts: number;
  } | null;
  error?: string;
}

/**
 * Associates quiz questions with an exam using intelligent selection logic.
 * This function implements the same logic used across take.ts, updateExam.ts, and getExamQuestions.ts
 */
export async function associateQuestionsWithExam(
  options: QuestionAssociationOptions,
): Promise<QuestionAssociationResult> {
  const {
    exam_id,
    cert_id,
    targetQuestionCount,
    existingQuestionIds = new Set(),
  } = options;

  try {
    logger.info(
      `associateQuestionsWithExam: Starting for exam_id: ${exam_id}, cert_id: ${cert_id}`,
    );

    // Get certification details to respect min/max quiz counts
    const certification = await prismaInstance.certification.findUnique({
      where: { cert_id },
      select: {
        cert_id: true,
        name: true,
        min_quiz_counts: true,
        max_quiz_counts: true,
      },
    });

    if (!certification) {
      return {
        success: false,
        associatedQuestionCount: 0,
        selectedQuestionIds: [],
        certification: null,
        error: `Certification with id ${cert_id} not found`,
      };
    }

    // First, get questions generated specifically for this exam
    const examGeneratedQuestions = await prismaInstance.quizQuestion.findMany({
      where: {
        cert_id,
        generated_from: exam_id,
        is_deprecated: false,
      },
      include: {
        answerOptions: true,
      },
    });

    // Then, get other available questions from the same certification
    const certificationQuestions = await prismaInstance.quizQuestion.findMany({
      where: {
        cert_id,
        is_deprecated: false,
        NOT: {
          quiz_question_id: {
            in: [...existingQuestionIds],
          },
        },
      },
      include: {
        answerOptions: true,
      },
    });

    logger.info(
      `associateQuestionsWithExam: Found ${examGeneratedQuestions.length} exam-specific questions ` +
        `and ${certificationQuestions.length} total available questions for certification ${cert_id}`,
    );

    // Combine questions, prioritizing exam-specific ones
    const availableQuestions = [
      ...examGeneratedQuestions.filter(
        (question) => !existingQuestionIds.has(question.quiz_question_id),
      ),
      ...certificationQuestions.filter(
        (question) =>
          !existingQuestionIds.has(question.quiz_question_id) &&
          question.generated_from !== exam_id, // Avoid duplicates from exam-specific questions
      ),
    ];

    // Determine how many questions to select for the exam
    // Priority: provided targetQuestionCount -> certification max -> available questions -> default
    let finalTargetCount = targetQuestionCount;

    if (!finalTargetCount) {
      finalTargetCount = Math.min(
        certification.max_quiz_counts,
        availableQuestions.length,
        50, // Default max questions per exam
      );
    }

    // Ensure we have at least the minimum required questions
    if (availableQuestions.length < certification.min_quiz_counts) {
      logger.warn(
        `associateQuestionsWithExam: Insufficient questions available for certification ${certification.name}. ` +
          `Available: ${availableQuestions.length}, Required minimum: ${certification.min_quiz_counts}`,
      );
    }

    // Select questions for the exam
    const selectedQuestions = availableQuestions
      .slice(0, finalTargetCount)
      .map((question) => question.quiz_question_id);

    if (selectedQuestions.length === 0) {
      logger.warn(
        `associateQuestionsWithExam: No questions available for exam ${exam_id} (certification: ${certification.name})`,
      );

      return {
        success: false,
        associatedQuestionCount: 0,
        selectedQuestionIds: [],
        certification,
        error: `No questions available for certification ${certification.name}`,
      };
    }

    // Create ExamUserAnswer entries for selected questions
    const examUserAnswers = selectedQuestions.map((questionId) => ({
      exam_id,
      quiz_question_id: questionId,
      selected_option_id: null,
      is_correct: null,
    }));

    await prismaInstance.examUserAnswer.createMany({
      data: examUserAnswers,
      skipDuplicates: true,
    });

    logger.info(
      `associateQuestionsWithExam: Successfully associated ${selectedQuestions.length} questions with exam ${exam_id} ` +
        `(certification: ${certification.name}, min: ${certification.min_quiz_counts}, max: ${certification.max_quiz_counts})`,
    );

    return {
      success: true,
      associatedQuestionCount: selectedQuestions.length,
      selectedQuestionIds: selectedQuestions,
      certification,
    };
  } catch (error) {
    logger.error(
      `associateQuestionsWithExam: Error associating questions with exam ${exam_id}:`,
      error as any,
    );

    return {
      success: false,
      associatedQuestionCount: 0,
      selectedQuestionIds: [],
      certification: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Updates an exam's status and total_questions count based on question association results
 */
export async function updateExamAfterQuestionAssociation(
  exam_id: string,
  associationResult: QuestionAssociationResult,
): Promise<void> {
  try {
    const examStatus =
      associationResult.success && associationResult.associatedQuestionCount > 0
        ? ExamStatus.READY
        : ExamStatus.QUESTION_GENERATION_FAILED;

    await prismaInstance.examAttempt.update({
      where: { exam_id },
      data: {
        exam_status: examStatus,
        total_questions: associationResult.associatedQuestionCount,
      },
    });

    logger.info(
      `updateExamAfterQuestionAssociation: Updated exam ${exam_id} status to ${examStatus} ` +
        `with ${associationResult.associatedQuestionCount} questions`,
    );
  } catch (error) {
    logger.error(
      `updateExamAfterQuestionAssociation: Error updating exam ${exam_id}:`,
      error as any,
    );
    throw error;
  }
}
