import logger from '../../../services/firebase/logger';
import { updateRtdbValue, getRtdbValue } from '../../../services/firebase/rtdb';
import { ExamTopicItem } from './helper';

/**
 * Retrieves exam topics from RTDB
 * @param exam_id - The exam identifier
 * @returns Promise resolving to the topic list
 */
export async function getExamTopicsFromRtdb(
  exam_id: string,
): Promise<ExamTopicItem[]> {
  try {
    const examPlanPath = `exam_plans/${exam_id}`;
    const examPlan = await getRtdbValue(examPlanPath);

    if (examPlan && examPlan.questions && Array.isArray(examPlan.questions)) {
      // Enhanced logging to debug the "all topics assigned" issue
      const assignedCount = examPlan.questions.filter(
        (q: any) => q.question_id !== null,
      ).length;
      const unassignedCount = examPlan.questions.filter(
        (q: any) => q.question_id === null,
      ).length;

      logger.info(
        `Retrieved ${examPlan.questions.length} topics from RTDB for exam ${exam_id}`,
        {
          exam_id,
          total_topics: examPlan.questions.length,
          assigned_topics: assignedCount,
          unassigned_topics: unassignedCount,
          topics_sample: examPlan.questions.slice(0, 3).map((q: any) => ({
            exam_topic:
              q.exam_topic.substring(0, 30) +
              (q.exam_topic.length > 30 ? '...' : ''),
            has_question_id: q.question_id !== null,
            question_id: q.question_id,
          })),
          structuredData: true,
        },
      );

      // Ensure all question_id values are properly initialized as null (not undefined)
      // This normalizes any potential data inconsistencies from RTDB
      const normalizedQuestions = examPlan.questions.map((q: any) => ({
        ...q,
        question_id:
          q.question_id === null || q.question_id === undefined
            ? null
            : q.question_id,
      }));

      return normalizedQuestions;
    } else {
      logger.error(
        `No exam plan found in RTDB for exam ${exam_id}. This is a critical error as exam plan should exist.`,
        {
          exam_id,
          examPlan_exists: !!examPlan,
          examPlan_has_questions: !!(examPlan && examPlan.questions),
          examPlan_questions_is_array: !!(
            examPlan &&
            examPlan.questions &&
            Array.isArray(examPlan.questions)
          ),
          examPlan_structure: examPlan ? Object.keys(examPlan) : null,
          structuredData: true,
        },
      );
      throw new Error(`No exam plan found in RTDB for exam ${exam_id}`);
    }
  } catch (error) {
    logger.error(
      `Failed to retrieve exam plan from RTDB for exam ${exam_id}:`,
      error as any,
    );
    throw error;
  }
}

/**
 * Updates the realtime database with exam topic information only (removed quizQuestions to avoid path conflicts)
 * @param exam_id - The exam identifier
 * @param createdQuestions - The questions created in the database
 * @param validQuestions - The original valid questions from AI generation (unused after refactor)
 * @deprecated This function has been removed as the "exams" collection in RTDB was not being used
 */
