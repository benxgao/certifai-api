import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import { PerformanceMonitor } from '../../../services/performance';
import { ExamGenerationLogger } from '../../../services/exam-generation-logger';
import { getRtdbValue } from '../../../services/firebase/rtdb';
import {
  TaskPayload,
  logQuestionTopicAssociationSummary,
  updateTopicListWithQuestionIds,
} from './helper';
import { updateExamQuestionsInRtdb, updateExamPlanInRtdb } from './rtdb';

/**
 * Stores valid questions in database and updates RTDB
 */
export const storeQuestionsInDatabase = async (
  validQuestions: any[],
  validQuestionResults: any[],
  examTopicList: any[],
  payload: TaskPayload,
): Promise<any[]> => {
  const { exam_id, batch_number, cert_id } = payload;

  // Use a transaction to ensure data consistency and improve performance
  const batchStartTime = Date.now();

  return await prismaInstance.$transaction(async (prisma) => {
    // Batch create questions
    const questionsData = validQuestions.map((question) => ({
      cert_id,
      question_text: question.question,
      explanations: question.explanation,
      exam_topic: question.examTopic.trim().toLowerCase(),
      generated_from: exam_id,
      difficulty: null,
    }));

    const createdQuestions = await prisma.quizQuestion.createManyAndReturn({
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
    const updatedExamTopicList = updateTopicListWithQuestionIds(
      examTopicList,
      createdQuestions,
      validQuestionResults,
    );
    const associationDuration = Date.now() - associationStartTime;

    // Log summary after updating topic list
    logQuestionTopicAssociationSummary(
      exam_id,
      updatedExamTopicList,
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
    await updateExamPlanInRtdb(exam_id, updatedExamTopicList);
    const rtdbUpdateDuration = Date.now() - rtdbUpdateStartTime;

    // Track RTDB update performance
    PerformanceMonitor.trackDatabaseQuery(
      'rtdb_exam_plan_update',
      rtdbUpdateDuration,
      {
        exam_id,
        batch_number,
        topics_updated: updatedExamTopicList.length,
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
          recently_assigned: createdQuestions.map((q) => q.quiz_question_id),
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
    await updateExamQuestionsInRtdb(exam_id, createdQuestions, validQuestions);

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
          topics_associated: updatedExamTopicList.filter(
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

    return updatedExamTopicList;
  });
};
