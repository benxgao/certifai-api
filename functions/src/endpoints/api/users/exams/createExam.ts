import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';
import { createCloudTask } from '../../../../services/gcp/cloudTasks';

const DEFAULT_NUMBER_OF_QUESTIONS = 20;
const MAX_NUMBER_OF_QUESTIONS = 100; // Set a reasonable max
const QUESTIONS_PER_BATCH = 10; // Number of questions to generate per task

const handler = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id } = req.params;
    const { cert_id, numberOfQuestions: numQuestionsBody } = req.body;
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

    if (typeof cert_id !== 'number') {
      res.status(400).json({
        success: false,
        error: 'cert_id (number) is required in body.',
      });
      return;
    }

    const requestedNumberOfQuestions =
      typeof numQuestionsBody === 'number' && numQuestionsBody > 0
        ? Math.min(numQuestionsBody, MAX_NUMBER_OF_QUESTIONS)
        : DEFAULT_NUMBER_OF_QUESTIONS;

    logger.info(
      `createExamAndQueueQuestions: initialized for user_id: ${user_id}, cert_id: ${cert_id}, questions: ${requestedNumberOfQuestions}`,
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

    // 3. Verify the certification exists
    const certification = await prismaInstance.certification.findUnique({
      where: { cert_id: cert_id },
    });

    if (!certification) {
      res.status(404).json({
        success: false,
        error: `Certification with ID: ${cert_id} not found.`,
      });
      return;
    }

    // 4. Create the exam with QUESTIONS_GENERATING status
    const newExam = await prismaInstance.examAttempt.create({
      data: {
        user: { connect: { user_id: user.user_id } },
        certification: { connect: { cert_id: cert_id } },
        exam_status: 'QUESTIONS_GENERATING',
        total_questions: requestedNumberOfQuestions,
      },
    });

    logger.info(
      `Successfully created exam record ID: ${newExam.exam_id} for user ${user.user_id}. Status: QUESTIONS_GENERATING.`,
    );

    // 5. Calculate batches and start question generation via Cloud Tasks
    const totalBatches = Math.ceil(
      requestedNumberOfQuestions / QUESTIONS_PER_BATCH,
    );

    logger.info(
      `Starting question generation for exam ${newExam.exam_id}: ${requestedNumberOfQuestions} questions in ${totalBatches} batches`,
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
        data: { exam_status: 'QUESTION_GENERATION_FAILED' },
      });

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
        status: 'QUESTIONS_GENERATING',
        total_questions: requestedNumberOfQuestions,
        total_batches: totalBatches,
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
