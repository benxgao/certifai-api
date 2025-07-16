import { Response } from 'express';
import logger from '../../services/firebase/logger';
import { CustomRequest } from '../../types';
import { quizGeneratorPromise } from '../../services/genkit/quizGenerator';
import prismaInstance, { ExamStatus } from '../../services/prisma';
import { createCloudTask } from '../../services/gcp/cloudTasks';
import {
  associateQuestionsWithExam,
  updateExamAfterQuestionAssociation,
} from '../../utils/examQuestionAssociation';
import { PerformanceMonitor } from '../../services/performance';
import { ExamGenerationLogger } from '../../services/exam-generation-logger';
import { ExamGenerationMetrics } from '../../services/exam-generation-metrics';
import { updateRtdbValue, getRtdbValue } from '../../services/firebase/rtdb';

interface TaskPayload {
  exam_id: string;
  cert_id: number;
  certification_name: string;
  examTopicList: string; // JSON stringified array of {exam_topic: string, question_id: string | null}
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
 * Retrieves exam topics from RTDB, falling back to payload if not found
 * @param exam_id - The exam identifier
 * @param fallbackTopicList - Fallback topic list from payload
 * @returns Promise resolving to the topic list
 */
async function getExamTopicsFromRtdb(
  exam_id: string,
  fallbackTopicList: ExamTopicItem[],
): Promise<ExamTopicItem[]> {
  try {
    const examPlanPath = `exam_plans/${exam_id}`;
    const examPlan = await getRtdbValue(examPlanPath);

    if (examPlan && examPlan.questions && Array.isArray(examPlan.questions)) {
      logger.info(
        `Retrieved ${examPlan.questions.length} topics from RTDB for exam ${exam_id}`,
      );
      return examPlan.questions;
    } else {
      logger.warn(
        `No exam plan found in RTDB for exam ${exam_id}, using fallback topics`,
      );
      return fallbackTopicList;
    }
  } catch (error) {
    logger.error(
      `Failed to retrieve exam plan from RTDB for exam ${exam_id}:`,
      error as any,
    );
    return fallbackTopicList;
  }
}

/**
 * Updates the realtime database with exam questions data
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
        quizQuestions: {},
        examTopics: {},
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
    }

    // Create question updates for RTDB
    const questionUpdates: Record<string, any> = {};
    const topicUpdates: Record<string, any> = {};

    createdQuestions.forEach((createdQuestion, index) => {
      const originalQuestion = validQuestions[index];
      const questionId = createdQuestion.quiz_question_id;
      const examTopic = originalQuestion.examTopic.trim().toLowerCase();

      // Add question data
      questionUpdates[`quizQuestions/${questionId}`] = {
        question_id: questionId,
        exam_topic: examTopic,
        question_text: createdQuestion.question_text,
        explanations: createdQuestion.explanations,
        cert_id: createdQuestion.cert_id,
        generated_from: exam_id,
        createdAt: new Date().toISOString(),
      };

      // Group questions by topic
      if (!topicUpdates[`examTopics/${examTopic}`]) {
        topicUpdates[`examTopics/${examTopic}`] = {
          topic_name: examTopic,
          question_ids: [],
          question_count: 0,
        };
      }

      topicUpdates[`examTopics/${examTopic}`].question_ids.push(questionId);
      topicUpdates[`examTopics/${examTopic}`].question_count += 1;
    });

    // Merge with existing data if any
    if (examData.quizQuestions) {
      Object.assign(questionUpdates, {
        quizQuestions: { ...examData.quizQuestions },
      });
    }
    if (examData.examTopics) {
      // Merge existing topics with new ones
      Object.keys(topicUpdates).forEach((topicPath) => {
        const topicKey = topicPath.replace('examTopics/', '');
        if (examData.examTopics[topicKey]) {
          // Merge existing topic data
          const existingTopic = examData.examTopics[topicKey];
          const newTopic = topicUpdates[topicPath];

          topicUpdates[topicPath] = {
            ...existingTopic,
            question_ids: [
              ...(existingTopic.question_ids || []),
              ...newTopic.question_ids,
            ],
            question_count:
              (existingTopic.question_count || 0) + newTopic.question_count,
          };
        }
      });
      Object.assign(topicUpdates, { examTopics: { ...examData.examTopics } });
    }

    // Update exam metadata
    const examMetaUpdates = {
      lastUpdated: new Date().toISOString(),
      totalQuestions: (examData.totalQuestions || 0) + createdQuestions.length,
      totalTopics: Object.keys({
        ...examData.examTopics,
        ...Object.fromEntries(
          Object.keys(topicUpdates)
            .filter((key) => key.startsWith('examTopics/'))
            .map((key) => [key.replace('examTopics/', ''), true]),
        ),
      }).length,
    };

    // Combine all updates
    const allUpdates = {
      ...questionUpdates,
      ...topicUpdates,
      ...examMetaUpdates,
    };

    // Update RTDB with all the data
    await updateRtdbValue(examPath, allUpdates);

    logger.info(
      `RTDB updated for exam ${exam_id}: ${
        createdQuestions.length
      } questions across ${Object.keys(topicUpdates).length} topics`,
      {
        exam_id,
        questionsAdded: createdQuestions.length,
        topicsUpdated: Object.keys(topicUpdates).length,
      },
    );
  } catch (error) {
    logger.error(`Failed to update RTDB for exam ${exam_id}:`, error as any);
    // Don't throw error - RTDB update failure shouldn't break the main flow
  }
}

/**
 * Updates the examTopicList with generated question IDs
 * @param examTopicList - The original topic list
 * @param createdQuestions - The questions created in the database
 * @param validQuestions - The original valid questions from AI generation
 * @returns Updated topic list with question IDs assigned
 */
function updateTopicListWithQuestionIds(
  examTopicList: ExamTopicItem[],
  createdQuestions: any[],
  validQuestions: any[],
): ExamTopicItem[] {
  const updatedTopicList = [...examTopicList];
  const associationsMade: Array<{
    exam_topic: string;
    question_id: string;
    topicIndex: number;
  }> = [];

  createdQuestions.forEach((createdQuestion, index) => {
    const originalQuestion = validQuestions[index];
    const questionId = createdQuestion.quiz_question_id;
    const examTopic = originalQuestion.examTopic.trim();

    // Find the corresponding topic in the list and update its question_id
    const topicIndex = updatedTopicList.findIndex(
      (topic) => topic.exam_topic === examTopic && topic.question_id === null,
    );

    if (topicIndex !== -1) {
      updatedTopicList[topicIndex] = {
        ...updatedTopicList[topicIndex],
        question_id: questionId,
      };

      associationsMade.push({
        exam_topic: examTopic,
        question_id: questionId,
        topicIndex,
      });

      logger.info(
        `TOPIC_QUESTION_ASSOCIATED: exam_topic=${examTopic}, question_id=${questionId}, topicIndex=${topicIndex}`,
        {
          exam_topic: examTopic,
          question_id: questionId,
          topic_index: topicIndex,
          structuredData: true,
        },
      );
    } else {
      logger.warn(
        `TOPIC_ASSOCIATION_FAILED: No available topic slot found for exam_topic=${examTopic}, question_id=${questionId}`,
        {
          exam_topic: examTopic,
          question_id: questionId,
          available_topics: updatedTopicList
            .filter((t) => t.question_id === null)
            .map((t) => t.exam_topic),
          structuredData: true,
        },
      );
    }
  });

  logger.info(
    `TOPIC_ASSOCIATIONS_BATCH: ${associationsMade.length} topic-question associations completed`,
    {
      associations_count: associationsMade.length,
      associations: associationsMade,
      remaining_unassigned: updatedTopicList.filter(
        (t) => t.question_id === null,
      ).length,
      structuredData: true,
    },
  );

  return updatedTopicList;
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
      await updateRtdbValue(examPlanPath, {
        questions: updatedTopicList,
        updated_at: Math.floor(Date.now() / 1000),
      });

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
      examTopicList: examTopicListRaw,
      batch_number,
      total_batches,
      custom_prompt_text,
      questions_per_batch,
    } = payload;