export async function updateExamQuestionsInRtdb(
  exam_id: string,
  createdQuestions: any[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validQuestions: any[],
): Promise<void> {
  // REFACTORED: Removed RTDB "exams" collection storage as it was not being consumed
  // The data was only being written but never read by any other part of the application
  logger.info(
    `RTDB update skipped for exam ${exam_id}: ${createdQuestions.length} questions processed (exams collection removed)`,
    {
      exam_id,
      questionsProcessed: createdQuestions.length,
      reason: 'exams_collection_removed_as_unused',
      structuredData: true,
    },
  );
}

/**
 * Checks if the exam has been processing for more than the specified timeout
 * @param exam_id - The exam identifier
 * @param timeoutMinutes - The timeout in minutes (default: 10)
 * @returns Object with timeout status and processing duration
 */
export async function checkExamProcessingTimeout(
  exam_id: string,
  timeoutMinutes: number = 10,
): Promise<{
  isTimedOut: boolean;
  processingDurationMinutes: number;
  createdAt?: number;
  timeoutThresholdMinutes: number;
}> {
  try {
    const examPlanPath = `exam_plans/${exam_id}`;
    const examPlan = await getRtdbValue(examPlanPath);

    if (!examPlan) {
      logger.warn(`No exam plan found for timeout check: ${exam_id}`);
      return {
        isTimedOut: false,
        processingDurationMinutes: 0,
        timeoutThresholdMinutes: timeoutMinutes,
      };
    }

    // Use created_at as the start time (when exam generation began)
    const startedAt = examPlan.created_at;

    if (!startedAt) {
      logger.warn(`No created_at timestamp found for exam ${exam_id}`);
      return {
        isTimedOut: false,
        processingDurationMinutes: 0,
        timeoutThresholdMinutes: timeoutMinutes,
      };
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const processingDurationSeconds = currentTime - startedAt;
    const processingDurationMinutes = Math.floor(
      processingDurationSeconds / 60,
    );
    const isTimedOut = processingDurationMinutes >= timeoutMinutes;

    logger.info(`EXAM_TIMEOUT_CHECK: exam_id=${exam_id}`, {
      exam_id,
      created_at: startedAt,
      current_time: currentTime,
      processing_duration_seconds: processingDurationSeconds,
      processing_duration_minutes: processingDurationMinutes,
      timeout_threshold_minutes: timeoutMinutes,
      is_timed_out: isTimedOut,
      structuredData: true,
    });

    return {
      isTimedOut,
      processingDurationMinutes,
      createdAt: startedAt,
      timeoutThresholdMinutes: timeoutMinutes,
    };
  } catch (error) {
    logger.error(`Error checking exam timeout for ${exam_id}:`, error as any);
    // In case of error, don't block processing
    return {
      isTimedOut: false,
      processingDurationMinutes: 0,
      timeoutThresholdMinutes: timeoutMinutes,
    };
  }
}

/**
 * Calculates and logs comprehensive exam generation timing metrics
 * @param exam_id - The exam identifier
 * @param batch_number - Current batch number
 * @param completionReason - Reason for exam completion
 * @param actualQuestionsGenerated - Total questions generated
 * @param targetQuestions - Target number of questions
 * @returns Timing information object
 */
export async function calculateAndLogExamGenerationTime(
  exam_id: string,
  batch_number: number,
  completionReason: string,
  actualQuestionsGenerated: number,
  targetQuestions?: number,
): Promise<{
  processingDurationSeconds: number;
  processingDurationMinutes: number;
  startedAt?: number;
  completedAt: number;
} | null> {
  try {
    const examPlanPath = `exam_plans/${exam_id}`;
    const examPlan = await getRtdbValue(examPlanPath);
    const completedAt = Math.floor(Date.now() / 1000);

    if (examPlan?.created_at) {
      const startedAt = examPlan.created_at;
      const processingDurationSeconds = completedAt - startedAt;
      const processingDurationMinutes = Math.floor(
        processingDurationSeconds / 60,
      );

      const timingInfo = {
        processingDurationSeconds,
        processingDurationMinutes,
        startedAt,
        completedAt,
      };

      // Log comprehensive exam generation timing
      logger.info(
        `EXAM_GENERATION_TIMING: exam_id=${exam_id} completed in ${processingDurationMinutes} minutes (${processingDurationSeconds} seconds)`,
        {
          exam_id,
          batch_number,
          completion_reason: completionReason,
          timing: {
            started_at: startedAt,
            completed_at: completedAt,
            processing_duration_seconds: processingDurationSeconds,
            processing_duration_minutes: processingDurationMinutes,
            processing_duration_human: `${Math.floor(
              processingDurationMinutes,
            )}m ${processingDurationSeconds % 60}s`,
          },
          exam_metrics: {
            total_batches_processed: batch_number,
            total_questions_generated: actualQuestionsGenerated,
            target_questions: targetQuestions,
            questions_per_minute:
              processingDurationMinutes > 0
                ? Math.round(
                    (actualQuestionsGenerated / processingDurationMinutes) *
                      100,
                  ) / 100
                : 0,
            completion_rate: targetQuestions
              ? Math.round((actualQuestionsGenerated / targetQuestions) * 100)
              : 100,
          },
          performance_metrics: {
            average_batch_time_seconds:
              processingDurationMinutes > 0
                ? Math.round((processingDurationSeconds / batch_number) * 100) /
                  100
                : 0,
            questions_per_batch_average:
              Math.round((actualQuestionsGenerated / batch_number) * 100) / 100,
          },
          structuredData: true,
        },
      );

      return timingInfo;
    } else {
      logger.warn(
        `EXAM_GENERATION_TIMING_INCOMPLETE: Could not calculate total generation time for exam ${exam_id} - no start timestamp found`,
        {
          exam_id,
          batch_number,
          completion_reason: completionReason,
          completed_at: completedAt,
          structuredData: true,
        },
      );
      return null;
    }
  } catch (timingError) {
    logger.warn(
      `EXAM_GENERATION_TIMING_ERROR: Failed to calculate generation timing for exam ${exam_id}`,
      {
        exam_id,
        error:
          timingError instanceof Error
            ? timingError.message
            : 'Unknown timing error',
        structuredData: true,
      },
    );
    return null;
  }
}

/**
 * PHASE 5 (DEPRECATION): Updates exam generation progress in deprecated exam_progress RTDB path
 * @param exam_id - The exam identifier
 * @param progressInfo - Progress information to update
 * @deprecated No longer called as of 2025-04-22. Kept for rollback capability.
 * exam_progress is no longer written. Use exam_plans instead (PHASE 2 migration complete).
 */
export async function updateExamGenerationProgress(
  exam_id: string,
  progressInfo: {
    current_batch: number;
    total_batches: number;
    questions_generated: number;
    target_questions?: number;
    completion_percentage?: number;
    last_updated: number;
  },
): Promise<void> {
  try {
    // DEPRECATED: Writing to exam_progress for backward compatibility only.
    // Prefer reading from exam_plans. See migration note above.
    const progressPath = `exam_progress/${exam_id}`;

    // Calculate completion percentage if not provided
    const completion_percentage =
      progressInfo.completion_percentage ||
      (progressInfo.target_questions
        ? Math.round(
            (progressInfo.questions_generated / progressInfo.target_questions) *
              100,
          )
        : Math.round(
            (progressInfo.current_batch / progressInfo.total_batches) * 100,
          ));

    const progressData = {
      ...progressInfo,
      completion_percentage,
      updated_at: progressInfo.last_updated,
    };

    await updateRtdbValue(progressPath, progressData);

    logger.info(`EXAM_PROGRESS_UPDATED: exam_id=${exam_id}`, {
      exam_id,
      progress: progressData,
      structuredData: true,
    });
  } catch (error) {
    logger.error(
      `Failed to update exam progress for ${exam_id}:`,
      error as any,
    );
  }
}

/**
 * PHASE 5 (DEPRECATION): Gets exam generation progress from deprecated exam_progress RTDB path
 * @param exam_id - The exam identifier
 * @returns Progress information or null if not found
 * @deprecated Use calculateExamProgressFromPlan instead. Reads from deprecated exam_progress path.
 * Will be removed after full migration to exam_plans.
 */
export async function getExamGenerationProgress(exam_id: string): Promise<{
  current_batch: number;
  total_batches: number;
  questions_generated: number;
  target_questions?: number;
  completion_percentage: number;
  updated_at: number;
} | null> {
  try {
    const progressPath = `exam_progress/${exam_id}`;
    const progressData = await getRtdbValue(progressPath);

    return progressData || null;
  } catch (error) {
    logger.error(`Failed to get exam progress for ${exam_id}:`, error as any);
    return null;
  }
}

/**
 * PHASE 2: Calculates exam generation progress from exam_plans (current source of truth)
 * Replaces the deprecated getExamGenerationProgress which reads from exam_progress.
 *
 * @param exam_id - The exam identifier
 * @param examPlan - The exam_plans structure from RTDB: { questions: [...], created_at?: number }
 * @param totalQuestions - Total questions target from Firestore examAttempt.total_questions
 * @returns Progress object matching the structure used by frontend, or null if exam_plan invalid
 *
 * @example
 * const examPlan = await getRtdbValue(`exam_plans/${exam_id}`);
 * const progress = await calculateExamProgressFromPlan(exam_id, examPlan, exam.total_questions);
 * // Returns: { current_batch: 3, total_batches: 10, questions_generated: 3, completion_percentage: 30, ... }
 */
export async function calculateExamProgressFromPlan(
  exam_id: string,
  examPlan: any,
  totalQuestions: number | null,
): Promise<{
  current_batch: number;
  total_batches: number;
  questions_generated: number;
  target_questions?: number;
  completion_percentage: number;
  updated_at: number;
} | null> {
  try {
    if (!examPlan || !examPlan.questions || !Array.isArray(examPlan.questions)) {
      return null;
    }

    const total_batches = examPlan.questions.length;
    const questions_generated = examPlan.questions.filter(
      (q: any) => q.question_id !== null && q.question_id !== undefined,
    ).length;

    // Estimate current_batch as the next batch being processed
    // (one past the last generated)
    const current_batch = Math.min(questions_generated + 1, total_batches);

    const completion_percentage =
      total_batches > 0 ? Math.round((questions_generated / total_batches) * 100) : 0;

    const progress = {
      current_batch,
      total_batches,
      questions_generated,
      completion_percentage,
      updated_at: Math.floor(Date.now() / 1000),
      ...(totalQuestions && { target_questions: totalQuestions }),
    };

    logger.info(`Calculated progress from exam_plans for ${exam_id}`, {
      exam_id,
      progress,
      structuredData: true,
    });

    return progress;
  } catch (error) {
    logger.error(
      `Failed to calculate exam progress from exam_plans for ${exam_id}:`,
      error as any,
    );
    return null;
  }
}

/**
 * Updates the exam plan in RTDB with the updated topic list
 * @param exam_id - The exam identifier
 * @param updatedTopicList - The updated topic list with question assignments
 */
export async function updateExamPlanInRtdb(
  exam_id: string,
  updatedTopicList: ExamTopicItem[],
): Promise<void> {
  try {
    const examPlanPath = `exam_plans/${exam_id}`;

    // Get the existing exam plan
    const existingPlan = await getRtdbValue(examPlanPath);

    if (existingPlan) {
      // Count current assignments for logging
      const newlyAssigned = updatedTopicList.filter(
        (t) => t.question_id !== null,
      );
      const stillUnassigned = updatedTopicList.filter(
        (t) => t.question_id === null,
      );

      // Update only the questions array with the new assignments
      // Ensure all question_id values are explicitly null or a valid string
      const normalizedQuestions = updatedTopicList.map((topic) => ({
        ...topic,
        question_id: topic.question_id === undefined ? null : topic.question_id,
      }));

      const updateData: any = {
        questions: normalizedQuestions,
        updated_at: Math.floor(Date.now() / 1000),
      };

      await updateRtdbValue(examPlanPath, updateData);

      logger.info(`Updated exam plan in RTDB for exam ${exam_id}`, {
        exam_id,
        totalTopics: updatedTopicList.length,
        assignedTopics: newlyAssigned.length,
        unassignedTopics: stillUnassigned.length,
        newly_assigned_questions: newlyAssigned.map((t) => ({
          exam_topic: t.exam_topic,
          question_id: t.question_id,
        })),
        path: examPlanPath,
        structuredData: true,
      });

      // Log immediate RTDB update success
      logger.info(
        `RTDB_EXAM_PLAN_UPDATED: exam_id=${exam_id}, assigned=${newlyAssigned.length}, unassigned=${stillUnassigned.length}`,
        {
          exam_id,
          rtdb_path: examPlanPath,
          assigned_count: newlyAssigned.length,
          unassigned_count: stillUnassigned.length,
          update_timestamp: Math.floor(Date.now() / 1000),
          structuredData: true,
        },
      );
    } else {
      logger.warn(`No existing exam plan found in RTDB for exam ${exam_id}`);
    }
  } catch (error) {
    logger.error(
      `Failed to update exam plan in RTDB for exam ${exam_id}:`,
      error as any,
    );
  }
}
