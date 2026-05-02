import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequestHandler } from '../../../../types/express';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
import { OptimizedRateLimitService } from '../../../../services/optimizedRateLimit';
import { CacheManager } from '../../../../services/cache';
import { ExamGenerationLogger } from '../../../../services/exam-generation-logger';
import { getRtdbValue } from '../../../../services/firebase/rtdb';
import { BatchWriteOptimizer } from '../../../../services/database/batchWriteOptimizer';
import { validateExamQueueReadiness } from '../../../../utils/examQueueManager';
import {
  ExamGenerationTaskService,
  ExamGenerationTaskPayload,
} from '../../../../services/cloudTasks/examGenerationTaskService';

const DEFAULT_NUMBER_OF_QUESTIONS = 20;
const MAX_NUMBER_OF_QUESTIONS = 100; // Set a reasonable max
const QUESTIONS_PER_BATCH = 10; // Number of questions to generate per task
export const MAX_EXAMS_PER_24_HOURS = 3; // Maximum number of exams allowed per user in 24 hours

type TransactionClient = Parameters<
  Parameters<typeof prismaInstance.$transaction>[0]
>[0];

type CreatedExam = {
  exam_id: string;
  user_id: string;
  cert_id: number;
};

/**
 * Creates a new exam and queues questions for generation
 *
 * Sample payload:
 * POST /api/users/{user_id}/exams
 * {
 *   "cert_id": 123,
 *   "numberOfQuestions": 25,
 *   "customPromptText": "Focus on cloud security and best practices"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Exam creation initiated. Questions are being generated asynchronously.",
 *   "data": {
 *     "exam_id": "uuid",
 *     "user_id": "uuid",
 *     "cert_id": 123,
 *     "status": "QUESTIONS_GENERATING",
 *     "total_questions": 25,
 *     "token_cost": 50,
 *     "total_batches": 3,
 *     "custom_prompt": "Focus on cloud security and best practices"
 *   }
 * }
 */
const handler: AuthenticatedRequestHandler<
  { numberOfQuestions?: number; customPromptText?: string },
  Record<string, unknown>,
  { user_id: string; cert_id: string }
