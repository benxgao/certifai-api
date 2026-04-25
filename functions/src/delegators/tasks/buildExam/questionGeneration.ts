import logger from '../../../services/firebase/logger';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import {
  TaskPayload,
  normalizeExamTopic,
  findMatchingExamTopic,
} from './helper';

/**
 * Generates questions using AI service
 */
export const generateQuestionsWithAI = async (
  payload: TaskPayload,
  topicNamesForGeneration: string[],
  questions_to_generate: number,
): Promise<any[]> => {
  const {
    exam_id,
    batch_number,
    certification_name,
    custom_prompt_text,
    last_exam_report,
  } = payload;

  logger.info(`EXAM_BATCH_QUESTION_GENERATOR_START: exam_id=${exam_id}, batch=${batch_number}
    | task_payload: ${JSON.stringify(payload)}`);

  // Log AI request start
  ExamGenerationLogger.logAIRequest({
    exam_id,
    batch_number,
    ai_service: 'gemini-2.5-flash',
    certification_name,
    questions_requested: questions_to_generate,
  });

  const aiStartTime = Date.now();

  // Generate questions using the quiz generator
  let generatedQuestions: any;
  try {
    const { quizGeneratorPromise } = await import(
      '../../../services/genkit/quizGenerator.js'
    );
    const quizGenerator = await quizGeneratorPromise;
    generatedQuestions = await quizGenerator({
      // Use only unassigned topics for generation
      subject: certification_name,
      examTopicList: topicNamesForGeneration,
      exam_id,
      customPromptText: custom_prompt_text,
      lastExamReport: last_exam_report,
    });
  } catch (flowError) {
    const aiDuration = Date.now() - aiStartTime;
    const errorMessage =
      flowError instanceof Error ? flowError.message : String(flowError);
    logger.error(
      `EXAM_BATCH_QUESTION_GENERATOR_ERROR: exam_id=${exam_id}, batch=${batch_number}`,
      {
        error: errorMessage,
        duration_ms: aiDuration,
        exam_id,
        batch_number,
      },
    );
    throw new Error(
      `Failed to generate questions for batch ${batch_number}: ${errorMessage}`,
    );
  }

  const aiDuration = Date.now() - aiStartTime;

  // Log AI response
  ExamGenerationLogger.logAIResponse({
    exam_id,
    batch_number,
    ai_service: 'gemini-2.5-flash',
    questions_generated: generatedQuestions.length,
    duration_ms: aiDuration,
    success: true,
  });

  logger.info(
    `EXAM_BATCH_SUCCESS: exam_id=${exam_id}, batch=${batch_number}, generated=${generatedQuestions.length}`,
  );

  return generatedQuestions;
};

/**
 * Validates generated questions and returns valid/invalid results
 */
export const validateGeneratedQuestions = (
  generatedQuestions: any[],
  topicsForThisBatch: any[],
  exam_id: string,
  batch_number: number,
): {
  validQuestionResults: any[];
  invalidQuestionResults: any[];
  validQuestions: any[];
} => {
  // Log examTopic values for debugging with improved matching info
  const examTopics = generatedQuestions
    .map((q, index) => ({
      generated: q.examTopic,
      normalized: normalizeExamTopic(q.examTopic || ''),
      index,
    }))
    .filter((t) => t.generated);

  logger.info(`Generated examTopics with matching analysis:`, {
    exam_id,
    batch_number,
    topics: examTopics,
    available_rtdb_topics: topicsForThisBatch.map((t) => ({
      original: t.exam_topic,
      normalized: normalizeExamTopic(t.exam_topic),
    })),
    structuredData: true,
  });

  // Enhanced validation for questions with strict filtering
  const validationResults = generatedQuestions.map((question, index) => {
    const validationErrors: string[] = [];

    // Check for required fields
    if (!question.examTopic || question.examTopic.trim() === '') {
      validationErrors.push('Missing or empty examTopic');
    }

    if (!question.question || question.question.trim() === '') {
      validationErrors.push('Missing or empty question text');
    }

    if (
      !question.choices ||
      !Array.isArray(question.choices) ||
      question.choices.length === 0
    ) {
      validationErrors.push('Missing or invalid choices array');
    }

    if (
      typeof question.answerIndex !== 'number' ||
      question.answerIndex < 0 ||
      question.answerIndex >= (question.choices?.length || 0)
    ) {
      validationErrors.push(`Invalid answerIndex: ${question.answerIndex}`);
    }

    // CRITICAL FIX: Check if we can find a matching topic for this question
    // ONLY within the topics assigned to this batch to prevent cross-batch assignment
    let matchingTopic = null;
    if (question.examTopic && question.examTopic.trim() !== '') {
      matchingTopic = findMatchingExamTopic(
        question.examTopic,
        topicsForThisBatch, // Use only current batch topics, not all topics
      );
      if (!matchingTopic) {
        validationErrors.push(
          `No matching exam topic found for "${question.examTopic}" in current batch topics`,
        );
      }
    }

    return {
      question,
      index,
      isValid: validationErrors.length === 0,
      errors: validationErrors,
      matchingTopic,
    };
  });

  // Separate valid and invalid questions
  const validQuestionResults = validationResults.filter(
    (result) => result.isValid,
  );
  const invalidQuestionResults = validationResults.filter(
    (result) => !result.isValid,
  );

  // Log validation summary
  logger.info(
    `QUESTION_VALIDATION_SUMMARY: exam_id=${exam_id}, batch=${batch_number}`,
    {
      exam_id,
      batch_number,
      total_generated: generatedQuestions.length,
      valid_questions: validQuestionResults.length,
      invalid_questions: invalidQuestionResults.length,
      validation_success_rate: Math.round(
        (validQuestionResults.length / generatedQuestions.length) * 100,
      ),
      structuredData: true,
    },
  );

  // Log details for invalid questions
  invalidQuestionResults.forEach((result) => {
    logger.warn(`INVALID_QUESTION: Skipping question ${result.index + 1}`, {
      exam_id,
      batch_number,
      question_index: result.index,
      exam_topic: result.question.examTopic,
      errors: result.errors,
      question_preview: result.question.question?.substring(0, 100),
      choices_count: result.question.choices?.length || 0,
      answer_index: result.question.answerIndex,
      structuredData: true,
    });
  });

  // Extract only the valid questions for processing
  const validQuestions = validQuestionResults.map((result) => result.question);

  return {
    validQuestionResults,
    invalidQuestionResults,
    validQuestions,
  };
};
