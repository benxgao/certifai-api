import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import { PerformanceMonitor } from '../../../services/performance';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import { getRtdbValue } from '../../../services/firebase/rtdb';
import {
  BatchWriteOptimizer,
  QuestionBatchHelper,
} from '../../../services/database/batchWriteOptimizer';
import {
  TaskPayload,
  logQuestionTopicAssociationSummary,
  updateTopicListWithQuestionIds,
} from './helper';
import { updateExamQuestionsInRtdb, updateExamPlanInRtdb } from './rtdb';

/**
 * Stores valid questions in database and updates RTDB - OPTIMIZED VERSION
 */
export const storeQuestionsInDatabase = async (
  validQuestions: any[],
  validQuestionResults: any[],
  examTopicList: any[],
  payload: TaskPayload,
): Promise<any[]> => {
  const { exam_id, batch_number, cert_id } = payload;
  const batchStartTime = Date.now();

  logger.info(`DEBUG_DB_STORE_START: exam_id=${exam_id}, batch=${batch_number}`, {
    exam_id,
    batch_number,
    questions_to_store: validQuestions.length,
    question_results_count: validQuestionResults.length,
    cert_id,
    structuredData: true,
  });

  // Use optimized batch operations for better performance
  return await BatchWriteOptimizer.batchOperations(
    prismaInstance,
    [
      {
        operation: async (tx) => {
          logger.info(`DEBUG_DB_BATCH_OP_START: exam_id=${exam_id}, batch=${batch_number}`, {
            exam_id,
            batch_number,
            operation: 'batch_create_questions',
            timestamp: Date.now(),
            structuredData: true,
          });

          // Step 1: Prepare and batch create questions
          const { questionsData, getOptionsData } =
            QuestionBatchHelper.prepareBatchData(
              validQuestions,
              cert_id,
              exam_id,
            );

          logger.info(`DEBUG_QUESTIONS_DATA_PREPARED: exam_id=${exam_id}, batch=${batch_number}`, {
            exam_id,
            batch_number,
            prepared_questions_count: questionsData.length,
            first_question_has_text: !!questionsData[0]?.question,
            first_question_has_options: !!questionsData[0]?.first_answer_index,
            structuredData: true,
          });

          // Batch create questions with optimized data preparation
          const createdQuestions = await tx.quizQuestion.createManyAndReturn({
            data: questionsData,
            skipDuplicates: true,
          });

          logger.info(`DEBUG_QUESTIONS_CREATED: exam_id=${exam_id}, batch=${batch_number}`, {
            exam_id,
            batch_number,
            created_count: createdQuestions.length,
            prepared_count: questionsData.length,
            mismatch: createdQuestions.length !== questionsData.length,
            first_question_id: createdQuestions[0]?.quiz_question_id,
            structuredData: true,
          });

          // Log question creation performance
          logger.info(
            `BATCH_QUESTIONS_CREATED: exam_id=${exam_id}, batch=${batch_number}, count=${createdQuestions.length}`,
            {
              exam_id,
              batch_number,
              questions_created: createdQuestions.length,
              question_ids: createdQuestions.map(
                (q: any) => q.quiz_question_id,
              ),
              structuredData: true,
            },
          );

          // Step 2: Prepare and batch create answer options
          const optionsData = getOptionsData(createdQuestions);
          let createdOptionsCount = 0;

          logger.info(`DEBUG_OPTIONS_DATA_PREPARED: exam_id=${exam_id}, batch=${batch_number}`, {
            exam_id,
            batch_number,
            options_count: optionsData.length,
            questions_with_options: createdQuestions.length,
            structuredData: true,
          });

          if (optionsData.length > 0) {
            await tx.answerOption.createMany({
              data: optionsData,
              skipDuplicates: true,
            });
            createdOptionsCount = optionsData.length;

            logger.info(`DEBUG_OPTIONS_CREATED: exam_id=${exam_id}, batch=${batch_number}`, {
              exam_id,
              batch_number,
              created_options_count: createdOptionsCount,
              prepared_options_count: optionsData.length,
              mismatch: createdOptionsCount !== optionsData.length,
              structuredData: true,
            });

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

          logger.info(`DEBUG_TOPIC_ASSOCIATION_COMPLETE: exam_id=${exam_id}, batch=${batch_number}`, {
            exam_id,
            batch_number,
            association_duration_ms: associationDuration,
            topics_updated: updatedExamTopicList.length,
            topics_with_questions: updatedExamTopicList.filter((t: any) => t.question_id !== null).length,
            structuredData: true,
          });

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
        const verifiedAssignments = updatedPlan.questions.filter(
          (q: any) => q.question_id !== null,
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
        rtdbError as any,
      );
      // Don't fail the entire operation for RTDB issues
      return updatedExamTopicList;
    }
  });
};
