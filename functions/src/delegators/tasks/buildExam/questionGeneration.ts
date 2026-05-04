import logger from '../../../services/firebase/logger';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import { QuizItem } from '../../../types/genkit';
import {
  TaskPayload,
  ExamTopicItem,
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
): Promise<QuizItem[]> => {
  const {
    exam_id,
    batch_number,
    certification_name,
    custom_prompt_text,
    last_exam_report,
  } = payload;

  logger.info(`EXAM_BATCH_QUESTION_GENERATOR_START: exam_id=${exam_id}, batch=${batch_number}
    | task_payload: ${JSON.stringify(payload)}`);

  // Log AI request input details
  logger.info(`DEBUG_AI_REQUEST_INPUT: exam_id=${exam_id}, batch=${batch_number}`, {
    exam_id,
    batch_number,
    topics_count: topicNamesForGeneration.length,
    topics_first_5: topicNamesForGeneration.slice(0, 5),
    questions_requested: questions_to_generate,
    has_custom_prompt: !!custom_prompt_text,
    custom_prompt_length: custom_prompt_text?.length || 0,
    has_last_exam_report: !!last_exam_report,
    certification_name,
    structuredData: true,
  });

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
  let generatedQuestions: QuizItem[];
  try {
    logger.info(`DEBUG_IMPORTING_QUIZ_GENERATOR: exam_id=${exam_id}, batch=${batch_number}`, {
      exam_id,
      batch_number,
      import_start: Date.now(),
      structuredData: true,
    });

    const { quizGeneratorPromise } = await import(
      '../../../services/genkit/quizGenerator.js'
    );
    const quizGenerator = await quizGeneratorPromise;

    logger.info(`DEBUG_QUIZ_GENERATOR_IMPORTED: exam_id=${exam_id}, batch=${batch_number}`, {
      exam_id,
      batch_number,
      generator_type: typeof quizGenerator,
      import_duration_ms: Date.now() - aiStartTime,
      structuredData: true,
    });

    logger.info(`DEBUG_AI_CALL_START: exam_id=${exam_id}, batch=${batch_number}`, {
      exam_id,
      batch_number,
      ai_call_timestamp: Date.now(),
      request_topics: topicNamesForGeneration.length,
      structuredData: true,
    });

    generatedQuestions = await quizGenerator({
      // Use only unassigned topics for generation
      subject: certification_name,
      examTopicList: topicNamesForGeneration,
      exam_id,
      customPromptText: custom_prompt_text,
      lastExamReport: last_exam_report,
    });

    logger.info(`DEBUG_AI_CALL_SUCCESS: exam_id=${exam_id}, batch=${batch_number}`, {
      exam_id,
      batch_number,
      response_received: Date.now(),
      questions_in_response: generatedQuestions?.length || 0,
      response_type: typeof generatedQuestions,
      is_array: Array.isArray(generatedQuestions),
      structuredData: true,
    });
  } catch (flowError) {
    const aiDuration = Date.now() - aiStartTime;
    const errorMessage =
      flowError instanceof Error ? flowError.message : String(flowError);
    const errorStack = flowError instanceof Error ? flowError.stack : undefined;

    logger.error(
      `EXAM_BATCH_QUESTION_GENERATOR_ERROR: exam_id=${exam_id}, batch=${batch_number}`,
      {
        error: errorMessage,
        error_stack: errorStack,
        error_name: flowError instanceof Error ? flowError.name : typeof flowError,
        duration_ms: aiDuration,
        exam_id,
        batch_number,
        topics_requested: topicNamesForGeneration.length,
        questions_requested: questions_to_generate,
        structuredData: true,
      },
    );
    throw new Error(
      `Failed to generate questions for batch ${batch_number}: ${errorMessage}`,
    );
  }

  const aiDuration = Date.now() - aiStartTime;

  // Log AI response with detailed metrics
  logger.info(`DEBUG_AI_RESPONSE_PARSING: exam_id=${exam_id}, batch=${batch_number}`, {
    exam_id,
    batch_number,
    response_count: generatedQuestions?.length || 0,
    response_is_array: Array.isArray(generatedQuestions),
    first_question_has_examTopic: generatedQuestions?.[0]?.examTopic !== undefined,
    first_question_has_question: generatedQuestions?.[0]?.question !== undefined,
    first_question_has_choices: generatedQuestions?.[0]?.choices !== undefined,
    first_question_topic_preview: generatedQuestions?.[0]?.examTopic?.substring(0, 50),
    duration_ms: aiDuration,
    structuredData: true,
  });

  // Log AI response
  ExamGenerationLogger.logAIResponse({
    exam_id,
    batch_number,
    ai_service: 'gemini-2.5-flash',
    questions_generated: generatedQuestions?.length || 0,
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
  generatedQuestions: QuizItem[],
  topicsForThisBatch: ExamTopicItem[],
  exam_id: string,
  batch_number: number,
): {
  validQuestionResults: Array<{ question: QuizItem; matchingTopic: ExamTopicItem | null; index: number; isValid: boolean; errors: string[] }>;
  invalidQuestionResults: Array<{ question: QuizItem; matchingTopic: ExamTopicItem | null; index: number; isValid: boolean; errors: string[] }>;
  validQuestions: QuizItem[];
} => {
  logger.info(`DEBUG_VALIDATION_START: exam_id=${exam_id}, batch=${batch_number}`, {
    exam_id,
    batch_number,
    questions_to_validate: generatedQuestions?.length || 0,
    batch_topics_count: topicsForThisBatch?.length || 0,
    structuredData: true,
  });

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
    topics_count: examTopics.length,
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

    // Log individual question validation details
    if (validationErrors.length > 0) {
      logger.info(`DEBUG_QUESTION_VALIDATION_ERROR: exam_id=${exam_id}, batch=${batch_number}`, {
        exam_id,
        batch_number,
        question_index: index,
        exam_topic: question.examTopic?.substring(0, 50) || 'MISSING',
        has_question_text: !!question.question,
        has_choices: !!question.choices && Array.isArray(question.choices),
        choices_count: question.choices?.length || 0,
        answer_index: question.answerIndex,
        validation_errors: validationErrors,
        structuredData: true,
      });
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

  // Log validation summary with detailed metrics
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

  // Log detailed validation result summary
  logger.info(`DEBUG_VALIDATION_SUMMARY: exam_id=${exam_id}, batch=${batch_number}`, {
    exam_id,
    batch_number,
    total_questions_validated: generatedQuestions.length,
    passed_validation: validQuestionResults.length,
    failed_validation: invalidQuestionResults.length,
    pass_rate_percent: generatedQuestions.length > 0 ? Math.round(
      (validQuestionResults.length / generatedQuestions.length) * 100,
    ) : 0,
    structuredData: true,
  });

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