    // Parse examTopicList from JSON string to array
    let examTopicListFromPayload: ExamTopicItem[];
    try {
      examTopicListFromPayload =
        typeof examTopicListRaw === 'string'
          ? JSON.parse(examTopicListRaw)
          : examTopicListRaw;
    } catch (parseError) {
      logger.error(
        `Failed to parse examTopicList for exam ${exam_id}:`,
        parseError as any,
      );
      res.status(400).json({
        success: false,
        error: 'Invalid examTopicList format',
      });
      return;
    }

    // Get the most up-to-date topic list from RTDB (with question assignments)
    let examTopicList = await getExamTopicsFromRtdb(
      exam_id,
      examTopicListFromPayload,
    );

    // Filter topics that don't have questions assigned yet (question_id is null)
    const unassignedTopics = examTopicList.filter(
      (topic) => topic.question_id === null,
    );

    // Extract just the topic names for AI generation
    const topicNamesForGeneration = unassignedTopics.map(
      (topic) => topic.exam_topic,
    );

    // Calculate questions count from unassigned topics
    const questions_to_generate = unassignedTopics.length;

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
        questions_to_generate,
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
      )}`,
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

      // Log examTopic values for debugging
      const examTopics = generatedQuestions
        .map((q) => q.examTopic)
        .filter((t) => t);
      logger.info(`Generated examTopics: ${JSON.stringify(examTopics)}`, {
        exam_id,
        batch_number,
      });

      // Store questions in database using batch operations for better performance
      const validQuestions = generatedQuestions.filter((question) => {
        if (!question.examTopic || question.examTopic.trim() === '') {
          logger.warn(
            `Skipping question with missing examTopic: ${question.question?.substring(
              0,
              50,
            )}...`,
          );
          return false;
        }
        return true;
      });

      if (validQuestions.length === 0) {
        logger.warn(
          `No valid questions to store for exam ${exam_id}, batch ${batch_number}`,
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
            validQuestions,
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

          // Update realtime database with exam questions data
          await updateExamQuestionsInRtdb(
            exam_id,
            createdQuestions,
            validQuestions,
          );

          // Prepare answer options data for batch creation
          const optionsData: Array<{
            quiz_question_id: string;
            option_text: string;
            is_correct: boolean;
          }> = [];

          createdQuestions.forEach((createdQuestion, questionIndex) => {
            const question = validQuestions[questionIndex];
            for (let i = 0; i < question.choices.length; i++) {
              optionsData.push({
                quiz_question_id: createdQuestion.quiz_question_id,
                option_text: question.choices[i],
                is_correct: i === question.answerIndex,
              });
            }
          });

          // Batch create answer options
          if (optionsData.length > 0) {
            await prisma.answerOption.createMany({
              data: optionsData,
              skipDuplicates: true,
            });
          }

          const batchDuration = Date.now() - batchStartTime;

          // Log database storage with structured logging
          ExamGenerationLogger.logDatabaseStore({
            exam_id,
            batch_number,
            questions_stored: createdQuestions.length,
            answer_options_stored: optionsData.length,
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
              total_options: optionsData.length,
            },
          );

          logger.info(
            `BATCH_CREATE_SUCCESS: exam_id=${exam_id}, batch=${batch_number}, ` +
              `questions=${createdQuestions.length}, options=${optionsData.length}, duration=${batchDuration}ms`,
          );
        });
      }

      // Check if this is the last batch or if we should complete early
      let associationResult = null;

      // Calculate questions generated so far for logging and next batch calculation
      const questionsGenerated = batch_number * questions_per_batch;

      // For the next batch, find topics that still don't have questions assigned
      const remainingUnassignedTopics = examTopicList.filter(
        (topic) => topic.question_id === null,
      );

      // Determine if we should complete the exam:
      // 1. We've reached the planned total batches
      // 2. All topics have been assigned questions
      // 3. We've reached the target question count
      const shouldCompleteExam =
        batch_number >= total_batches ||
        remainingUnassignedTopics.length === 0 ||
        questionsGenerated >= (exam.total_questions || 0);

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
            questions_generated: questionsGenerated,
            remaining_unassigned_topics: remainingUnassignedTopics.length,
            target_questions: exam.total_questions,
            completion_reason: completionReason,
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

        // Log exam completion
        ExamGenerationLogger.logExamComplete({
          exam_id,
          total_questions_generated: questionsGenerated,
          total_questions_associated: associationResult.associatedQuestionCount,
          total_batches,
          status: 'READY',
        });

        logger.info(`EXAM_READY: exam_id=${exam_id}, status=READY`);
      } else {
        // Continue with next batch
        // Calculate remaining questions needed, ensuring we never go negative
        const remainingQuestions = Math.max(
          0,
          (exam.total_questions || 0) - questionsGenerated,
        );

        // Additional validation: Only create next batch if there are both questions remaining and unassigned topics
        if (remainingQuestions <= 0) {
          logger.warn(
            `No more questions needed for exam ${exam_id}. Total: ${exam.total_questions}, Generated: ${questionsGenerated}`,
          );
          // Mark exam as ready since we've generated enough questions
          await updateExamAfterQuestionAssociation(exam_id, {
            success: true,
            associatedQuestionCount: questionsGenerated,
            selectedQuestionIds: [],
            certification: null,
          });

          res.status(200).json({
            success: true,
            message: `Exam generation completed. Total questions generated: ${questionsGenerated}`,
            data: {
              exam_id,
              batch_number,
              total_batches,
              questions_generated: generatedQuestions.length,
              is_final_batch: true,
              completion_reason: 'target_questions_reached',
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

          // Mark exam as ready since all topics have questions
          await updateExamAfterQuestionAssociation(exam_id, {
            success: true,
            associatedQuestionCount: examTopicList.filter(
              (t) => t.question_id !== null,
            ).length,
            selectedQuestionIds: [],
            certification: null,
          });

          res.status(200).json({
            success: true,
            message: `Exam generation completed. All topics have questions assigned.`,
            data: {
              exam_id,
              batch_number,
              total_batches,
              questions_generated: generatedQuestions.length,
              is_final_batch: true,
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

        const nextBatchPayload = {
          exam_id,
          cert_id,
          certification_name,
          examTopicList: JSON.stringify(examTopicList), // Pass the full updated topic list
          batch_number: batch_number + 1,
          total_batches: adjustedTotalBatches, // Use adjusted total based on remaining work
          custom_prompt_text,
          questions_per_batch,
        };

        const nextTaskName = await createCloudTask(
          'exam-questions-queue',
          `${process.env.GCP_TASKS_HOST}/delegators/tasks/take`,
          nextBatchPayload,
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
            questions_generated_so_far: questionsGenerated,
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

      res.status(200).json({
        success: true,
        message: `Successfully processed batch ${batch_number}/${total_batches}`,
        data: {
          exam_id,
          batch_number,
          total_batches,
          questions_generated: generatedQuestions.length,
          questions_associated: associationResult?.associatedQuestionCount || 0,
          is_final_batch: shouldCompleteExam,
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
