import logger from '../services/firebase/logger';
import prismaInstance from '../services/prisma';

/**
 * Validates that a quiz question can be associated with an exam.
 * A question can only be associated with an exam if:
 * 1. The question's generated_from field is null (general question), OR
 * 2. The question's generated_from field equals the exam_id (question was generated for this specific exam)
 */
export async function validateQuestionExamConstraint(
  questionId: string,
  examId: string,
): Promise<{ isValid: boolean; error?: string }> {
  try {
    // Get the question details
    const question = await prismaInstance.quizQuestion.findUnique({
      where: { quiz_question_id: questionId },
      select: { generated_from: true, cert_id: true },
    });

    if (!question) {
      return {
        isValid: false,
        error: `Question with ID ${questionId} not found`,
      };
    }

    // Get the exam details
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id: examId },
      select: { cert_id: true },
    });

    if (!exam) {
      return {
        isValid: false,
        error: `Exam with ID ${examId} not found`,
      };
    }

    // Check if question and exam are for the same certification
    if (question.cert_id !== exam.cert_id) {
      return {
        isValid: false,
        error: `Question (cert_id: ${question.cert_id}) and exam (cert_id: ${exam.cert_id}) are for different certifications`,
      };
    }

    // Check the generated_from constraint
    if (
      question.generated_from !== null &&
      question.generated_from !== examId
    ) {
      return {
        isValid: false,
        error: `Question was generated for exam ${question.generated_from} and cannot be used in exam ${examId}`,
      };
    }

    return { isValid: true };
  } catch (error) {
    logger.error(
      `Error validating question-exam constraint for question ${questionId} and exam ${examId}:`,
      error as any,
    );
    return {
      isValid: false,
      error: 'Internal error during constraint validation',
    };
  }
}

/**
 * Validates multiple questions for association with an exam
 */
export async function validateMultipleQuestionsExamConstraint(
  questionIds: string[],
  examId: string,
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const questionId of questionIds) {
    const result = await validateQuestionExamConstraint(questionId, examId);
    if (!result.isValid) {
      errors.push(`Question ${questionId}: ${result.error}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
