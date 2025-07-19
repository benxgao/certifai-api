import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import prismaInstance, { ExamStatus } from '../../../services/prisma';
import { createCloudTask } from '../../../services/gcp/cloudTasks';
import {
  associateQuestionsWithExam,
  updateExamAfterQuestionAssociation,
} from '../../../utils/examQuestionAssociation';
import { PerformanceMonitor } from '../../../services/performance';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import { ExamGenerationMetrics } from '../../../services/exam-generation-metrics';
import {
  updateRtdbValue,
  getRtdbValue,
  deleteRtdbValue,
} from '../../../services/firebase/rtdb';

interface TaskPayload {
  exam_id: string;
  cert_id: number;
  certification_name: string;
  batch_number: number;
  total_batches: number;
  custom_prompt_text?: string;
  questions_per_batch: number;
}

interface ExamTopicItem {
  exam_topic: string;
  question_id: string | null;
}

/**
 * Logs a summary of question-topic associations for debugging and monitoring
 * @param exam_id - The exam identifier
 * @param examTopicList - Current topic list with question associations
 * @param context - Context for the logging (e.g., 'after_batch_creation')
 */
function logQuestionTopicAssociationSummary(
  exam_id: string,
  examTopicList: ExamTopicItem[],
  context: string,
): void {
  const assignedTopics = examTopicList.filter((t) => t.question_id !== null);
  const unassignedTopics = examTopicList.filter((t) => t.question_id === null);

  logger.info(`QUESTION_TOPIC_SUMMARY: ${context} for exam_id=${exam_id}`, {
    exam_id,
    context,
    summary: {
      total_topics: examTopicList.length,
      assigned_topics: assignedTopics.length,
      unassigned_topics: unassignedTopics.length,
      completion_percentage: Math.round(
        (assignedTopics.length / examTopicList.length) * 100,
      ),
    },
    assigned_mappings: assignedTopics.map((t) => ({
      exam_topic: t.exam_topic,
      question_id: t.question_id,
    })),
    unassigned_topics: unassignedTopics.map((t) => t.exam_topic),
    structuredData: true,
  });
}

/**
 * Retrieves exam topics from RTDB
 * @param exam_id - The exam identifier
 * @returns Promise resolving to the topic list
 */
