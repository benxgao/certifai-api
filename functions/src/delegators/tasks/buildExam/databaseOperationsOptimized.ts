import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import { PerformanceMonitor } from '../../../services/performance';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import { getRtdbValue } from '../../../services/firebase/rtdb';
import { QuizItem } from '../../../types/genkit';
import {
  BatchWriteOptimizer,
  QuestionBatchHelper,
} from '../../../services/database/batchWriteOptimizer';
import {
  TaskPayload,
  ExamTopicItem,
  logQuestionTopicAssociationSummary,
  updateTopicListWithQuestionIds,
} from './helper';
import { updateExamQuestionsInRtdb, updateExamPlanInRtdb } from './rtdb';

/**
 * Stores valid questions in database and updates RTDB - OPTIMIZED VERSION
 */
export const storeQuestionsInDatabase = async (
  validQuestions: QuizItem[],
  validQuestionResults: Array<{ question: QuizItem; matchingTopic: ExamTopicItem | null }>,
  examTopicList: ExamTopicItem[],
  payload: TaskPayload,
): Promise<ExamTopicItem[]> => {
  const { exam_id, batch_number, cert_id } = payload;
  const batchStartTime = Date.now();

  // Use optimized batch operations for better performance
  return await BatchWriteOptimizer.batchOperations(
    prismaInstance,
    [
      {
        operation: async (tx) => {
          // Step 1: Prepare and batch create questions
          const { questionsData, getOptionsData } =
            QuestionBatchHelper.prepareBatchData(
              validQuestions,
              cert_id,
              exam_id,
            );

          // Batch create questions with optimized data preparation
          const createdQuestions = await tx.quizQuestion.createManyAndReturn({
            data: questionsData,
            skipDuplicates: true,
          });

          // Log question creation performance
          logger.info(
            `BATCH_QUESTIONS_CREATED: exam_id=${exam_id}, batch=${batch_number}, count=${createdQuestions.length}`,
            {
              exam_id,
              batch_number,
              questions_created: createdQuestions.length,
              question_ids: createdQuestions.map(
                (q) => q.quiz_question_id,
              ),
              structuredData: true,
            },
          );

          // Step 2: Prepare and batch create answer options
          const optionsData = getOptionsData(createdQuestions);
          let createdOptionsCount = 0;

          if (optionsData.length > 0) {
            await tx.answerOption.createMany({
              data: optionsData,
              skipDuplicates: true,
            });
            createdOptionsCount = optionsData.length;

            logger.info(
              `BATCH_OPTIONS_CREATED: exam_id=${exam_id}, batch=${batch_number}, count=${createdOptionsCount}`,
              {
                exam_id,
                batch_number,
                options_created: createdOptionsCount,
                questions_count: createdQuestions.length,
                structuredData: true,
              },
            );
          }

          // Step 3: Update topic list and track associations
          const associationStartTime = Date.now();
          const updatedExamTopicList = updateTopicListWithQuestionIds(
            examTopicList,
            createdQuestions,
            validQuestionResults,
          );
          const associationDuration = Date.now() - associationStartTime;

          // Log performance metrics
          const totalBatchDuration = Date.now() - batchStartTime;

          PerformanceMonitor.trackBatchOperation(
            'quiz_questions_batch_create_optimized',
            createdQuestions.length,
            totalBatchDuration,
            {
              exam_id,
              batch_number,
              total_options: createdOptionsCount,
              association_duration_ms: associationDuration,
            },
          );

          // Log database storage with structured logging
          ExamGenerationLogger.logDatabaseStore({
            exam_id,
            batch_number,
            questions_stored: createdQuestions.length,
            answer_options_stored: createdOptionsCount,
            duration_ms: totalBatchDuration,
            success: true,
          });

          return {
            createdQuestions,
            updatedExamTopicList,
            optionsCount: createdOptionsCount,
          };
        },
        description: `Optimized batch create for exam ${exam_id} batch ${batch_number}`,
      },
    ],
    {
      batchSize: 1, // Single operation but wrapped for error handling
      useTransaction: true,
      maxRetries: 3,
    },
  ).then(async (results) => {
    const { createdQuestions, updatedExamTopicList, optionsCount } = results[0];

    // Post-transaction operations (RTDB updates)
    const rtdbStartTime = Date.now();

    try {
      // Update RTDB operations outside transaction for better performance
      await Promise.all([
        updateExamPlanInRtdb(exam_id, updatedExamTopicList),
        updateExamQuestionsInRtdb(exam_id, createdQuestions, validQuestions),
      ]);

      const rtdbDuration = Date.now() - rtdbStartTime;

      PerformanceMonitor.trackDatabaseQuery(
        'rtdb_updates_parallel',
        rtdbDuration,
        {
          exam_id,
          batch_number,
          topics_updated: updatedExamTopicList.length,
        },
      );

      // Verify RTDB update
      const verificationStartTime = Date.now();
      const updatedPlan = await getRtdbValue(`exam_plans/${exam_id}`);
      const verificationDuration = Date.now() - verificationStartTime;

      if (updatedPlan && updatedPlan.questions) {
        const questions = updatedPlan.questions as Array<{ question_id: string | null }>;
        const verifiedAssignments = questions.filter(
          (q) => q.question_id !== null,
        );

        logger.info(
          `OPTIMIZED_FLOW_COMPLETE: exam_id=${exam_id}, batch=${batch_number}`,
          {
            exam_id,
            batch_number,
            flow_summary: {
              questions_created: createdQuestions.length,
              options_created: optionsCount,
              topics_associated: verifiedAssignments.length,
              rtdb_updated: true,
              total_duration_ms: Date.now() - batchStartTime,
              rtdb_duration_ms: rtdbDuration,
              verification_duration_ms: verificationDuration,
            },
            performance_improvement: 'Using optimized batch operations',
            structuredData: true,
          },
        );

        logQuestionTopicAssociationSummary(
          exam_id,
          updatedPlan.questions,
          `optimized_batch_${batch_number}_complete`,
        );
      }

      logger.info(
        `OPTIMIZED_BATCH_SUCCESS: exam_id=${exam_id}, batch=${batch_number}, ` +
          `questions=${createdQuestions.length}, options=${optionsCount}, ` +
          `total_duration=${Date.now() - batchStartTime}ms`,
      );

      return updatedExamTopicList;
    } catch (rtdbError) {
      logger.error(
        `RTDB update failed for exam ${exam_id} batch ${batch_number}:`,
        { error: rtdbError instanceof Error ? rtdbError.message : String(rtdbError) },
      );
      // Don't fail the entire operation for RTDB issues
      return updatedExamTopicList;
    }
  });
};
