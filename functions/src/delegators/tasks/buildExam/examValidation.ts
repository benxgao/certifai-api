import logger from '../../../services/firebase/logger';
import prismaInstance, { ExamStatus } from '../../../services/prisma';
import { ExamAttempt } from '../../../types/prisma';
import { updateExamPlanInRtdb, checkExamProcessingTimeout } from './rtdb';
import { TaskPayload, ExamTopicItem } from './helper';

/**
 * Detects and fixes corrupted exam plans on first batch processing
 */
export const handleCorruptedExamPlan = async (
  examTopicList: ExamTopicItem[],
  exam_id: string,
  batch_number: number,
): Promise<ExamTopicItem[]> => {
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
      const resetTopicList = examTopicList.map((topic) => ({
        ...topic,
        question_id: null,
      }));

      // Update the exam plan in RTDB with the reset state
      await updateExamPlanInRtdb(exam_id, resetTopicList);

      logger.info(
        `CORRUPTION_FIX: Reset ${totalTopicsCount} topics to unassigned state for exam ${exam_id}`,
        {
          exam_id,
          batch_number,
          topics_reset: totalTopicsCount,
          structuredData: true,
        },
      );

      return resetTopicList;
    }
  }

  return examTopicList;
};

/**
 * Prepares topics for the current batch and validates processing state
 */
export const prepareBatchTopics = async (
  examTopicList: ExamTopicItem[],
  payload: TaskPayload,
): Promise<{
  topicsForThisBatch: ExamTopicItem[];
  topicNamesForGeneration: string[];
  questions_to_generate: number;
}> => {
  const { exam_id, batch_number, total_batches, questions_per_batch } = payload;

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

  const unassignedTopics = examTopicList.filter((topic) => !topic.question_id);

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

  return {
    topicsForThisBatch,
    topicNamesForGeneration,
    questions_to_generate,
  };
};

/**
 * Validates exam state and returns exam if valid
 */
export const validateExamState = async (exam_id: string): Promise<ExamAttempt> => {
  const exam = await prismaInstance.examAttempt.findUnique({
    where: { exam_id },
  });

  if (!exam) {
    throw new Error('Exam not found');
  }

  if (exam.exam_status !== ExamStatus.QUESTIONS_GENERATING) {
    throw new Error('Exam is not in question generation state');
  }

  return exam;
};
