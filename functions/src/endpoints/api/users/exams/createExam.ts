import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
import { createCloudTask } from '../../../../services/gcp/cloudTasks';
import { OptimizedRateLimitService } from '../../../../services/optimizedRateLimit';
import { CacheManager } from '../../../../services/cache';

const DEFAULT_NUMBER_OF_QUESTIONS = 20;
const MAX_NUMBER_OF_QUESTIONS = 100; // Set a reasonable max
const QUESTIONS_PER_BATCH = 100; // Number of questions to generate per task
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
    const user = await prismaInstance.user.findUnique({
      where: { user_id: user_id },
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
    const rateLimitResult =
      await OptimizedRateLimitService.checkExamRateLimit(user_id);
    if (!rateLimitResult.isAllowed) {
      logger.warn(
        `Rate limit exceeded for user ${user_id}: ${rateLimitResult.currentCount}/${MAX_EXAMS_PER_24_HOURS} exams in 24 hours`,
      );
      res.status(429).json({
        success: false,
        error:
          rateLimitResult.error ||
          'Rate limit exceeded. You can create a maximum of 3 exams per 24 hours.',
        data: {
          maxExamsAllowed: MAX_EXAMS_PER_24_HOURS,
          currentCount: rateLimitResult.currentCount,
          remainingCount: rateLimitResult.remainingCount,
          resetTime: new Date(rateLimitResult.resetTimeMs).toISOString(),
        },
      });
      return;
    }

    logger.info(
      `Rate limit check passed for user ${user_id}: ${rateLimitResult.currentCount}/${MAX_EXAMS_PER_24_HOURS} exams used`,
    );

    // 4. Verify the certification exists
    const certification = await prismaInstance.certification.findUnique({
      where: { cert_id: certIdNumber },
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

    // 6. Create the exam with QUESTIONS_GENERATING status and store token cost
    const newExam = await prismaInstance.examAttempt.create({
      data: {
        user: { connect: { user_id: user.user_id } },
        certification: { connect: { cert_id: certIdNumber } },
        exam_status: ExamStatus.QUESTIONS_GENERATING,
        total_questions: requestedNumberOfQuestions,
        token_cost: tokenCost,
        custom_prompt_text: customPromptText || null,
      },
    });

    logger.info(
      `EXAM_CREATE_SUCCESS: exam_id=${newExam.exam_id}, user_id=${user.user_id}, status=QUESTIONS_GENERATING`,
    );

    // Record exam creation in rate limit tracker
    await OptimizedRateLimitService.recordExamCreation(
      user_id,
      newExam.exam_id,
    );

    // Invalidate user exam cache since new exam was created
    await CacheManager.invalidateUserExamCache(user_id);

    // 7. Calculate batches and start question generation via Cloud Tasks
    const totalBatches = Math.ceil(
      requestedNumberOfQuestions / QUESTIONS_PER_BATCH,
    );

    logger.info(
      `EXAM_BATCH_START: exam_id=${newExam.exam_id}, total_questions=${requestedNumberOfQuestions}, batches=${totalBatches}`,
    );

    // Create the first task to start the recursive generation
    const firstBatchPayload = {
      exam_id: newExam.exam_id,
      cert_id: certification.cert_id,
      certification_name: certification.name,
      questions_to_generate: Math.min(
        QUESTIONS_PER_BATCH,
        requestedNumberOfQuestions,
      ),
      batch_number: 1,
      total_batches: totalBatches,
      custom_prompt_text: customPromptText || '',
      questions_per_batch: QUESTIONS_PER_BATCH,
    };

    const taskName = await createCloudTask(
      'exam-questions-queue',
      `${process.env.GCP_TASKS_HOST}/delegators/tasks/take`,
      firstBatchPayload,
    );

    if (!taskName) {
      // If task creation fails, update exam status to failed
      await prismaInstance.examAttempt.update({
        where: { exam_id: newExam.exam_id },
        data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
      });

      logger.info(
        `EXAM_CREATE_FAILED: exam_id=${newExam.exam_id}, reason=task_creation_failed`,
      );

      res.status(500).json({
        success: false,
        error: 'Failed to start question generation process.',
      });
      return;
    }

    res.status(202).json({
      success: true,
      message:
        'Exam creation initiated. Questions are being generated asynchronously.',
      data: {
        exam_id: newExam.exam_id,
        user_id: newExam.user_id,
        cert_id: newExam.cert_id,
        status: ExamStatus.QUESTIONS_GENERATING,
        total_questions: requestedNumberOfQuestions,
        token_cost: tokenCost,
        total_batches: totalBatches,
        custom_prompt: customPromptText || '',
      },
    });
  } catch (error) {
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
