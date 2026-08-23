import { Request, Response } from 'express';
import logger from '../../../services/firebase/logger';
import prismaInstance, { ExamStatus } from '../../../services/prisma';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import { ExamGenerationMetrics } from '../../../services/exam-generation-metrics';
import { CacheManager } from '../../../services/cache';
import { TaskPayload } from './helper';
import { DEFAULT_GENAI_MODEL } from '../../../services/genkit/utils';
import { getExamTopicsFromRtdb } from './rtdb';
import {
  handleCorruptedExamPlan,
  prepareBatchTopics,
  validateExamState,
} from './examValidation';
import {
  generateQuestionsWithAI,
  validateGeneratedQuestions,
} from './questionGeneration';
import { storeQuestionsInDatabase } from './databaseOperations';
import { handleExamCompletionOrNextBatch } from './examCompletion';
import {
  classifyExamGenerationError,
  logClassifiedExamError,
} from './errorClassifier';

const handler = async (req: Request, res: Response) => {
  let batchMetrics: {
    start_time: number;
    initial_memory: NodeJS.MemoryUsage;
  } | null = null;

  let payload: TaskPayload | null = null;

  try {
    payload = req.body;

    if (!payload || !payload.exam_id) {
      logger.error('Invalid or missing payload in task request', {
        payload_exists: !!payload,
        has_exam_id: !!(payload && payload.exam_id),
        structuredData: true,
      });
      res.status(400).json({
        success: false,
        error: 'Invalid or missing payload',
      });
      return;
    }

    const {
      exam_id,
      cert_id,
      batch_number,
      total_batches,
      questions_per_batch,
    } = payload;

    // Get the most up-to-date topic list from RTDB (with question assignments)
    let examTopicList = await getExamTopicsFromRtdb(exam_id);

    // CRITICAL FIX: Detect and handle corrupted exam plans where all topics have question_ids on first batch
    examTopicList = await handleCorruptedExamPlan(
      examTopicList,
      exam_id,
      batch_number,
    );

    const {
      topicsForThisBatch,
      topicNamesForGeneration,
      questions_to_generate,
    } = await prepareBatchTopics(examTopicList, payload);

    // Start structured logging for this batch
    batchMetrics = ExamGenerationLogger.logBatchStart({
      exam_id,
      batch_number,
      total_batches,
      questions_to_generate,
      cert_id,
    });

    logger.info(`EXAM_TRACK - 18. EXAM_BATCH_PROCESS:
      exam_id=${exam_id}
      batch=${batch_number}/${total_batches}
      questions=${questions_to_generate}
      topics=${topicNamesForGeneration.join(', ')}
      batch_size_limit=${questions_per_batch}
    `);

    // Validate that examTopicList is not negative (invalid state)
    if (questions_to_generate < 0) {
      logger.error(
        `Invalid question count: ${questions_to_generate} for exam ${exam_id}, batch ${batch_number}`,
      );
      res.status(400).json({
        success: false,
        error: `Invalid question count: ${questions_to_generate}. Must be non-negative.`,
      });
      return;
    }

    // Skip processing if no topics to generate questions for (valid scenario - all topics already have questions)
    if (questions_to_generate === 0) {
      // [CHECKPOINT-2] Batch Processing - All Topics Already Have Questions
      logger.info(`[CHECKPOINT-2] BATCH_START_SKIPPED_ALL_TOPICS_PROCESSED`, {
        exam_id,
        batch_number,
        total_batches,
        reason: 'all_topics_already_have_questions',
        topics_with_questions: examTopicList.filter((t) => t.question_id !== null).length,
        topics_without_questions: 0,
        timestamp_ms: Date.now(),
        structuredData: true,
      });
      // Enhanced logging to help debug why all topics are assigned
      const topicsDebugInfo = examTopicList.map((topic, index) => ({
        index,
        exam_topic:
          topic.exam_topic.substring(0, 40) +
          (topic.exam_topic.length > 40 ? '...' : ''),
        question_id: topic.question_id,
        has_question: topic.question_id !== null,
      }));

      logger.info(
        `No unassigned topics for exam ${exam_id}, batch ${batch_number}. All ${examTopicList.length} topics already have questions assigned. Marking batch as complete.`,
        {
          exam_id,
          batch_number,
          total_batches,
          total_topics: examTopicList.length,
          assigned_topics: examTopicList.filter((t) => t.question_id !== null)
            .length,
          unassigned_topics: 0,
          topics_debug: topicsDebugInfo,
          structuredData: true,
        },
      );

      res.status(200).json({
        success: true,
        message: `Batch ${batch_number} completed - all topics already have questions assigned`,
        data: {
          exam_id,
          batch_number,
          total_batches,
          questions_generated: 0,
          questions_associated: 0,
          is_final_batch: batch_number >= total_batches,
          reason: 'all_topics_already_assigned',
        },
      });
      return;
    }

    // Verify exam exists and is in the correct state
    const exam = await validateExamState(exam_id);

    try {
      // [CHECKPOINT-2] Batch Processing - Start
      const batchStartTime = Date.now();
      logger.info(`[CHECKPOINT-2] BATCH_START`, {
        exam_id,
        batch_number,
        total_batches,
        topics_to_process: questions_to_generate,
        topic_names: topicNamesForGeneration.slice(0, 5), // First 5 for brevity
        timestamp_ms: batchStartTime,
        structuredData: true,
      });

      // Generate questions using AI service
      const generatedQuestions = await generateQuestionsWithAI(
        payload,
        topicNamesForGeneration,
        questions_to_generate,
      );

      // [CHECKPOINT-3] Questions Generated
      logger.info(`[CHECKPOINT-3] BATCH_QUESTIONS_GENERATED`, {
        exam_id,
        batch_number,
        total_questions_generated: generatedQuestions.length,
        generation_duration_ms: Date.now() - batchStartTime,
        timestamp_ms: Date.now(),
        structuredData: true,
      });

      // Validate generated questions
      const { validQuestionResults, invalidQuestionResults, validQuestions } =
        validateGeneratedQuestions(
          generatedQuestions,
          topicsForThisBatch,
          exam_id,
          batch_number,
        );

      if (validQuestions.length === 0) {
        logger.warn(
          `No valid questions to store for exam ${exam_id}, batch ${batch_number}. All ${generatedQuestions.length} generated questions failed validation.`,
          {
            exam_id,
            batch_number,
            total_generated: generatedQuestions.length,
            validation_failures: invalidQuestionResults.map((result) => ({
              topic: result.question.examTopic,
              errors: result.errors,
            })),
            structuredData: true,
          },
        );

        // Even if no questions are valid, we should continue to next batch
        // since topics remain available (question_id === null)
        logger.info(
          `Skipping database operations for batch ${batch_number} due to no valid questions, but continuing to next batch`,
          {
            exam_id,
            batch_number,
            available_topics: examTopicList.filter(
              (t) => t.question_id === null,
            ).length,
            structuredData: true,
          },
        );
      } else {
        // Store questions in database and update RTDB
        examTopicList = await storeQuestionsInDatabase(
          validQuestions,
          validQuestionResults,
          examTopicList,
          payload,
        );
      }

      // Handle exam completion or create next batch
      await handleExamCompletionOrNextBatch(
        examTopicList,
        payload,
        generatedQuestions,
        validQuestions,
        invalidQuestionResults,
        exam,
        res,
      );

      // Log successful batch completion with metrics
      if (batchMetrics) {
        ExamGenerationLogger.logBatchComplete({
          exam_id,
          batch_number,
          total_batches,
          questions_generated: generatedQuestions.length,
          questions_stored: validQuestions.length,
          start_time: batchMetrics.start_time,
          initial_memory: batchMetrics.initial_memory,
          success: true,
        });

        // Record metrics for monitoring
        const finalMemory = process.memoryUsage();
        ExamGenerationMetrics.recordBatchOperation({
          exam_id,
          batch_number,
          success: true,
          duration_ms: Date.now() - batchMetrics.start_time,
          memory_used_mb: finalMemory.heapUsed / 1024 / 1024,
        });
      }
    } catch (generationError) {
      // Log AI service failure if it was during AI generation
      ExamGenerationLogger.logAIResponse({
        exam_id,
        batch_number,
        ai_service: DEFAULT_GENAI_MODEL,
        questions_generated: 0,
        duration_ms: 0,
        success: false,
        error:
          generationError instanceof Error
            ? generationError.message
            : 'Unknown AI error',
      });

      // Log batch failure with metrics
      if (batchMetrics) {
        ExamGenerationLogger.logBatchComplete({
          exam_id,
          batch_number,
          total_batches,
          questions_generated: 0,
          questions_stored: 0,
          start_time: batchMetrics.start_time,
          initial_memory: batchMetrics.initial_memory,
          success: false,
          error:
            generationError instanceof Error
              ? generationError.message
              : 'Unknown error',
        });

        // Record failed batch metrics
        const finalMemory = process.memoryUsage();
        ExamGenerationMetrics.recordBatchOperation({
          exam_id,
          batch_number,
          success: false,
          duration_ms: Date.now() - batchMetrics.start_time,
          memory_used_mb: finalMemory.heapUsed / 1024 / 1024,
        });
      }

      logger.error(
        `Error generating questions for exam ${exam_id}, batch ${batch_number}:`,
        { error: generationError instanceof Error ? generationError.message : String(generationError) },
      );

      // Classify the error to understand what went wrong
      const classifiedError = classifyExamGenerationError(
        generationError,
        {
          exam_id,
          batch_number,
          lastSuccessfulStep: 'batch_start',
        }
      );

      // Log the classified error with full context
      logClassifiedExamError(classifiedError);

      logger.error(`EXAM_GENERATION_ERROR_FULL_CONTEXT: exam_id=${exam_id}, batch=${batch_number}`, {
        exam_id,
        batch_number,
        error_classification: classifiedError.classification,
        error_message: classifiedError.errorMessage,
        recovery_hint: classifiedError.recoveryHint,
        last_successful_step: classifiedError.errorData.lastSuccessfulStep,
        timestamp: classifiedError.errorData.timestamp,
        structuredData: true,
      });

      // Get exam details for cache invalidation
      const examForFailure = await prismaInstance.examAttempt.findUnique({
        where: { exam_id },
        select: { user_id: true },
      });

      // Update exam status to failed with failure reason
      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: {
          exam_status: ExamStatus.QUESTION_GENERATION_FAILED,
          // Store failure reason for later analysis - will be added to schema if needed
          // failure_reason: classifiedError.classification,
        },
      });

      // Invalidate user exam cache when exam generation fails
      if (examForFailure?.user_id) {
        await CacheManager.invalidateUserExamCacheForGenerationChange(
          examForFailure.user_id,
          'exam_generation_failed',
        );
      }

      // [CHECKPOINT-7A] Generation Failed
      logger.info(`[CHECKPOINT-7A] BATCH_FAILED`, {
        exam_id,
        user_id: examForFailure?.user_id,
        batch_number,
        total_batches: payload.total_batches,
        final_status: 'QUESTION_GENERATION_FAILED',
        error_reason: classifiedError.classification,
        error_message: classifiedError.errorMessage,
        recovery_hint: classifiedError.recoveryHint,
        cache_invalidated: true,
        timestamp_ms: Date.now(),
        structuredData: true,
      });

      // Log exam failure
      ExamGenerationLogger.logExamFailure({
        exam_id,
        batch_number,
        total_batches,
        reason: 'question_generation_error',
        error:
          generationError instanceof Error
            ? generationError.message
            : 'Unknown error',
      });

      logger.info(
        `EXAM_GENERATION_FAILED: exam_id=${exam_id}, reason=question_generation_error`,
      );

      res.status(500).json({
        success: false,
        error: 'Failed to generate questions',
      });
    }
  } catch (error) {
    // Enhanced error logging with classification and context
    const exam_id = payload?.exam_id || 'unknown';
    const batch_number = payload?.batch_number || 'unknown';

    const classifiedError = classifyExamGenerationError(
      error,
      {
        exam_id: exam_id as string,
        batch_number: batch_number as number,
        lastSuccessfulStep: 'task_handler_outer_catch',
      }
    );

    logClassifiedExamError(classifiedError);

    logger.error('Error in task handler - outer catch:', {
      error_classification: classifiedError.classification,
      error_message: classifiedError.errorMessage,
      error_stack: classifiedError.stackTrace?.split('\n').slice(0, 5).join(' | '),
      recovery_hint: classifiedError.recoveryHint,
      exam_id,
      batch_number,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      structuredData: true,
    });

    res.status(500).json({
      success: false,
      error: classifiedError.errorMessage || 'Unknown error occurred in exam generation',
    });
  }
};

export default handler;
