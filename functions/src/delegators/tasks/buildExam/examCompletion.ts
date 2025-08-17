import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import prismaInstance, { ExamStatus } from '../../../services/prisma';
import { createCloudTask } from '../../../services/gcp/cloudTasks';
import {
  associateQuestionsWithExam,
  updateExamAfterQuestionAssociation,
} from '../../../utils/examQuestionAssociation';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import { CacheManager } from '../../../services/cache';
import { deleteRtdbValue } from '../../../services/firebase/rtdb';
import { TaskPayload, logQuestionTopicAssociationSummary } from './helper';
import {
  checkExamProcessingTimeout,
  calculateAndLogExamGenerationTime,
  updateExamGenerationProgress,
} from './rtdb';
import { validateExamQueueReadiness } from '../../../utils/examQueueManager';

/**
 * Determines whether exam should be completed and handles completion or next batch creation
 */
export const handleExamCompletionOrNextBatch = async (
  examTopicList: any[],
  payload: TaskPayload,
  generatedQuestions: any[],
  validQuestions: any[],
  invalidQuestionResults: any[],
  exam: any,
  res: Response,
): Promise<void> => {
  const { exam_id, batch_number, total_batches, cert_id, questions_per_batch } =
    payload;

  // Check if this is the last batch or if we should complete early
  let associationResult = null;

  // Calculate questions successfully processed in this batch
  const questionsProcessedThisBatch = validQuestions.length;
  const questionsFailedThisBatch = invalidQuestionResults.length;

  // Calculate total questions generated so far - use actual processed count instead of theoretical
  // This ensures we don't count failed validations against our progress
  const actualQuestionsGenerated = examTopicList.filter(
    (t) => t.question_id !== null,
  ).length;

  logger.info(
    `BATCH_COMPLETION_ANALYSIS: exam_id=${exam_id}, batch=${batch_number}`,
    {
      exam_id,
      batch_number,
      questions_processed_this_batch: questionsProcessedThisBatch,
      questions_failed_this_batch: questionsFailedThisBatch,
      actual_questions_generated_total: actualQuestionsGenerated,
      topics_assigned: examTopicList.filter((t) => t.question_id !== null)
        .length,
      topics_remaining: examTopicList.filter((t) => t.question_id === null)
        .length,
      target_questions: exam.total_questions,
      structuredData: true,
    },
  );

  // For the next batch, find topics that still don't have questions assigned
  const remainingUnassignedTopics = examTopicList.filter(
    (topic) => topic.question_id === null,
  );

  // Determine if we should complete the exam based on actual progress:
  // 1. We've reached the planned total batches
  // 2. All topics have been assigned questions
  // 3. We've reached the target question count
  const shouldCompleteExam =
    batch_number >= total_batches ||
    remainingUnassignedTopics.length === 0 ||
    actualQuestionsGenerated >= (exam.total_questions || 0);

  // Calculate adjusted total batches for progress tracking
  let adjustedTotalBatches = total_batches;
  if (!shouldCompleteExam && remainingUnassignedTopics.length > 0) {
    const effectiveRemainingBatches = Math.ceil(
      remainingUnassignedTopics.length / questions_per_batch,
    );
    adjustedTotalBatches = batch_number + effectiveRemainingBatches;
  }

  if (shouldCompleteExam) {
    const completionReason =
      batch_number >= total_batches
        ? 'planned_batches_complete'
        : remainingUnassignedTopics.length === 0
        ? 'all_topics_assigned'
        : 'target_questions_reached';

    logger.info(
      `Completing exam generation for exam ${exam_id}, batch ${batch_number}. Reason: ${completionReason}`,
      {
        exam_id,
        batch_number,
        total_batches,
        actual_questions_generated: actualQuestionsGenerated,
        remaining_unassigned_topics: remainingUnassignedTopics.length,
        target_questions: exam.total_questions,
        completion_reason: completionReason,
        validation_stats: {
          total_generated: generatedQuestions.length,
          valid_questions: questionsProcessedThisBatch,
          failed_questions: questionsFailedThisBatch,
        },
        structuredData: true,
      },
    );

    // Get existing exam user answers to avoid duplicates
    const existingAnswers = await prismaInstance.examUserAnswer.findMany({
      where: { exam_id },
      select: { quiz_question_id: true },
    });

    const existingQuestionIds = new Set(
      existingAnswers.map((answer) => answer.quiz_question_id),
    );

    // Use the reusable question association utility
    associationResult = await associateQuestionsWithExam({
      exam_id,
      cert_id,
      targetQuestionCount: exam.total_questions || undefined,
      existingQuestionIds,
    });

    if (!associationResult.success) {
      logger.error(
        `Failed to associate questions with exam ${exam_id}: ${associationResult.error}`,
      );

      // Update exam status to failed
      await updateExamAfterQuestionAssociation(exam_id, associationResult);
      throw new Error(
        associationResult.error || 'Failed to associate questions',
      );
    }

    // Update exam with successful association results
    await updateExamAfterQuestionAssociation(exam_id, associationResult);

    // Calculate and log total exam generation time before cleanup
    const totalGenerationTime = await calculateAndLogExamGenerationTime(
      exam_id,
      batch_number,
      completionReason,
      actualQuestionsGenerated,
      exam.total_questions || undefined,
    );

    // Clean up RTDB exam plan data now that exam is complete
    try {
      const examPlanPath = `exam_plans/${exam_id}`;
      await deleteRtdbValue(examPlanPath); // Delete the exam plan
      logger.info(
        `RTDB_CLEANUP_SUCCESS: Removed exam plan data for completed exam ${exam_id}`,
        {
          exam_id,
          rtdb_path: examPlanPath,
          cleanup_reason: 'exam_generation_complete',
          total_generation_time: totalGenerationTime,
          structuredData: true,
        },
      );
    } catch (cleanupError) {
      logger.warn(
        `RTDB_CLEANUP_FAILED: Failed to clean up exam plan for ${exam_id}`,
        {
          exam_id,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : 'Unknown cleanup error',
          structuredData: true,
        },
      );
      // Don't throw - cleanup failure shouldn't affect exam completion
    }

    // Log exam completion with timing information
    ExamGenerationLogger.logExamComplete({
      exam_id,
      total_questions_generated: actualQuestionsGenerated,
      total_questions_associated: associationResult.associatedQuestionCount,
      total_batches,
      status: 'READY',
    });

    logger.info(
      `EXAM_READY: exam_id=${exam_id}, status=READY, generation_time=${
        totalGenerationTime?.processingDurationMinutes || 'unknown'
      }min`,
    );
  } else {
    // Continue with next batch
    // Calculate remaining questions needed, ensuring we never go negative
    const remainingQuestions = Math.max(
      0,
      (exam.total_questions || 0) - actualQuestionsGenerated,
    );

    // Additional validation: Only create next batch if there are both questions remaining and unassigned topics
    if (remainingQuestions <= 0) {
      logger.warn(
        `No more questions needed for exam ${exam_id}. Total: ${exam.total_questions}, Generated: ${actualQuestionsGenerated}`,
      );

      // Calculate and log exam generation timing
      const timingInfo = await calculateAndLogExamGenerationTime(
        exam_id,
        batch_number,
        'target_questions_reached',
        actualQuestionsGenerated,
        exam.total_questions || undefined,
      );

      // Mark exam as ready since we've generated enough questions
      await updateExamAfterQuestionAssociation(exam_id, {
        success: true,
        associatedQuestionCount: actualQuestionsGenerated,
        selectedQuestionIds: [],
        certification: null,
      });

      logger.info(
        `EXAM_READY: exam_id=${exam_id}, status=READY, generation_time=${
          timingInfo?.processingDurationMinutes || 'unknown'
        }min, reason=target_questions_reached`,
      );

      res.status(200).json({
        success: true,
        message: `Exam generation completed. Total questions generated: ${actualQuestionsGenerated}`,
        data: {
          exam_id,
          batch_number,
          total_batches,
          questions_generated: generatedQuestions.length,
          is_final_batch: true,
          completion_reason: 'target_questions_reached',
          generation_time_minutes: timingInfo?.processingDurationMinutes,
        },
      });
      return;
    }

    // Only create next batch if there are unassigned topics remaining
    if (remainingUnassignedTopics.length === 0) {
      logger.info(
        `No more unassigned topics for exam ${exam_id}. All topics have questions assigned.`,
      );

      // Log final summary before marking exam as complete
      logQuestionTopicAssociationSummary(
        exam_id,
        examTopicList,
        'exam_generation_complete',
      );

      // Calculate and log exam generation timing
      const timingInfo = await calculateAndLogExamGenerationTime(
        exam_id,
        batch_number,
        'all_topics_assigned',
        examTopicList.filter((t) => t.question_id !== null).length,
        exam.total_questions || undefined,
      );

      // Mark exam as ready since all topics have questions
      await updateExamAfterQuestionAssociation(exam_id, {
        success: true,
        associatedQuestionCount: examTopicList.filter(
          (t) => t.question_id !== null,
        ).length,
        selectedQuestionIds: [],
        certification: null,
      });

      logger.info(
        `EXAM_READY: exam_id=${exam_id}, status=READY, generation_time=${
          timingInfo?.processingDurationMinutes || 'unknown'
        }min, reason=all_topics_assigned`,
      );

      res.status(200).json({
        success: true,
        message: `Exam generation completed. All topics have questions assigned.`,
        data: {
          exam_id,
          batch_number,
          total_batches,
          questions_generated: generatedQuestions.length,
          is_final_batch: true,
          completion_reason: 'all_topics_assigned',
          generation_time_minutes: timingInfo?.processingDurationMinutes,
        },
      });
      return;
    }

    // Calculate how many topics to include in the next batch
    const questionsForNextBatch = Math.min(
      remainingUnassignedTopics.length,
      questions_per_batch,
    );

    logger.info(
      `EXAM_BATCH_CALCULATION: exam_id=${exam_id}, batch=${batch_number}`,
      {
        exam_id,
        current_batch: batch_number,
        original_total_batches: total_batches,
        remaining_unassigned_topics: remainingUnassignedTopics.length,
        questions_for_next_batch: questionsForNextBatch,
        effective_remaining_batches: Math.ceil(
          remainingUnassignedTopics.length / questions_per_batch,
        ),
        adjusted_total_batches: adjustedTotalBatches,
        structuredData: true,
      },
    );

    // Check if exam processing has exceeded the timeout threshold (10 minutes)
    const timeoutCheck = await checkExamProcessingTimeout(exam_id, 10);

    if (timeoutCheck.isTimedOut) {
      logger.warn(
        `EXAM_TIMEOUT_EXCEEDED: exam_id=${exam_id}, processing_duration=${timeoutCheck.processingDurationMinutes} minutes exceeds threshold`,
        {
          exam_id,
          batch_number,
          processing_duration_minutes: timeoutCheck.processingDurationMinutes,
          timeout_threshold_minutes: timeoutCheck.timeoutThresholdMinutes,
          started_at: timeoutCheck.createdAt,
          reason: 'processing_timeout_exceeded',
          structuredData: true,
        },
      );

      // Mark exam as failed due to timeout
      const examForTimeout = await prismaInstance.examAttempt.findUnique({
        where: { exam_id },
        select: { user_id: true },
      });

      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
      });

      // Invalidate user exam cache when exam generation fails due to timeout
      if (examForTimeout?.user_id) {
        await CacheManager.invalidateUserExamCacheForGenerationChange(
          examForTimeout.user_id,
          'exam_generation_timeout',
        );
      }

      // Log exam failure due to timeout
      ExamGenerationLogger.logExamFailure({
        exam_id,
        batch_number,
        total_batches,
        reason: 'processing_timeout_exceeded',
        error: `Exam processing exceeded ${timeoutCheck.timeoutThresholdMinutes} minute timeout. Duration: ${timeoutCheck.processingDurationMinutes} minutes`,
        questions_generated_so_far: actualQuestionsGenerated,
      });

      res.status(408).json({
        success: false,
        error: 'Exam generation timed out',
        message: `Exam processing exceeded ${timeoutCheck.timeoutThresholdMinutes} minute timeout`,
        data: {
          exam_id,
          batch_number,
          processing_duration_minutes: timeoutCheck.processingDurationMinutes,
          timeout_threshold_minutes: timeoutCheck.timeoutThresholdMinutes,
          questions_generated_so_far: actualQuestionsGenerated,
          reason: 'processing_timeout_exceeded',
        },
      });
      return;
    }

    logger.info(
      `EXAM_TIMEOUT_CHECK_PASSED: exam_id=${exam_id}, processing_duration=${timeoutCheck.processingDurationMinutes} minutes within ${timeoutCheck.timeoutThresholdMinutes} minute threshold`,
      {
        exam_id,
        batch_number,
        processing_duration_minutes: timeoutCheck.processingDurationMinutes,
        timeout_threshold_minutes: timeoutCheck.timeoutThresholdMinutes,
        structuredData: true,
      },
    );

    const nextBatchPayload = {
      exam_id,
      cert_id,
      certification_name: payload.certification_name,
      batch_number: batch_number + 1,
      total_batches: adjustedTotalBatches, // Use adjusted total based on remaining work
      custom_prompt_text: payload.custom_prompt_text,
      questions_per_batch,
      last_exam_report: payload.last_exam_report,
    };

    const delaySeconds = 1;

    // CRITICAL FIX: Ensure Cloud Tasks queue exists before creating next batch task
    // This prevents failures when the queue has been accidentally deleted
    try {
      logger.info(
        `QUEUE_VALIDATION_NEXT_BATCH: Ensuring exam generation queues exist before next batch task creation`,
        {
          exam_id,
          current_batch: batch_number,
          next_batch: batch_number + 1,
          structuredData: true,
        },
      );

      await validateExamQueueReadiness();

      logger.info(
        `QUEUE_VALIDATION_NEXT_BATCH_SUCCESS: All exam generation queues are ready for next batch`,
        {
          exam_id,
          current_batch: batch_number,
          next_batch: batch_number + 1,
          structuredData: true,
        },
      );
    } catch (queueError) {
      logger.error(
        `QUEUE_VALIDATION_NEXT_BATCH_ERROR: Failed to ensure queues exist before next batch task creation`,
        {
          exam_id,
          current_batch: batch_number,
          next_batch: batch_number + 1,
          error:
            queueError instanceof Error
              ? queueError.message
              : String(queueError),
          structuredData: true,
        },
      );

      // If queue validation fails, mark exam as failed
      const examForQueueFailure = await prismaInstance.examAttempt.findUnique({
        where: { exam_id },
        select: { user_id: true },
      });

      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
      });

      if (examForQueueFailure?.user_id) {
        await CacheManager.invalidateUserExamCacheForGenerationChange(
          examForQueueFailure.user_id,
          'exam_generation_queue_validation_failed',
        );
      }

      ExamGenerationLogger.logExamFailure({
        exam_id,
        batch_number,
        total_batches: adjustedTotalBatches,
        reason: 'queue_validation_failed',
        error: `Queue validation failed: ${
          queueError instanceof Error ? queueError.message : 'Unknown error'
        }`,
        questions_generated_so_far: actualQuestionsGenerated,
      });

      logger.info(
        `EXAM_GENERATION_FAILED: exam_id=${exam_id}, reason=queue_validation_failed`,
      );

      res.status(500).json({
        success: false,
        error: 'Failed to validate queue readiness for next batch.',
      });
      return;
    }

    const nextTaskName = await createCloudTask(
      'exam-questions-queue',
      `${process.env.GCP_TASKS_HOST}/delegators/tasks/take`,
      nextBatchPayload,
      delaySeconds,
    );

    // Log task creation
    ExamGenerationLogger.logTaskCreation({
      exam_id,
      current_batch: batch_number,
      next_batch: batch_number + 1,
      total_batches: adjustedTotalBatches, // Use adjusted total
      questions_for_next_batch: questionsForNextBatch,
      task_name: nextTaskName || undefined,
      success: !!nextTaskName,
      error: nextTaskName ? undefined : 'Failed to create cloud task',
    });

    if (!nextTaskName) {
      logger.error(
        `Failed to create next batch task for exam ${exam_id}, batch ${
          batch_number + 1
        }`,
      );

      // Get exam details for cache invalidation
      const examForTaskFailure = await prismaInstance.examAttempt.findUnique({
        where: { exam_id },
        select: { user_id: true },
      });

      // Update exam status to failed
      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
      });

      // Invalidate user exam cache when exam generation fails due to task creation failure
      if (examForTaskFailure?.user_id) {
        await CacheManager.invalidateUserExamCacheForGenerationChange(
          examForTaskFailure.user_id,
          'exam_generation_task_creation_failed',
        );
      }

      // Log exam failure
      ExamGenerationLogger.logExamFailure({
        exam_id,
        batch_number,
        total_batches,
        reason: 'task_creation_failed',
        error: 'Failed to create next batch cloud task',
        questions_generated_so_far: actualQuestionsGenerated,
      });

      logger.info(
        `EXAM_GENERATION_FAILED: exam_id=${exam_id}, reason=task_creation_failed`,
      );
    } else {
      logger.info(
        `EXAM_BATCH_NEXT: exam_id=${exam_id}, next_batch=${
          batch_number + 1
        }/${adjustedTotalBatches}`,
      );
    }
  }

  // Get current processing time for progress tracking
  let currentProcessingTime: { processingDurationMinutes: number } | null =
    null;
  if (!shouldCompleteExam) {
    try {
      const timeoutCheck = await checkExamProcessingTimeout(exam_id, 999); // Use high timeout to get timing without timeout
      currentProcessingTime = {
        processingDurationMinutes: timeoutCheck.processingDurationMinutes,
      };
    } catch {
      // Ignore timing errors for progress tracking
    }
  }

  // Update real-time progress tracking in RTDB for frontend
  try {
    const progressInfo = {
      current_batch: batch_number,
      total_batches: shouldCompleteExam
        ? batch_number
        : adjustedTotalBatches || total_batches,
      questions_generated: actualQuestionsGenerated,
      target_questions: exam.total_questions || undefined,
      completion_percentage: shouldCompleteExam ? 100 : undefined,
      last_updated: Math.floor(Date.now() / 1000),
    };

    await updateExamGenerationProgress(exam_id, progressInfo);
  } catch (progressError) {
    logger.warn(
      `Failed to update progress for exam ${exam_id}:`,
      progressError as any,
    );
    // Don't fail the request if progress update fails
  }

  res.status(200).json({
    success: true,
    message: `Successfully processed batch ${batch_number}/${total_batches}`,
    data: {
      exam_id,
      batch_number,
      total_batches,
      questions_generated: generatedQuestions.length,
      questions_validated: questionsProcessedThisBatch,
      questions_failed_validation: questionsFailedThisBatch,
      questions_associated: associationResult?.associatedQuestionCount || 0,
      actual_questions_total: actualQuestionsGenerated,
      is_final_batch: shouldCompleteExam,
      current_processing_time_minutes:
        currentProcessingTime?.processingDurationMinutes,
      // Add real progress information for frontend
      real_progress: {
        current_batch: batch_number,
        total_batches: shouldCompleteExam
          ? batch_number
          : adjustedTotalBatches || total_batches,
        questions_generated: actualQuestionsGenerated,
        target_questions: exam.total_questions,
        completion_percentage: shouldCompleteExam
          ? 100
          : exam.total_questions
          ? Math.round((actualQuestionsGenerated / exam.total_questions) * 100)
          : Math.round((batch_number / total_batches) * 100),
      },
    },
  });
};
