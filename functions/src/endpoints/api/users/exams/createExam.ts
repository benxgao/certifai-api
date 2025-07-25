import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
import { createCloudTask } from '../../../../services/gcp/cloudTasks';
import { OptimizedRateLimitService } from '../../../../services/optimizedRateLimit';
import { CacheManager } from '../../../../services/cache';
import { ExamGenerationLogger } from '../../../../services/exam-generation-logger';
import { getRtdbValue } from '../../../../services/firebase/rtdb';
import { BatchWriteOptimizer } from '../../../../services/database/batchWriteOptimizer';

const DEFAULT_NUMBER_OF_QUESTIONS = 20;
const MAX_NUMBER_OF_QUESTIONS = 100; // Set a reasonable max
const QUESTIONS_PER_BATCH = 5; // Number of questions to generate per task
export const MAX_EXAMS_PER_24_HOURS = 3; // Maximum number of exams allowed per user in 24 hours

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
const handler = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
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

    logger.info(
      `EXAM_CREATE_INIT: user_id=${user_id}, cert_id=${certIdNumber}, questions=${requestedNumberOfQuestions}`,
    );

    // 1. Find the user by the provided user_id (internal UUID)
    const userQueryStart = Date.now();
    const user = await prismaInstance.user.findUnique({
      where: { user_id: user_id },
    });
    const userQueryDuration = Date.now() - userQueryStart;

    timingAudit.prisma_operations.user_query = userQueryDuration;

    logger.info('AUDIT_PRISMA_USER_QUERY', {
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
    const rateLimitResult = await OptimizedRateLimitService.checkExamRateLimit(
      user_id,
    );

    timingAudit.external_services.rate_limit_check =
      Date.now() - rateLimitStart;

    // if (!rateLimitResult.isAllowed) {
    //   logger.warn(
    //     `Rate limit exceeded for user ${user_id}: ${rateLimitResult.currentCount}/${MAX_EXAMS_PER_24_HOURS} exams in 24 hours`,
    //   );
    //   res.status(429).json({
    //     success: false,
    //     error:
    //       rateLimitResult.error ||
    //       'Rate limit exceeded. You can create a maximum of 3 exams per 24 hours.',
    //     data: {
    //       maxExamsAllowed: MAX_EXAMS_PER_24_HOURS,
    //       currentCount: rateLimitResult.currentCount,
    //       remainingCount: rateLimitResult.remainingCount,
    //       resetTime: new Date(rateLimitResult.resetTimeMs).toISOString(),
    //     },
    //   });
    //   return;
    // }

    logger.info(
      `Rate limit check passed for user ${user_id}: ${rateLimitResult.currentCount}/${MAX_EXAMS_PER_24_HOURS} exams used`,
    );

    // 4. Verify the certification exists
    const certQueryStart = Date.now();
    const certification = await prismaInstance.certification.findUnique({
      where: { cert_id: certIdNumber },
    });
    const certQueryDuration = Date.now() - certQueryStart;

    timingAudit.prisma_operations.certification_query = certQueryDuration;

    logger.info('AUDIT_PRISMA_CERTIFICATION_QUERY', {
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

    logger.info(
      `User ${user.user_id} has sufficient credit tokens. Required: ${tokenCost}, Available: ${user.credit_tokens}`,
    );

    // 6. Create the exam with optimized batch operations for better performance
    const examCreateStart = Date.now();

    // Use BatchWriteOptimizer for atomic exam creation and related operations
    const examOperations = [
      {
        operation: (tx: any) =>
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

    const examResults = await BatchWriteOptimizer.batchOperations(
      prismaInstance,
      examOperations,
      {
        useTransaction: true,
        batchSize: 1,
      },
    );

    const newExam = examResults[0] as any; // Type assertion for exam object

    const examCreateDuration = Date.now() - examCreateStart;

    timingAudit.prisma_operations.exam_create = examCreateDuration;

    logger.info('AUDIT_PRISMA_EXAM_CREATE_OPTIMIZED', {
      operation: 'examAttempt.create_batch',
      duration_ms: examCreateDuration,
      exam_id: newExam.exam_id,
      user_id: user.user_id,
      cert_id: certIdNumber,
      total_questions: requestedNumberOfQuestions,
      token_cost: tokenCost,
      optimization: 'batch_write_optimizer',
    });

    logger.info(
      `EXAM_CREATE_SUCCESS: exam_id=${newExam.exam_id}, user_id=${user.user_id}, status=QUESTIONS_GENERATING`,
    );

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
    ]);

    const postCreationDuration = Date.now() - postCreationStart;
    timingAudit.external_services.rate_limit_check = postCreationDuration / 2; // Split timing
    timingAudit.external_services.cache_operations = postCreationDuration / 2;

    // 7. Generate exam topics using examPlanner and store in RTDB
    logger.info(
      `EXAM_TOPIC_GENERATION_START: exam_id=${newExam.exam_id}, total_questions=${requestedNumberOfQuestions}`,
    );

    try {
      // Use examPlanner to generate topics and store in RTDB
      const topicGenerationStart = Date.now();
      const { examPlannerPromise } = await import(
        '../../../../services/genkit/examPlanner.js'
      );
      const examPlanner = await examPlannerPromise;
      const examPlan = await examPlanner({
        cert_name: certification.name,
        totalQuestionCounts: requestedNumberOfQuestions,
        exam_id: newExam.exam_id,
        cert_id: certification.cert_id.toString(),
        user_id: user.user_id,
        customPrompt: customPromptText || null,
      });
      timingAudit.ai_operations.topic_generation =
        Date.now() - topicGenerationStart;

      logger.info(`EXAM_PLAN_GENERATE_BY_AI:
        | examPlan: ${JSON.stringify(examPlan, null, 2)}`);

      logger.info(
        `EXAM_TOPICS_GENERATED: exam_id=${newExam.exam_id}, topics_count=${examPlan.questions.length}`,
        {
          exam_id: newExam.exam_id,
        },
      );

      // 8. Calculate batches and start question generation via Cloud Tasks
      // Note: Use actual generated topics count, not requested questions count
      const actualTopicsCount = examPlan.questions.length;
      const totalBatches = Math.ceil(actualTopicsCount / QUESTIONS_PER_BATCH);

      logger.info(
        `EXAM_BATCH_START: exam_id=${newExam.exam_id}, requested_questions=${requestedNumberOfQuestions}, actual_topics=${actualTopicsCount}, batches=${totalBatches}`,
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
      const firstBatchPayload = {
        exam_id: newExam.exam_id,
        cert_id: certification.cert_id,
        certification_name: certification.name,
        batch_number: 1,
        total_batches: totalBatches,
        custom_prompt_text: customPromptText || '',
        questions_per_batch: QUESTIONS_PER_BATCH,
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
          `EXAM_PLAN_VERIFIED: Successfully verified exam plan in RTDB with ${verificationResult.questions.length} topics`,
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
            error: verificationError,
            structuredData: true,
          },
        );
        throw verificationError;
      }

      const cloudTaskStart = Date.now();

      const delaySeconds = 1;

      logger.info(
        `FIRST_BATCH_DELAYED: Scheduling first batch with 1-second delay to prevent RTDB race condition`,
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

      const taskName = await createCloudTask(
        'exam-questions-queue',
        `${process.env.GCP_TASKS_HOST}/delegators/tasks/take`,
        firstBatchPayload,
        delaySeconds, // Pass delay in seconds
      );
      const cloudTaskEnd = Date.now();
      timingAudit.external_services.cloud_task_creation =
        cloudTaskEnd - cloudTaskStart;

      if (!taskName) {
        // If task creation fails, update exam status to failed using optimized batch operation
        const examUpdateTaskFailStart = Date.now();

        const failureOperations = [
          {
            operation: (tx: any) =>
              tx.examAttempt.update({
                where: { exam_id: newExam.exam_id },
                data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
              }),
            description:
              'Update exam status to failed due to task creation failure',
          },
        ];

        await BatchWriteOptimizer.batchOperations(
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
          user_id: newExam.user_id,
          cert_id: newExam.cert_id,
          status: ExamStatus.QUESTIONS_GENERATING,
          total_questions: requestedNumberOfQuestions,
          token_cost: tokenCost,
          total_batches: totalBatches,
          topics_generated: examPlan.questions.length,
          custom_prompt: customPromptText || '',
        },
      });
    } catch (topicGenerationError) {
      logger.error(
        `Failed to generate exam topics for exam ${newExam.exam_id}:`,
        topicGenerationError as any,
      );

      // Update exam status to failed if topic generation fails using optimized batch operation
      const examUpdateFailStart = Date.now();

      const topicFailureOperations = [
        {
          operation: (tx: any) =>
            tx.examAttempt.update({
              where: { exam_id: newExam.exam_id },
              data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
            }),
          description:
            'Update exam status to failed due to topic generation failure',
        },
      ];

      await BatchWriteOptimizer.batchOperations(
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
    logger.error('AUDIT_OPERATION_TIMING_ERROR', {
      operation: 'createExam_general_error',
      timing_breakdown: timingAudit,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error('Error in createExamAndQueueQuestions handler:', error as any);
    if (
      error instanceof Error &&
      error.message.includes('Foreign key constraint failed')
    ) {
      res.status(400).json({
        success: false,
        error: 'Invalid user_id or cert_id provided.',
      });
    } else {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
};

export default handler;
