import logger from '../../../services/firebase/logger';
import { updateRtdbValue, getRtdbValue } from '../../../services/firebase/rtdb';
import { ExamTopicItem, normalizeExamTopic } from './helper';

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
 * @param validQuestions - The original valid questions from AI generation
 */
export async function updateExamQuestionsInRtdb(
  exam_id: string,
  createdQuestions: any[],
  validQuestions: any[],
): Promise<void> {
  try {
    // Get existing exam data from RTDB or initialize if not exists
    const examPath = `exams/${exam_id}`;
    let examData = await getRtdbValue(examPath);

    if (!examData) {
      examData = {
        exam_id,
        examTopics: {},
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
    }

    // Create exam topics updates for RTDB (removed quizQuestions to avoid path conflicts)
    const examTopicsUpdates: Record<string, any> = {};

    createdQuestions.forEach((createdQuestion, index) => {
      const originalQuestion = validQuestions[index];
      const questionId = createdQuestion.quiz_question_id;
      const examTopic = normalizeExamTopic(originalQuestion.examTopic);

      // Group questions by topic - use direct object structure instead of paths
      if (!examTopicsUpdates[examTopic]) {
        examTopicsUpdates[examTopic] = {
          topic_name: originalQuestion.examTopic, // Store original topic text
          normalized_topic: examTopic, // Store normalized version for matching
          question_ids: [],
          question_count: 0,
        };
      }

      examTopicsUpdates[examTopic].question_ids.push(questionId);
      examTopicsUpdates[examTopic].question_count += 1;
    });

    // Merge existing exam topics with new ones
    const mergedExamTopics = { ...examData.examTopics };

    Object.keys(examTopicsUpdates).forEach((topicKey) => {
      if (mergedExamTopics[topicKey]) {
        // Merge existing topic data
        const existingTopic = mergedExamTopics[topicKey];
        const newTopic = examTopicsUpdates[topicKey];

        mergedExamTopics[topicKey] = {
          ...existingTopic,
          question_ids: [
            ...(existingTopic.question_ids || []),
            ...newTopic.question_ids,
          ],
          question_count:
            (existingTopic.question_count || 0) + newTopic.question_count,
        };
      } else {
        mergedExamTopics[topicKey] = examTopicsUpdates[topicKey];
      }
    });

    // Update exam metadata
    const examMetaUpdates = {
      lastUpdated: new Date().toISOString(),
      totalQuestions: (examData.totalQuestions || 0) + createdQuestions.length,
      totalTopics: Object.keys(mergedExamTopics).length,
    };

    // Combine updates without quizQuestions to avoid path conflicts
    const allUpdates = {
      examTopics: mergedExamTopics,
      ...examMetaUpdates,
    };

    // Update RTDB with all the data
    await updateRtdbValue(examPath, allUpdates);

    logger.info(
      `RTDB updated for exam ${exam_id}: ${
        createdQuestions.length
      } questions across ${Object.keys(examTopicsUpdates).length} topics`,
      {
        exam_id,
        questionsAdded: createdQuestions.length,
        topicsUpdated: Object.keys(examTopicsUpdates).length,
      },
    );
  } catch (error) {
    logger.error(`Failed to update RTDB for exam ${exam_id}:`, error as any);
    // Don't throw error - RTDB update failure shouldn't break the main flow
  }
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
