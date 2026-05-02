import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequestHandler } from '../../../../types/express';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
import {
  associateQuestionsWithExam,
  updateCertificationStatusOnFirstExam,
} from '../../../../utils/examQuestionAssociation';
import { CacheManager } from '../../../../services/cache';

const handler: AuthenticatedRequestHandler<
  unknown,
  Record<string, unknown>,
  { exam_id: string }
> = async (req, res): Promise<void> => {
  try {
    const { exam_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!exam_id) {
      res.status(400).json({
        success: false,
        error: 'Exam ID is required in path.',
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase token missing.',
      });
      return;
    }

    logger.info(`updateExam: Starting exam update for exam_id: ${exam_id}`);

    // Get exam details
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id },
      include: {
        user: true,
        certification: {
          select: {
            cert_id: true,
            name: true,
            min_quiz_counts: true,
            max_quiz_counts: true,
          },
        },
      },
    });

    if (!exam) {
      res.status(404).json({
        success: false,
        error: 'Exam not found.',
      });
      return;
    }

    // Verify user has access to this exam
    if (exam.user.firebase_user_id !== firebaseUserIdFromToken) {
      res.status(403).json({
        success: false,
        error: 'Access denied: You can only update your own exams.',
      });
      return;
    }

    // Check if exam is in a state that allows updates
    if (
      exam.exam_status === ExamStatus.COMPLETED ||
      exam.exam_status === ExamStatus.IN_PROGRESS
    ) {
      res.status(400).json({
        success: false,
        error: 'Cannot update exam that is already in progress or completed.',
      });
      return;
    }

    const { cert_id } = exam.certification;

    // Get existing exam user answers
    const existingAnswers = await prismaInstance.examUserAnswer.findMany({
      where: { exam_id },
      select: { quiz_question_id: true },
    });

    const currentQuestionCount = existingAnswers.length;
    const existingQuestionIds = new Set(
      existingAnswers.map((answer) => answer.quiz_question_id),
    );

    // Get target question count from exam or use certification defaults
    const targetQuestionCount =
      exam.total_questions ||
      Math.min(
        exam.certification.max_quiz_counts,
        50, // Default max questions per exam
      );

    logger.info(
      `updateExam: Current questions: ${currentQuestionCount}, Target: ${targetQuestionCount}, ` +
        `Certification: ${exam.certification.name} (min: ${exam.certification.min_quiz_counts}, max: ${exam.certification.max_quiz_counts})`,
    );

    // Check if question count matches expectations
    if (currentQuestionCount === targetQuestionCount) {
      logger.info(`updateExam: Question count is correct for exam ${exam_id}`);
      res.status(200).json({
        success: true,
        message: 'Exam questions are already correctly associated.',
        data: {
          exam_id,
          current_questions: currentQuestionCount,
          target_questions: targetQuestionCount,
          status: exam.exam_status,
          token_cost: exam.token_cost,
        },
      });
      return;
    }

    logger.info(
      `updateExam: Question count mismatch for exam ${exam_id}. ` +
        'Selecting questions from database...',
    );

    // Calculate how many more questions we need
    const questionsNeeded = targetQuestionCount - currentQuestionCount;

    if (questionsNeeded <= 0) {
      // We have too many questions, need to remove some
      const questionsToRemove = Math.abs(questionsNeeded);
      const questionsToRemoveIds = existingAnswers
        .slice(0, questionsToRemove)
        .map((answer) => answer.quiz_question_id);

      await prismaInstance.examUserAnswer.deleteMany({
        where: {
          exam_id,
          quiz_question_id: {
            in: questionsToRemoveIds,
          },
        },
      });

      logger.info(
        `updateExam: Removed ${questionsToRemove} excess questions from exam ${exam_id}`,
      );

      // Update exam with correct count
      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: {
          total_questions: targetQuestionCount,
          exam_status: ExamStatus.READY,
        },
      });

      // Update certification status if this is the first exam for the certification
      await updateCertificationStatusOnFirstExam(
        exam.user.user_id,
        cert_id,
        exam_id,
      );

      // Invalidate user exam cache when exam status changes to READY
      await CacheManager.invalidateUserExamCacheForGenerationChange(
        exam.user.user_id,
        'manual_exam_update_ready',
      );

      // Get final count for response
      const finalAnswers = await prismaInstance.examUserAnswer.findMany({
        where: { exam_id },
        select: { quiz_question_id: true },
      });

      res.status(200).json({
        success: true,
        message: 'Exam questions have been updated successfully.',
        data: {
          exam_id,
          previous_questions: currentQuestionCount,
          final_questions: finalAnswers.length,
          target_questions: targetQuestionCount,
          status: ExamStatus.READY,
          token_cost: exam.token_cost,
          certification: {
            cert_id,
            name: exam.certification.name,
            min_quiz_counts: exam.certification.min_quiz_counts,
            max_quiz_counts: exam.certification.max_quiz_counts,
          },
        },
      });
      return;
    }

    // We need more questions - use the reusable utility
    const associationResult = await associateQuestionsWithExam({
      exam_id,
      cert_id,
      targetQuestionCount: questionsNeeded, // Only add the needed amount
      existingQuestionIds,
    });

    if (!associationResult.success) {
      logger.error(
        `updateExam: Failed to associate questions with exam ${exam_id}: ${associationResult.error}`,
      );

      res.status(500).json({
        success: false,
        error:
          associationResult.error || 'Failed to associate questions with exam',
      });
      return;
    }

    // Update exam with successful association results
    const finalQuestionCount =
      currentQuestionCount + associationResult.associatedQuestionCount;

    const newExamStatus =
      finalQuestionCount > 0
        ? ExamStatus.READY
        : ExamStatus.QUESTION_GENERATION_FAILED;

    await prismaInstance.examAttempt.update({
      where: { exam_id },
      data: {
        total_questions: finalQuestionCount,
        exam_status: newExamStatus,
      },
    });

    // Update certification status if this is the first exam for the certification and status is READY
    if (newExamStatus === ExamStatus.READY) {
      await updateCertificationStatusOnFirstExam(
        exam.user.user_id,
        cert_id,
        exam_id,
      );
    }

    // Invalidate user exam cache when exam status changes
    await CacheManager.invalidateUserExamCacheForGenerationChange(
      exam.user.user_id,
      `manual_exam_update_${newExamStatus}`,
    );

    // Get final count for response
    const finalAnswers = await prismaInstance.examUserAnswer.findMany({
      where: { exam_id },
      select: { quiz_question_id: true },
    });

    logger.info(
      `updateExam: Successfully updated exam ${exam_id}. ` +
        `Final question count: ${finalAnswers.length}`,
    );

    res.status(200).json({
      success: true,
      message: 'Exam questions have been updated successfully.',
      data: {
        exam_id,
        previous_questions: currentQuestionCount,
        final_questions: finalAnswers.length,
        target_questions: targetQuestionCount,
        status: newExamStatus,
        token_cost: exam.token_cost,
        certification: {
          cert_id,
          name: exam.certification.name,
          min_quiz_counts: exam.certification.min_quiz_counts,
          max_quiz_counts: exam.certification.max_quiz_counts,
        },
      },
    });
  } catch (error) {
    logger.error('updateExam: Error updating exam:', {
      error_message: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