> = async (req, res): Promise<void> => {
  const operationStart = Date.now();
  const timingAudit = {
    total_operation: 0,
    prisma_operations: {
      user_query: 0,
      certification_query: 0,
      exam_create: 0,
      exam_updates: 0,
    },
    ai_operations: {
      topic_generation: 0,
    },
    external_services: {
      rate_limit_check: 0,
      cloud_task_creation: 0,
      cache_operations: 0,
    },
  };

  try {
    const { user_id, cert_id } = req.params;
    const { numberOfQuestions: numQuestionsBody, customPromptText } = req.body;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!user_id) {
      res
        .status(400)
        .json({ success: false, error: 'User ID is required in path.' });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    if (!cert_id || isNaN(parseInt(cert_id))) {
      res.status(400).json({
        success: false,
        error: 'cert_id is required in path and must be a valid number.',
      });
      return;
    }

    const certIdNumber = parseInt(cert_id, 10);

    const requestedNumberOfQuestions =
      typeof numQuestionsBody === 'number' && numQuestionsBody > 0
        ? Math.min(numQuestionsBody, MAX_NUMBER_OF_QUESTIONS)
        : DEFAULT_NUMBER_OF_QUESTIONS;

    logger.info(`EXAM_TRACK - 0. EXAM_CREATE_INIT:
      user_id=${user_id}
      cert_id=${certIdNumber}
      questions=${requestedNumberOfQuestions}
    `);

    // 1. Find the user by the provided user_id (internal UUID)
    const userQueryStart = Date.now();
    const user = await prismaInstance.user.findUnique({
      where: { user_id: user_id },
    });
    const userQueryDuration = Date.now() - userQueryStart;

    timingAudit.prisma_operations.user_query = userQueryDuration;

    logger.info('EXAM_TRACK - 1. AUDIT_PRISMA_USER_QUERY', {
      operation: 'user.findUnique',
      duration_ms: userQueryDuration,
      user_id: user_id,
      found: !!user,
    });

    if (!user) {
      res
        .status(404)
        .json({ success: false, error: `User with ID: ${user_id} not found.` });
      return;
    }

    // 2. Authorization: Check if the firebase_user_id from token matches the user's firebase_user_id
    if (user.firebase_user_id !== firebaseUserIdFromToken) {
      logger.warn(
        `Forbidden: Firebase user ${firebaseUserIdFromToken} attempted to create exam for user ${user_id}.`,
      );
      res.status(403).json({
        success: false,
        error:
          'Forbidden: You can only create exams for your own user account.',
      });
      return;
    }

    // 3. Check rate limit: Maximum 3 exams per 24 hours (using optimized Redis-based rate limiting)
    const rateLimitStart = Date.now();
    const rateLimitResult =
      await OptimizedRateLimitService.checkExamRateLimit(user_id);

    timingAudit.external_services.rate_limit_check =
      Date.now() - rateLimitStart;

    logger.info(`EXAM_TRACK - 2. RATE_LIMIT_VALIDATION_PASSED:
      Rate limit check passed for user ${user_id}: ${rateLimitResult.currentCount}/${MAX_EXAMS_PER_24_HOURS} exams used`);

    // 4. Verify the certification exists
    const certQueryStart = Date.now();
    const certification = await prismaInstance.certification.findUnique({
      where: { cert_id: certIdNumber },
    });
    const certQueryDuration = Date.now() - certQueryStart;

    timingAudit.prisma_operations.certification_query = certQueryDuration;

    logger.info('EXAM_TRACK - 3. AUDIT_PRISMA_CERTIFICATION_QUERY', {
      operation: 'certification.findUnique',
      duration_ms: certQueryDuration,
      cert_id: certIdNumber,
      found: !!certification,
    });

    if (!certification) {
      res.status(404).json({
        success: false,
        error: `Certification with ID: ${certIdNumber} not found.`,
      });
      return;
    }

    // 5. Calculate token cost and check if user has enough credit tokens
    const tokenCost = requestedNumberOfQuestions * 2;

    if (user.credit_tokens < tokenCost) {
      res.status(400).json({
        success: false,
        error: `Insufficient credit tokens. Required: ${tokenCost}, Available: ${user.credit_tokens}`,
      });
      return;
    }

    logger.info(`EXAM_TRACK - 4. TOKEN_VALIDATION_PASSED:
      User ${user.user_id} has sufficient credit tokens.
      Required: ${tokenCost}
      Available: ${user.credit_tokens}
    `);

    // 6. Create the exam with optimized batch operations for better performance
    const examCreateStart = Date.now();

    // Use BatchWriteOptimizer for atomic exam creation and related operations
    const examOperations = [
      {
        operation: (tx: TransactionClient) =>
          tx.examAttempt.create({
            data: {
              user: { connect: { user_id: user.user_id } },
              certification: { connect: { cert_id: certIdNumber } },
              exam_status: ExamStatus.QUESTIONS_GENERATING,
              total_questions: requestedNumberOfQuestions,
              token_cost: tokenCost,
              custom_prompt_text: customPromptText || null,
            },
          }),
        description: 'Create exam attempt with initial status',
      },
    ];

    const examResults = await BatchWriteOptimizer.batchOperations<CreatedExam>(
      prismaInstance,
      examOperations,
      {
        useTransaction: true,
        batchSize: 1,
      },
    );

    const [newExam] = examResults;

    if (!newExam) {
      throw new Error('Failed to create exam attempt');
    }

    const examCreateDuration = Date.now() - examCreateStart;

    timingAudit.prisma_operations.exam_create = examCreateDuration;

    logger.info('EXAM_TRACK - 5. AUDIT_PRISMA_EXAM_CREATE_OPTIMIZED', {
      operation: 'examAttempt.create_batch',
      duration_ms: examCreateDuration,
      exam_id: newExam.exam_id,
      user_id: user.user_id,
      cert_id: certIdNumber,
      total_questions: requestedNumberOfQuestions,
      token_cost: tokenCost,
      optimization: 'batch_write_optimizer',
    });

    logger.info(`EXAM_TRACK - 6. EXAM_CREATE_SUCCESS:
      exam_id=${newExam.exam_id}
      user_id=${user.user_id}
      status=QUESTIONS_GENERATING
    `);

    // 7. Execute post-creation operations in parallel for better performance
    const postCreationStart = Date.now();

    await Promise.all([
      // Record exam creation in rate limit tracker
      OptimizedRateLimitService.recordExamCreation(user_id, newExam.exam_id),
      // Invalidate user exam cache since new exam was created and is now generating
      CacheManager.invalidateUserExamCacheForGenerationChange(
        user_id,
        'exam_creation_started',
      ),
      // Invalidate rate limit cache since user created a new exam
      CacheManager.invalidateUserRateLimitCache(user_id),
    ]);

    const postCreationDuration = Date.now() - postCreationStart;
    timingAudit.external_services.rate_limit_check = postCreationDuration / 2; // Split timing
    timingAudit.external_services.cache_operations = postCreationDuration / 2;

    // 7. Generate exam topics using examPlanner and store in RTDB
    logger.info(`EXAM_TRACK - 7. EXAM_TOPIC_GENERATION_START:
      exam_id=${newExam.exam_id}
      total_questions=${requestedNumberOfQuestions}
    `);

    try {
      // Fetch the last completed exam with a report for adaptive learning from Firestore
      let lastExamReport: string | null = null;
      try {
        const { examReportFirestore } =
          await import('../../../../services/firebase/examReportFirestore.js');

        const lastExamReportDoc =
          await examReportFirestore.getLastExamReportForUser(
            user.user_id,
            certIdNumber.toString(),
            certification.name,
          );

        if (lastExamReportDoc?.text_summary) {
          // Use structured data directly for exam planning
          const structuredDataJson = JSON.stringify(lastExamReportDoc);
          lastExamReport = structuredDataJson;

          logger.info(
            `EXAM_TRACK - 8. ADAPTIVE_LEARNING_FIRESTORE
            Found last exam report for user ${user.user_id} on certification ${certification.name}`,
            {
              exam_id: newExam.exam_id,
              last_exam_id: lastExamReportDoc.exam_id,
              last_exam_generated: lastExamReportDoc.generated_at,
              report_length: lastExamReport.length,
              topics_analyzed: lastExamReportDoc.topic_performance.length,
              overall_score: lastExamReportDoc.overall_score,
              weak_topics: lastExamReportDoc.topic_performance.filter(
                (t) => t.performance_category === 'weak',
              ).length,
              average_topics: lastExamReportDoc.topic_performance.filter(
                (t) => t.performance_category === 'average',
              ).length,
              strong_topics: lastExamReportDoc.topic_performance.filter(
                (t) => t.performance_category === 'strong',
              ).length,
              structuredData: true,
              storage: 'firestore',
              enhanced_adaptive_learning: true,
            },
          );
        } else {
          logger.info(
            `EXAM_TRACK - 8. ADAPTIVE_LEARNING_FIRESTORE:
            No previous exam report found for user ${user.user_id} on certification ${certification.name}`,
            {
              exam_id: newExam.exam_id,
              structuredData: true,
              storage: 'firestore',
            },
          );
        }
      } catch (reportFetchError) {
        logger.warn(
          `Failed to fetch last exam report from Firestore for adaptive learning, continuing with standard generation`,
          {
            exam_id: newExam.exam_id,
            user_id: user.user_id,
            cert_id: certIdNumber,
            error_message: reportFetchError instanceof Error ? reportFetchError.message : String(reportFetchError),
            error_type: reportFetchError instanceof Error ? reportFetchError.constructor.name : typeof reportFetchError,
            error_stack: reportFetchError instanceof Error ? reportFetchError.stack : undefined,
            storage: 'firestore',
            structuredData: true,
          },
        );
      }

      // Use examPlanner to generate topics and store in RTDB
      const topicGenerationStart = Date.now();
      const { examPlannerPromise } =
        await import('../../../../services/genkit/examPlanner.js');
      const examPlanner = await examPlannerPromise;
      const examPlan = await examPlanner({
        cert_name: certification.name,
        totalQuestionCounts: requestedNumberOfQuestions,
        exam_id: newExam.exam_id,
        cert_id: certification.cert_id.toString(),
        user_id: user.user_id,
        customPrompt: customPromptText || null,
        lastExamReport: lastExamReport,
      });
      timingAudit.ai_operations.topic_generation =
        Date.now() - topicGenerationStart;

      logger.info(`EXAM_TRACK - 9. EXAM_PLAN_GENERATE_BY_AI:
        | examPlan: ${JSON.stringify(examPlan, null, 2)}`);

      logger.info(
        `EXAM_TRACK - 10. EXAM_TOPICS_GENERATED:
        exam_id=${newExam.exam_id}
        topics_count=${examPlan.questions.length}`,
        { exam_id: newExam.exam_id },
      );

      // 8. Calculate batches and start question generation via Cloud Tasks
      // Note: Use actual generated topics count, not requested questions count
      const actualTopicsCount = examPlan.questions.length;
      const totalBatches = Math.ceil(actualTopicsCount / QUESTIONS_PER_BATCH);

      logger.info(
        `EXAM_TRACK - 11. EXAM_BATCH_START:
        exam_id=${newExam.exam_id}
        requested_questions=${requestedNumberOfQuestions}
        actual_topics=${actualTopicsCount}
        batches=${totalBatches}`,
        {
          exam_id: newExam.exam_id,
          requested_questions: requestedNumberOfQuestions,
          actual_topics_generated: actualTopicsCount,
          questions_per_batch: QUESTIONS_PER_BATCH,
          total_batches: totalBatches,
          structuredData: true,
        },
      );

      // Use the generated topics from examPlanner
      const firstBatchPayload: ExamGenerationTaskPayload = {
        exam_id: newExam.exam_id,
        cert_id: certification.cert_id,
        certification_name: certification.name,
        batch_number: 1,
        total_batches: totalBatches,
        custom_prompt_text: customPromptText || '',
        questions_per_batch: QUESTIONS_PER_BATCH,
        last_exam_report: lastExamReport || undefined,
      };

      // CRITICAL FIX: Verify exam plan is accessible in RTDB before creating Cloud Task
      // This prevents race conditions where the batch processor runs before RTDB write completes
      try {
        const verificationPath = `exam_plans/${newExam.exam_id}`;
        const verificationResult = await getRtdbValue(verificationPath);

        if (
          !verificationResult ||
          !verificationResult.questions ||
          !Array.isArray(verificationResult.questions)
        ) {
          logger.error(
            `EXAM_PLAN_VERIFICATION_FAILED: Could not verify exam plan in RTDB before creating batch task`,
            {
              exam_id: newExam.exam_id,
              verification_path: verificationPath,
              verification_result: verificationResult,
              structuredData: true,
            },
          );
          throw new Error(
            'Exam plan verification failed - RTDB write may not have completed',
          );
        }

        logger.info(
          `EXAM_TRACK - 12. EXAM_PLAN_VERIFIED:
          Successfully verified exam plan in RTDB with ${verificationResult.questions.length} topics`,
          {
            exam_id: newExam.exam_id,
            topics_count: verificationResult.questions.length,
            structuredData: true,
          },
        );
      } catch (verificationError) {
        logger.error(
          `EXAM_PLAN_VERIFICATION_ERROR: Failed to verify exam plan before batch creation`,
          {
            exam_id: newExam.exam_id,
            error_message: verificationError instanceof Error ? verificationError.message : String(verificationError),
            error_type: verificationError instanceof Error ? verificationError.constructor.name : typeof verificationError,
            error_stack: verificationError instanceof Error ? verificationError.stack : undefined,
            verification_path: `exam_plans/${newExam.exam_id}`,
            structuredData: true,
          },
        );
        throw verificationError;
      }

      // CRITICAL FIX: Ensure Cloud Tasks queue exists before creating tasks
      // This prevents failures when the queue has been accidentally deleted or not yet created
      try {
        logger.info(
          `EXAM_TRACK - 13. QUEUE_VALIDATION_START:
          Ensuring exam generation queues exist before task creation`,
          {
            exam_id: newExam.exam_id,
            structuredData: true,
          },
        );

        await validateExamQueueReadiness();

        logger.info(
          `EXAM_TRACK - 14. QUEUE_VALIDATION_SUCCESS: All exam generation queues are ready`,
          {
            exam_id: newExam.exam_id,
            structuredData: true,
          },
        );
      } catch (queueError) {
        logger.error(
          `QUEUE_VALIDATION_ERROR: Failed to ensure queues exist before task creation`,
          {
            exam_id: newExam.exam_id,
            error:
              queueError instanceof Error
                ? queueError.message
                : String(queueError),
            structuredData: true,
          },
        );
        throw new Error(
          `Queue validation failed: ${
            queueError instanceof Error ? queueError.message : 'Unknown error'
          }`,
        );
      }

      const cloudTaskStart = Date.now();

      const delaySeconds = 1;

      logger.info(
        `EXAM_TRACK - 15. FIRST_BATCH_DELAYED:
        Scheduling first batch with 1-second delay to prevent RTDB race condition`,
        {
          exam_id: newExam.exam_id,
          batch_number: 1,
          delay_seconds: delaySeconds,
          scheduled_time: new Date(
            Date.now() + delaySeconds * 1000,
          ).toISOString(),
          current_time: new Date().toISOString(),
          reason: 'prevent_rtdb_race_condition',
          structuredData: true,
        },
      );

      const taskName =
        await ExamGenerationTaskService.getInstance().createFirstBatchTask(
          firstBatchPayload,
        );
      const cloudTaskEnd = Date.now();
      timingAudit.external_services.cloud_task_creation =
        cloudTaskEnd - cloudTaskStart;

      if (!taskName) {
        // If task creation fails, update exam status to failed using optimized batch operation
        const examUpdateTaskFailStart = Date.now();

        const failureOperations = [
          {
            operation: (tx: TransactionClient) =>
              tx.examAttempt.update({
                where: { exam_id: newExam.exam_id },
                data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
              }),
            description:
              'Update exam status to failed due to task creation failure',
          },
        ];

        await BatchWriteOptimizer.batchOperations<unknown>(
          prismaInstance,
          failureOperations,
          { useTransaction: true, batchSize: 1 },
        );

        const examUpdateTaskFailDuration = Date.now() - examUpdateTaskFailStart;

        timingAudit.prisma_operations.exam_updates +=
          examUpdateTaskFailDuration;

        logger.info('AUDIT_PRISMA_EXAM_UPDATE_TASK_FAIL_OPTIMIZED', {
          operation: 'examAttempt.update_batch',
          duration_ms: examUpdateTaskFailDuration,
          exam_id: newExam.exam_id,
          new_status: 'QUESTION_GENERATION_FAILED',
          reason: 'task_creation_failed',
          optimization: 'batch_write_optimizer',
        });

        // Log exam creation failure
        ExamGenerationLogger.logExamFailure({
          exam_id: newExam.exam_id,
          reason: 'task_creation_failed',
          error: 'Failed to create initial cloud task',
        });

        logger.info(
          `EXAM_CREATE_FAILED: exam_id=${newExam.exam_id}, reason=task_creation_failed`,
        );

        res.status(500).json({
          success: false,
          error: 'Failed to start question generation process.',
        });

        // Log timing for task creation failure
        timingAudit.total_operation = Date.now() - operationStart;
        logger.info('AUDIT_OPERATION_TIMING_SUMMARY', {
          exam_id: newExam.exam_id,
          operation: 'createExam_task_creation_failed',
          timing_breakdown: timingAudit,
        });

        return;
      }

      // Log successful exam creation start
      ExamGenerationLogger.logExamCreationStart({
        exam_id: newExam.exam_id,
        user_id,
        cert_id: certification.cert_id,
        certification_name: certification.name,
        total_questions: requestedNumberOfQuestions,
        total_batches: totalBatches,
        custom_prompt: customPromptText || null,
      });

      // Calculate total operation time and log comprehensive timing audit
      timingAudit.total_operation = Date.now() - operationStart;

      logger.info('AUDIT_OPERATION_TIMING_SUMMARY', {
        exam_id: newExam.exam_id,
        operation: 'createExam_success',
        timing_breakdown: timingAudit,
        performance_metrics: {
          total_prisma_time: Object.values(
            timingAudit.prisma_operations,
          ).reduce((a, b) => a + b, 0),
          total_external_time: Object.values(
            timingAudit.external_services,
          ).reduce((a, b) => a + b, 0),
          ai_processing_percentage: Math.round(
            (timingAudit.ai_operations.topic_generation /
              timingAudit.total_operation) *
              100,
          ),
          prisma_percentage: Math.round(
            (Object.values(timingAudit.prisma_operations).reduce(
              (a, b) => a + b,
              0,
            ) /
              timingAudit.total_operation) *
              100,
          ),
        },
      });

      res.status(202).json({
        success: true,
        message:
          'Exam creation initiated. Topics generated and questions are being generated asynchronously. First batch will start in 5 seconds to ensure optimal processing.',
        data: {
          exam_id: newExam.exam_id,
          api_user_id: newExam.user_id, // Our internal UUID for API operations
          cert_id: newExam.cert_id,
          status: ExamStatus.QUESTIONS_GENERATING,
          total_questions: requestedNumberOfQuestions,
          token_cost: tokenCost,
          total_batches: totalBatches,
          topics_generated: examPlan.questions.length,
          custom_prompt: customPromptText || '',
          user_id: newExam.user_id, // @deprecated Use api_user_id instead
        },
      });
    } catch (topicGenerationError) {
      logger.error(
        `Failed to generate exam topics for exam ${newExam.exam_id}:`,
        {
          error_message:
            topicGenerationError instanceof Error
              ? topicGenerationError.message
              : String(topicGenerationError),
          error_type:
            topicGenerationError instanceof Error
              ? topicGenerationError.constructor.name
              : typeof topicGenerationError,
          error_stack:
            topicGenerationError instanceof Error
              ? topicGenerationError.stack
              : undefined,
        },
      );

      // Update exam status to failed if topic generation fails using optimized batch operation
      const examUpdateFailStart = Date.now();

      const topicFailureOperations = [
        {
          operation: (tx: TransactionClient) =>
            tx.examAttempt.update({
              where: { exam_id: newExam.exam_id },
              data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
            }),
          description:
            'Update exam status to failed due to topic generation failure',
        },
      ];

      await BatchWriteOptimizer.batchOperations<unknown>(
        prismaInstance,
        topicFailureOperations,
        { useTransaction: true, batchSize: 1 },
      );

      const examUpdateFailDuration = Date.now() - examUpdateFailStart;

      timingAudit.prisma_operations.exam_updates += examUpdateFailDuration;

      logger.info('AUDIT_PRISMA_EXAM_UPDATE_FAIL_OPTIMIZED', {
        operation: 'examAttempt.update_batch',
        duration_ms: examUpdateFailDuration,
        exam_id: newExam.exam_id,
        new_status: 'QUESTION_GENERATION_FAILED',
        reason: 'topic_generation_failed',
        optimization: 'batch_write_optimizer',
      });

      // Log exam creation failure
      ExamGenerationLogger.logExamFailure({
        exam_id: newExam.exam_id,
        reason: 'topic_generation_failed',
        error:
          topicGenerationError instanceof Error
            ? topicGenerationError.message
            : 'Unknown topic generation error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate exam topics. Please try again.',
      });

      // Log timing for failed topic generation
      timingAudit.total_operation = Date.now() - operationStart;
      logger.info('AUDIT_OPERATION_TIMING_SUMMARY', {
        exam_id: newExam.exam_id,
        operation: 'createExam_topic_generation_failed',
        timing_breakdown: timingAudit,
      });

      return;
    }
  } catch (error) {
    // Log timing for general errors
    timingAudit.total_operation = Date.now() - operationStart;

    // Enhanced error logging with full context for debugging 500 errors
    const errorContext = {
      operation: 'createExam_general_error',
      timing_breakdown: timingAudit,
      error_message: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_stack: error instanceof Error ? error.stack : undefined,
      user_id: (req.params?.user_id || 'unknown'),
      cert_id: (req.params?.cert_id || 'unknown'),
      num_questions: (req.body?.numberOfQuestions || 'unknown'),
      structuredData: true,
    };

    logger.error('AUDIT_OPERATION_TIMING_ERROR', errorContext);
    logger.error('EXAM_CREATION_FAILED_WITH_500', {
      ...errorContext,
      full_error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : error,
    });

    if (
      error instanceof Error &&
      error.message.includes('Foreign key constraint failed')
    ) {
      res.status(400).json({
        success: false,
        error: 'Invalid user_id or cert_id provided.',
      });
    } else if (
      error instanceof Error &&
      error.message.includes('Queue setup failed')
    ) {
      res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable. Queue setup failed.',
      });
    } else if (
      error instanceof Error &&
      error.message.includes('verification failed')
    ) {
      res.status(500).json({
        success: false,
        error: 'Exam plan verification failed. Please retry.',
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
};

export default handler;
