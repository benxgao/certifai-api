import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import prismaInstance, { ExamStatus } from '../../../services/prisma';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import { ExamGenerationMetrics } from '../../../services/exam-generation-metrics';
import { CacheManager } from '../../../services/cache';
import { TaskPayload } from './helper';
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

const handler = async (req: any | CustomRequest, res: Response) => {
  let batchMetrics: {
    start_time: number;
    initial_memory: NodeJS.MemoryUsage;
  } | null = null;

  try {
    const payload: TaskPayload = req.body;
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

    logger.info(
      `EXAM_BATCH_PROCESS: exam_id=${exam_id}, batch=${batch_number}/${total_batches}, questions=${questions_to_generate}, topics=${topicNamesForGeneration.join(
        ', ',
      )}, batch_size_limit=${questions_per_batch}`,
    );

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
      // Generate questions using AI service
      const generatedQuestions = await generateQuestionsWithAI(
        payload,
        topicNamesForGeneration,
        questions_to_generate,
      );

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
        ai_service: 'gemini20Flash',
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
        generationError as any,
      );

      // Get exam details for cache invalidation
      const examForFailure = await prismaInstance.examAttempt.findUnique({
        where: { exam_id },
        select: { user_id: true },
      });

      // Update exam status to failed
      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
      });

      // Invalidate user exam cache when exam generation fails
      if (examForFailure?.user_id) {
        await CacheManager.invalidateUserExamCacheForGenerationChange(
          examForFailure.user_id,
          'exam_generation_failed',
        );
      }

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
    logger.error('Error in task handler:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