async function getExamTopicsFromRtdb(
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
 * Normalizes exam topic text for consistent matching
 * @param topicText - The topic text to normalize
 * @returns Normalized topic text
 */
function normalizeExamTopic(topicText: string): string {
  return topicText.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Finds the best matching exam topic from the list
 * @param generatedTopic - The topic generated by AI
 * @param examTopicList - The list of exam topics from RTDB
 * @returns The matching exam topic item or null if not found
 */
function findMatchingExamTopic(
  generatedTopic: string,
  examTopicList: ExamTopicItem[],
): ExamTopicItem | null {
  const normalizedGenerated = normalizeExamTopic(generatedTopic);

  // First try exact match (normalized)
  const exactMatch = examTopicList.find(
    (topic) =>
      topic.question_id === null &&
      normalizeExamTopic(topic.exam_topic) === normalizedGenerated,
  );

  if (exactMatch) {
    return exactMatch;
  }

  // Try partial match (contains)
  const partialMatch = examTopicList.find(
    (topic) =>
      topic.question_id === null &&
      (normalizeExamTopic(topic.exam_topic).includes(normalizedGenerated) ||
        normalizedGenerated.includes(normalizeExamTopic(topic.exam_topic))),
  );

  if (partialMatch) {
    logger.info(
      `TOPIC_PARTIAL_MATCH: Generated="${generatedTopic}" matched with "${partialMatch.exam_topic}"`,
      {
        generated_topic: generatedTopic,
        matched_topic: partialMatch.exam_topic,
        structuredData: true,
      },
    );
    return partialMatch;
  }

  logger.warn(
    `TOPIC_NO_MATCH: Generated topic "${generatedTopic}" could not be matched`,
    {
      generated_topic: generatedTopic,
      available_topics: examTopicList
        .filter((t) => t.question_id === null)
        .map((t) => t.exam_topic),
      structuredData: true,
    },
  );

  return null;
}

/**
 * Updates the realtime database with exam topic information only (removed quizQuestions to avoid path conflicts)
 * @param exam_id - The exam identifier
 * @param createdQuestions - The questions created in the database
 * @param validQuestions - The original valid questions from AI generation
 */
async function updateExamQuestionsInRtdb(
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
 * Updates the examTopicList with generated question IDs - only for successfully validated questions
 * @param examTopicList - The original topic list
 * @param createdQuestions - The questions created in the database
 * @param validQuestionResults - The validation results for questions that passed validation
 * @returns Updated topic list with question IDs assigned only for valid questions
 */
function updateTopicListWithQuestionIds(
  examTopicList: ExamTopicItem[],
  createdQuestions: any[],
  validQuestionResults: Array<{
    question: any;
    matchingTopic: ExamTopicItem | null;
  }>,
): ExamTopicItem[] {
  const updatedTopicList = [...examTopicList];
  const associationsMade: Array<{
    exam_topic: string;
    question_id: string;
    topicIndex: number;
    matching_strategy: 'exact' | 'partial' | 'fallback';
  }> = [];

  createdQuestions.forEach((createdQuestion, index) => {
    const validationResult = validQuestionResults[index];
    const questionId = createdQuestion.quiz_question_id;
    const generatedTopic = validationResult.question.examTopic.trim();

    // Use the pre-validated matching topic from validation results
    const matchingTopic = validationResult.matchingTopic;
    let matchingStrategy: 'exact' | 'partial' | 'fallback' = 'exact';

    // If we have a pre-validated matching topic, use it
    if (matchingTopic) {
      // Check if the pre-validated topic is still available
      const topicIndex = updatedTopicList.findIndex(
        (topic) =>
          topic.exam_topic === matchingTopic!.exam_topic &&
          topic.question_id === null,
      );

      if (topicIndex !== -1) {
        // Assign to the pre-validated matching topic
        updatedTopicList[topicIndex] = {
          ...updatedTopicList[topicIndex],
          question_id: questionId,
        };

        // Determine matching strategy based on topic similarity
        const normalizedGenerated = normalizeExamTopic(generatedTopic);
        const normalizedMatched = normalizeExamTopic(matchingTopic.exam_topic);

        if (normalizedGenerated === normalizedMatched) {
          matchingStrategy = 'exact';
        } else if (
          normalizedGenerated.includes(normalizedMatched) ||
          normalizedMatched.includes(normalizedGenerated)
        ) {
          matchingStrategy = 'partial';
        } else {
          matchingStrategy = 'fallback';
        }

        associationsMade.push({
          exam_topic: matchingTopic.exam_topic,
          question_id: questionId,
          topicIndex,
          matching_strategy: matchingStrategy,
        });

        logger.info(
          `TOPIC_QUESTION_ASSOCIATED: exam_topic="${matchingTopic.exam_topic}", generated_topic="${generatedTopic}", question_id=${questionId}, strategy=${matchingStrategy}`,
          {
            exam_topic: matchingTopic.exam_topic,
            generated_topic: generatedTopic,
            question_id: questionId,
            topic_index: topicIndex,
            matching_strategy: matchingStrategy,
            structuredData: true,
          },
        );
      } else {
        // Pre-validated topic is no longer available, try fallback
        const firstAvailableIndex = updatedTopicList.findIndex(
          (topic) => topic.question_id === null,
        );

        if (firstAvailableIndex !== -1) {
          updatedTopicList[firstAvailableIndex] = {
            ...updatedTopicList[firstAvailableIndex],
            question_id: questionId,
          };

          associationsMade.push({
            exam_topic: updatedTopicList[firstAvailableIndex].exam_topic,
            question_id: questionId,
            topicIndex: firstAvailableIndex,
            matching_strategy: 'fallback',
          });

          logger.warn(
            `TOPIC_FALLBACK_ASSOCIATION: Pre-validated topic "${matchingTopic.exam_topic}" no longer available, assigned to "${updatedTopicList[firstAvailableIndex].exam_topic}"`,
            {
              generated_topic: generatedTopic,
              pre_validated_topic: matchingTopic.exam_topic,
              assigned_topic: updatedTopicList[firstAvailableIndex].exam_topic,
              question_id: questionId,
              topic_index: firstAvailableIndex,
              structuredData: true,
            },
          );
        } else {
          logger.error(
            `TOPIC_ASSOCIATION_FAILED: No available topic slots remaining for validated question`,
            {
              generated_topic: generatedTopic,
              question_id: questionId,
              pre_validated_topic: matchingTopic.exam_topic,
              remaining_topics: updatedTopicList.filter(
                (t) => t.question_id === null,
              ).length,
              structuredData: true,
            },
          );
        }
      }
    } else {
      // This shouldn't happen for validated questions, but handle as error
      logger.error(
        `VALIDATION_ERROR: Valid question without matching topic - this indicates a validation bug`,
        {
          generated_topic: generatedTopic,
          question_id: questionId,
          available_topics: updatedTopicList
            .filter((t) => t.question_id === null)
            .map((t) => t.exam_topic),
          structuredData: true,
        },
      );
    }
  });

  // Enhanced logging with matching strategy breakdown
  const strategyBreakdown = associationsMade.reduce((acc, assoc) => {
    acc[assoc.matching_strategy] = (acc[assoc.matching_strategy] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  logger.info(
    `TOPIC_ASSOCIATIONS_BATCH: ${associationsMade.length} topic-question associations completed`,
    {
      associations_count: associationsMade.length,
      strategy_breakdown: strategyBreakdown,
      associations: associationsMade.map((a) => ({
        exam_topic: a.exam_topic,
        question_id: a.question_id,
        strategy: a.matching_strategy,
      })),
      remaining_unassigned: updatedTopicList.filter(
        (t) => t.question_id === null,
      ).length,
      structuredData: true,
    },
  );

  return updatedTopicList;
}

/**
 * Checks if the exam has been processing for more than the specified timeout
 * @param exam_id - The exam identifier
 * @param timeoutMinutes - The timeout in minutes (default: 10)
 * @returns Object with timeout status and processing duration
 */
async function checkExamProcessingTimeout(
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
async function calculateAndLogExamGenerationTime(
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
async function updateExamPlanInRtdb(
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
      certification_name,
      batch_number,
      total_batches,
      custom_prompt_text,
      questions_per_batch,
    } = payload;

    // Get the most up-to-date topic list from RTDB (with question assignments)
    let examTopicList = await getExamTopicsFromRtdb(exam_id);

    // CRITICAL FIX: Detect and handle corrupted exam plans where all topics have question_ids on first batch
    // This addresses a race condition where the first batch processes before RTDB write completes,
    // causing all topics to incorrectly appear as already assigned. A 5-second delay has been added
    // to exam creation to prevent this, but this fix handles existing corrupted states.
    if (batch_number === 1) {
      const assignedTopicsCount = examTopicList.filter(
        (t) => t.question_id !== null,
      ).length;
      const totalTopicsCount = examTopicList.length;

      // If this is batch 1 and ALL topics already have questions assigned, this indicates a corrupted state
      if (assignedTopicsCount === totalTopicsCount && totalTopicsCount > 0) {
        logger.error(
          `CRITICAL: First batch processing detected corrupted exam plan - all ${totalTopicsCount} topics already have question_ids assigned`,
          {
            exam_id,
            batch_number,
            total_topics: totalTopicsCount,
            assigned_topics: assignedTopicsCount,
            corruption_detected: true,
            corruption_analysis: {
              all_question_ids_type: examTopicList.map((t) => ({
                exam_topic: t.exam_topic.substring(0, 20),
                question_id: t.question_id,
                question_id_type: typeof t.question_id,
                is_null: t.question_id === null,
                is_undefined: t.question_id === undefined,
                is_falsy: !t.question_id,
              })),
            },
            topics_sample: examTopicList.slice(0, 5).map((t) => ({
              exam_topic: t.exam_topic.substring(0, 30),
              question_id: t.question_id,
            })),
            structuredData: true,
          },
        );

        // Reset all question_ids to null for first batch processing
        // This fixes the corrupted state and allows normal processing
        examTopicList = examTopicList.map((topic) => ({
          ...topic,
          question_id: null,
        }));

        // Update the exam plan in RTDB with the reset state
        await updateExamPlanInRtdb(exam_id, examTopicList);

        logger.info(
          `CORRUPTION_FIX: Reset ${totalTopicsCount} topics to unassigned state for exam ${exam_id}`,
          {
            exam_id,
            batch_number,
            topics_reset: totalTopicsCount,
            structuredData: true,
          },
        );
      }
    }

    const currentUnassignedCount = examTopicList.filter(
      (t) => !t.question_id,
    ).length;

    if (batch_number > 1 && currentUnassignedCount === 0) {
      logger.warn(
        `POTENTIAL_ISSUE: Batch ${batch_number} has no unassigned topics but this is not batch 1`,
        {
          exam_id,
          batch_number,
          total_batches,
          total_topics: examTopicList.length,
          assigned_topics: examTopicList.length - currentUnassignedCount,
          unassigned_topics: currentUnassignedCount,
          possible_causes: [
            'Previous batch completed all work',
            'Concurrent batch processing',
            'Data corruption',
          ],
          structuredData: true,
        },
      );
    }

    const unassignedTopics = examTopicList.filter(
      (topic) => !topic.question_id,
    );

    // Limit topics to batch size for generation
    const topicsForThisBatch = unassignedTopics.slice(0, questions_per_batch);

    // Extract just the topic names for AI generation
    const topicNamesForGeneration = topicsForThisBatch.map(
      (topic) => topic.exam_topic,
    );

    // Calculate questions count based on batch size, not all unassigned topics
    const questions_to_generate = topicsForThisBatch.length;

    // Log detailed topic status for debugging
    logger.info(
      `EXAM_TOPIC_STATUS: exam_id=${exam_id}, batch=${batch_number}/${total_batches}`,
      {
        exam_id,
        batch_number,
        total_batches,
        total_topics: examTopicList.length,
        assigned_topics: examTopicList.filter((t) => t.question_id !== null)
          .length,
        unassigned_topics: unassignedTopics.length,
        topics_for_this_batch: topicsForThisBatch.length,
        questions_to_generate,
        batch_size_limit: questions_per_batch,
        current_batch_topics: topicsForThisBatch.map((t) => t.exam_topic),
        topic_sample: examTopicList.slice(0, 3).map((t) => ({
          exam_topic:
            t.exam_topic.substring(0, 50) +
            (t.exam_topic.length > 50 ? '...' : ''),
          has_question: t.question_id !== null,
          question_id: t.question_id,
        })),
        structuredData: true,
      },
    );

    // Log current processing time for this batch
    try {
      const timeoutCheck = await checkExamProcessingTimeout(exam_id, 999); // Use high timeout to get timing without timeout
      logger.info(
        `EXAM_BATCH_TIMING_START: exam_id=${exam_id}, batch=${batch_number}/${total_batches}, elapsed=${timeoutCheck.processingDurationMinutes}min`,
        {
          exam_id,
          batch_number,
          total_batches,
          questions_to_generate,
          elapsed_time_minutes: timeoutCheck.processingDurationMinutes,
          elapsed_time_seconds: timeoutCheck.processingDurationMinutes * 60,
          started_at: timeoutCheck.createdAt,
          structuredData: true,
        },
      );
    } catch {
      // Continue processing even if timing fails
    }

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
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id },
    });

    if (!exam) {
      logger.error(`Exam ${exam_id} not found`);
      res.status(404).json({ success: false, error: 'Exam not found' });
      return;
    }

    if (exam.exam_status !== ExamStatus.QUESTIONS_GENERATING) {
      logger.warn(
        `Exam ${exam_id} is not in QUESTIONS_GENERATING status, current status: ${exam.exam_status}`,
      );
      res.status(400).json({
        success: false,
        error: 'Exam is not in question generation state',
      });
      return;
    }

    try {
      logger.info(`EXAM_BATCH_QUESTION_GENERATOR_START: exam_id=${exam_id}, batch=${batch_number}
        | task_payload: ${JSON.stringify(payload)}`);

      // Log AI request start
      ExamGenerationLogger.logAIRequest({
        exam_id,
        batch_number,
        ai_service: 'gemini20Flash',
        certification_name,
        questions_requested: questions_to_generate,
      });

      const aiStartTime = Date.now();

      // Generate questions using the quiz generator
      const { quizGeneratorPromise } = await import(
        '../../../services/genkit/quizGenerator.js'
      );
      const quizGenerator = await quizGeneratorPromise;
      const generatedQuestions = await quizGenerator({
        // Use only unassigned topics for generation
        subject: certification_name,
        examTopicList: topicNamesForGeneration,
        exam_id,
        customPromptText: custom_prompt_text,
      });

      const aiDuration = Date.now() - aiStartTime;

      // Log AI response
      ExamGenerationLogger.logAIResponse({
        exam_id,
        batch_number,
        ai_service: 'gemini20Flash',
        questions_generated: generatedQuestions.length,
        duration_ms: aiDuration,
        success: true,
      });

      logger.info(
        `EXAM_BATCH_SUCCESS: exam_id=${exam_id}, batch=${batch_number}, generated=${generatedQuestions.length}`,
      );

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
        available_rtdb_topics: examTopicList
          .filter((t) => t.question_id === null)
          .map((t) => ({
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
      const validQuestions = validQuestionResults.map(
        (result) => result.question,
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
        // Use a transaction to ensure data consistency and improve performance
        const batchStartTime = Date.now();

        await prismaInstance.$transaction(async (prisma) => {
          // Batch create questions
          const questionsData = validQuestions.map((question) => ({
            cert_id,
            question_text: question.question,
            explanations: question.explanation,
            exam_topic: question.examTopic.trim().toLowerCase(),
            generated_from: exam_id,
            difficulty: null,
          }));

          const createdQuestions =
            await prisma.quizQuestion.createManyAndReturn({
              data: questionsData,
            });

          // Log each question creation with its ID and topic association
          createdQuestions.forEach((createdQuestion, index) => {
            const originalQuestion = validQuestions[index];
            logger.info(
              `QUESTION_CREATED: quiz_question_id=${createdQuestion.quiz_question_id}, exam_topic=${originalQuestion.examTopic}, exam_id=${exam_id}`,
              {
                quiz_question_id: createdQuestion.quiz_question_id,
                exam_topic: originalQuestion.examTopic,
                exam_id,
                batch_number,
                question_text_preview: createdQuestion.question_text.substring(
                  0,
                  100,
                ),
                cert_id,
                structuredData: true,
              },
            );
          });

          logger.info(
            `BATCH_QUESTIONS_CREATED: exam_id=${exam_id}, batch=${batch_number}, count=${createdQuestions.length}`,
            {
              exam_id,
              batch_number,
              questions_created: createdQuestions.length,
              question_ids: createdQuestions.map((q) => q.quiz_question_id),
              structuredData: true,
            },
          );

          // Update the topic list with the generated question IDs
          const associationStartTime = Date.now();
          examTopicList = updateTopicListWithQuestionIds(
            examTopicList,
            createdQuestions,
            validQuestionResults,
          );
          const associationDuration = Date.now() - associationStartTime;

          // Log summary after updating topic list
          logQuestionTopicAssociationSummary(
            exam_id,
            examTopicList,
            `after_batch_${batch_number}_creation`,
          );

          // Track association performance
          PerformanceMonitor.trackBatchOperation(
            'topic_question_association',
            createdQuestions.length,
            associationDuration,
            {
              exam_id,
              batch_number,
            },
          );

          // Immediately update the exam plan in RTDB with the updated topic assignments
          // This ensures question_id is associated with exam_topic right after creation
          const rtdbUpdateStartTime = Date.now();
          await updateExamPlanInRtdb(exam_id, examTopicList);
          const rtdbUpdateDuration = Date.now() - rtdbUpdateStartTime;

          // Track RTDB update performance
          PerformanceMonitor.trackDatabaseQuery(
            'rtdb_exam_plan_update',
            rtdbUpdateDuration,
            {
              exam_id,
              batch_number,
              topics_updated: examTopicList.length,
            },
          );

          // Verify RTDB update by checking the updated data
          const verificationStartTime = Date.now();
          const updatedPlan = await getRtdbValue(`exam_plans/${exam_id}`);
          const verificationDuration = Date.now() - verificationStartTime;

          if (updatedPlan && updatedPlan.questions) {
            const verifiedAssignments = updatedPlan.questions.filter(
              (q: any) => q.question_id !== null,
            );
            logger.info(
              `RTDB_UPDATE_VERIFIED: exam_id=${exam_id}, verified_assignments=${verifiedAssignments.length}`,
              {
                exam_id,
                batch_number,
                verified_assignments_count: verifiedAssignments.length,
                verification_duration_ms: verificationDuration,
                recently_assigned: createdQuestions.map(
                  (q) => q.quiz_question_id,
                ),
                structuredData: true,
              },
            );

            // Log summary after RTDB verification
            logQuestionTopicAssociationSummary(
              exam_id,
              updatedPlan.questions,
              `after_rtdb_verification_batch_${batch_number}`,
            );
          } else {
            logger.warn(
              `RTDB_UPDATE_VERIFICATION_FAILED: exam_id=${exam_id}, could not verify RTDB update`,
              {
                exam_id,
                batch_number,
                verification_duration_ms: verificationDuration,
                structuredData: true,
              },
            );
          }

          // Prepare answer options data for batch creation
          const optionsData: Array<{
            quiz_question_id: string;
            option_text: string;
            is_correct: boolean;
          }> = [];

          createdQuestions.forEach((createdQuestion, questionIndex) => {
            const question = validQuestions[questionIndex];

            // Validate choices before creating options
            if (!question.choices || !Array.isArray(question.choices)) {
              logger.error(
                `Invalid choices for question ${createdQuestion.quiz_question_id}`,
                {
                  exam_id,
                  batch_number,
                  question_id: createdQuestion.quiz_question_id,
                  choices: question.choices,
                  structuredData: true,
                },
              );
              return;
            }

            for (let i = 0; i < question.choices.length; i++) {
              optionsData.push({
                quiz_question_id: createdQuestion.quiz_question_id,
                option_text: question.choices[i],
                is_correct: i === question.answerIndex,
              });
            }
          });

          // Batch create answer options with better error handling
          let createdOptions: any[] = [];
          if (optionsData.length > 0) {
            try {
              await prisma.answerOption.createMany({
                data: optionsData,
                skipDuplicates: true,
              });

              // Retrieve the created options with their IDs for RTDB
              createdOptions = await prisma.answerOption.findMany({
                where: {
                  quiz_question_id: {
                    in: createdQuestions.map((q) => q.quiz_question_id),
                  },
                },
                orderBy: [{ quiz_question_id: 'asc' }, { option_id: 'asc' }],
              });

              logger.info(
                `Created ${optionsData.length} answer options for ${createdQuestions.length} questions`,
                {
                  exam_id,
                  batch_number,
                  options_created: optionsData.length,
                  questions_count: createdQuestions.length,
                  structuredData: true,
                },
              );
            } catch (optionsError) {
              logger.error(
                `Failed to create answer options for exam ${exam_id}:`,
                optionsError as any,
              );
              throw optionsError;
            }
          }

          // Update realtime database with exam topic information (removed quizQuestions to avoid path conflicts)
          await updateExamQuestionsInRtdb(
            exam_id,
            createdQuestions,
            validQuestions,
          );

          const batchDuration = Date.now() - batchStartTime;

          // Log database storage with structured logging
          ExamGenerationLogger.logDatabaseStore({
            exam_id,
            batch_number,
            questions_stored: createdQuestions.length,
            answer_options_stored: createdOptions.length,
            duration_ms: batchDuration,
            success: true,
          });

          // Log complete question creation to RTDB association flow
          logger.info(
            `QUESTION_TO_RTDB_FLOW_COMPLETE: exam_id=${exam_id}, batch=${batch_number}`,
            {
              exam_id,
              batch_number,
              flow_summary: {
                questions_created: createdQuestions.length,
                topics_associated: examTopicList.filter(
                  (t) => t.question_id !== null,
                ).length,
                rtdb_updated: true,
                total_duration_ms: batchDuration,
                association_duration_ms: associationDuration,
                rtdb_update_duration_ms: rtdbUpdateDuration,
              },
              question_topic_mappings: createdQuestions.map((q, idx) => ({
                question_id: q.quiz_question_id,
                exam_topic: validQuestions[idx].examTopic,
              })),
              structuredData: true,
            },
          );

          // Track batch operation performance
          PerformanceMonitor.trackBatchOperation(
            'quiz_questions_batch_create',
            createdQuestions.length,
            batchDuration,
            {
              exam_id,
              batch_number,
              total_options: createdOptions.length,
            },
          );

          logger.info(
            `BATCH_CREATE_SUCCESS: exam_id=${exam_id}, batch=${batch_number}, ` +
              `questions=${createdQuestions.length}, options=${createdOptions.length}, duration=${batchDuration}ms`,
          );
        });
      }

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

        // Dynamically calculate remaining batches needed based on actual remaining work
        const effectiveRemainingBatches = Math.ceil(
          remainingUnassignedTopics.length / questions_per_batch,
        );
        const adjustedTotalBatches = batch_number + effectiveRemainingBatches;

        logger.info(
          `EXAM_BATCH_CALCULATION: exam_id=${exam_id}, batch=${batch_number}`,
          {
            exam_id,
            current_batch: batch_number,
            original_total_batches: total_batches,
            remaining_unassigned_topics: remainingUnassignedTopics.length,
            questions_for_next_batch: questionsForNextBatch,
            effective_remaining_batches: effectiveRemainingBatches,
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
              processing_duration_minutes:
                timeoutCheck.processingDurationMinutes,
              timeout_threshold_minutes: timeoutCheck.timeoutThresholdMinutes,
              started_at: timeoutCheck.createdAt,
              reason: 'processing_timeout_exceeded',
              structuredData: true,
            },
          );

          // Mark exam as failed due to timeout
          await prismaInstance.examAttempt.update({
            where: { exam_id },
            data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
          });

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
              processing_duration_minutes:
                timeoutCheck.processingDurationMinutes,
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
          certification_name,
          batch_number: batch_number + 1,
          total_batches: adjustedTotalBatches, // Use adjusted total based on remaining work
          custom_prompt_text,
          questions_per_batch,
        };

        const delaySeconds = 15;

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
          // Update exam status to failed
          await prismaInstance.examAttempt.update({
            where: { exam_id },
            data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
          });

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
        },
      });
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

      // Update exam status to failed
      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
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
    logger.error('Error in task handler:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
