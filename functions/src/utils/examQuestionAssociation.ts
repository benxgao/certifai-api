import logger from '../services/firebase/logger';
import prismaInstance, {
  ExamStatus,
  CertificationStatus,
} from '../services/prisma';
import { validateMultipleQuestionsExamConstraint } from './questionExamConstraint';
import { BatchWriteOptimizer } from '../services/database/batchWriteOptimizer';
import { CacheManager } from '../services/cache';
import memoryCache from '../services/cache/memoryCache';
import { CACHE_CONFIG } from '../services/redis';

export interface QuestionAssociationOptions {
  exam_id: string;
  cert_id: number;
  targetQuestionCount?: number;
  existingQuestionIds?: Set<string>;
}

export interface QuestionAssociationResult {
  success: boolean;
  associatedQuestionCount: number;
  selectedQuestionIds: string[];
  certification: {
    cert_id: number;
    name: string;
    min_quiz_counts: number;
    max_quiz_counts: number;
  } | null;
  error?: string;
}

/**
 * Associates quiz questions with an exam using intelligent selection logic.
 * This function implements the same logic used across take.ts, updateExam.ts, and getExamQuestions.ts
 */
export async function associateQuestionsWithExam(
  options: QuestionAssociationOptions,
): Promise<QuestionAssociationResult> {
  const {
    exam_id,
    cert_id,
    targetQuestionCount,
    existingQuestionIds = new Set(),
  } = options;

  try {
    logger.info(
      `associateQuestionsWithExam: Starting for exam_id: ${exam_id}, cert_id: ${cert_id}`,
    );

    // Get certification details to respect min/max quiz counts
    const certification = await prismaInstance.certification.findUnique({
      where: { cert_id },
      select: {
        cert_id: true,
        name: true,
        min_quiz_counts: true,
        max_quiz_counts: true,
      },
    });

    if (!certification) {
      return {
        success: false,
        associatedQuestionCount: 0,
        selectedQuestionIds: [],
        certification: null,
        error: `Certification with id ${cert_id} not found`,
      };
    }

    // First, get questions generated specifically for this exam
    const examGeneratedQuestions = await prismaInstance.quizQuestion.findMany({
      where: {
        cert_id,
        generated_from: exam_id,
        is_deprecated: false,
      },
      include: {
        answerOptions: true,
      },
    });

    // Then, get other available questions from the same certification
    const certificationQuestions = await prismaInstance.quizQuestion.findMany({
      where: {
        cert_id,
        is_deprecated: false,
        NOT: {
          quiz_question_id: {
            in: Array.from(existingQuestionIds),
          },
        },
      },
      include: {
        answerOptions: true,
      },
    });

    logger.info(
      `associateQuestionsWithExam: Found ${examGeneratedQuestions.length} exam-specific questions ` +
        `and ${certificationQuestions.length} total available questions for certification ${cert_id}`,
    );

    // Combine questions, prioritizing exam-specific ones
    const availableQuestions = [
      ...examGeneratedQuestions.filter(
        (question) => !existingQuestionIds.has(question.quiz_question_id),
      ),
      ...certificationQuestions.filter(
        (question) =>
          !existingQuestionIds.has(question.quiz_question_id) &&
          question.generated_from !== exam_id, // Avoid duplicates from exam-specific questions
      ),
    ];

    // Determine how many questions to select for the exam
    // Priority: provided targetQuestionCount -> certification max -> available questions -> default
    let finalTargetCount = targetQuestionCount;

    if (!finalTargetCount) {
      finalTargetCount = Math.min(
        certification.max_quiz_counts,
        availableQuestions.length,
        50, // Default max questions per exam
      );
    }

    // Ensure we have at least the minimum required questions
    if (availableQuestions.length < certification.min_quiz_counts) {
      logger.warn(
        `associateQuestionsWithExam: Insufficient questions available for certification ${certification.name}. ` +
          `Available: ${availableQuestions.length}, Required minimum: ${certification.min_quiz_counts}`,
      );
    }

    // Select questions for the exam
    const selectedQuestions = availableQuestions
      .slice(0, finalTargetCount)
      .map((question) => question.quiz_question_id);

    if (selectedQuestions.length === 0) {
      logger.warn(
        `associateQuestionsWithExam: No questions available for exam ${exam_id} (certification: ${certification.name})`,
      );

      return {
        success: false,
        associatedQuestionCount: 0,
        selectedQuestionIds: [],
        certification,
        error: `No questions available for certification ${certification.name}`,
      };
    }

    // Validate that all selected questions can be associated with this exam
    const validationResult = await validateMultipleQuestionsExamConstraint(
      selectedQuestions,
      exam_id,
    );

    if (!validationResult.isValid) {
      logger.error(
        `associateQuestionsWithExam: Question-exam constraint validation failed for exam ${exam_id}: ${validationResult.errors.join(
          '; ',
        )}`,
      );

      return {
        success: false,
        associatedQuestionCount: 0,
        selectedQuestionIds: [],
        certification,
        error: `Question-exam constraint validation failed: ${validationResult.errors.join(
          '; ',
        )}`,
      };
    }

    // Create ExamUserAnswer entries using optimized batch operations
    const examUserAnswers = selectedQuestions.map((questionId) => ({
      exam_id,
      quiz_question_id: questionId,
      selected_option_id: null,
      is_correct: null,
      // Note: created_at field is not defined in ExamUserAnswer schema
    }));

    // Use optimized batch operations for better concurrent performance
    await BatchWriteOptimizer.batchOperations(
      prismaInstance,
      [
        {
          operation: async (tx: any) => {
            return tx.examUserAnswer.createMany({
              data: examUserAnswers,
              skipDuplicates: true,
            });
          },
          description: `Create exam user answers for exam ${exam_id}`,
        },
      ],
      {
        batchSize: 50, // Optimal size for answer creation
        useTransaction: true,
        maxRetries: 3,
      },
    );

    logger.info(
      `associateQuestionsWithExam: Successfully associated ${selectedQuestions.length} questions with exam ${exam_id} ` +
        `(certification: ${certification.name}, min: ${certification.min_quiz_counts}, max: ${certification.max_quiz_counts})`,
    );

    return {
      success: true,
      associatedQuestionCount: selectedQuestions.length,
      selectedQuestionIds: selectedQuestions,
      certification,
    };
  } catch (error) {
    logger.error(
      `associateQuestionsWithExam: Error associating questions with exam ${exam_id}:`,
      error as any,
    );

    return {
      success: false,
      associatedQuestionCount: 0,
      selectedQuestionIds: [],
      certification: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Updates certification status to IN_PROGRESS if this is the first exam for the certification
 */
export async function updateCertificationStatusOnFirstExam(
  user_id: string,
  cert_id: number,
  exam_id: string,
): Promise<void> {
  try {
    // Check if this is the user's first exam for this certification by counting existing exams with READY status
    const existingReadyExamsCount = await prismaInstance.examAttempt.count({
      where: {
        user_id,
        cert_id,
        exam_status: ExamStatus.READY,
      },
    });

    // If this is the first READY exam (count should be 1, which is the current exam we just updated)
    if (existingReadyExamsCount === 1) {
      // Check current certification status
      const userCertification =
        await prismaInstance.userCertification.findUnique({
          where: {
            user_id_cert_id: {
              user_id,
              cert_id,
            },
          },
          select: { status: true },
        });

      // Only update if status is NOT_STARTED to avoid overriding other statuses like PASSED, etc.
      if (
        userCertification &&
        userCertification.status === CertificationStatus.NOT_STARTED
      ) {
        await prismaInstance.userCertification.update({
          where: {
            user_id_cert_id: {
              user_id,
              cert_id,
            },
          },
          data: {
            status: CertificationStatus.IN_PROGRESS,
            updated_at: new Date(),
          },
        });

        logger.info(
          `updateCertificationStatusOnFirstExam: Updated certification status to IN_PROGRESS for user ${user_id}, cert_id ${cert_id} after first exam ${exam_id} became READY`,
        );

        // Invalidate user certification cache since status changed
        await CacheManager.invalidateUserCertificationCache(user_id);
      }
    }
  } catch (error) {
    // Don't fail the operation if certification status update fails
    logger.error(
      `updateCertificationStatusOnFirstExam: Failed to update certification status for user ${user_id}, cert_id ${cert_id}:`,
      error as any,
    );
  }
}

/**
 * Updates an exam's status and total_questions count based on question association results
 */
export async function updateExamAfterQuestionAssociation(
  exam_id: string,
  associationResult: QuestionAssociationResult,
): Promise<void> {
  try {
    const examStatus =
      associationResult.success && associationResult.associatedQuestionCount > 0
        ? ExamStatus.READY
        : ExamStatus.QUESTION_GENERATION_FAILED;

    // Get exam details to access user_id and cert_id for cache invalidation and certification status update
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id },
      select: { user_id: true, cert_id: true },
    });

    // [CHECKPOINT-5] Status Transition - Before
    const statusTransitionStart = Date.now();
    logger.info(`[CHECKPOINT-5A] STATUS_TRANSITION_INITIATED`, {
      exam_id,
      user_id: exam?.user_id,
      cert_id: exam?.cert_id,
      from_status: 'QUESTIONS_GENERATING',
      to_status: examStatus,
      associated_questions: associationResult.associatedQuestionCount,
      association_success: associationResult.success,
      timestamp_ms: statusTransitionStart,
      structuredData: true,
    });

    await prismaInstance.examAttempt.update({
      where: { exam_id },
      data: {
        exam_status: examStatus,
        total_questions: associationResult.associatedQuestionCount,
      },
    });

    // [CHECKPOINT-5B] Status Transition - After DB Update
    logger.info(`[CHECKPOINT-5B] STATUS_TRANSITION_DB_UPDATED`, {
      exam_id,
      user_id: exam?.user_id,
      new_status: examStatus,
      db_update_duration_ms: Date.now() - statusTransitionStart,
      timestamp_ms: Date.now(),
      structuredData: true,
    });

    // If exam status is set to READY, check if this is the first exam for this certification
    // and update certification status to IN_PROGRESS if needed
    if (examStatus === ExamStatus.READY && exam?.user_id && exam?.cert_id) {
      await updateCertificationStatusOnFirstExam(
        exam.user_id,
        exam.cert_id,
        exam_id,
      );
    }

    // Invalidate user exam cache when exam generation completes (status changes to READY or FAILED)
    if (exam?.user_id) {
      // [CHECKPOINT-4] Cache Invalidation - Before
      const cacheInvalidationStart = Date.now();
      logger.info(`[CHECKPOINT-4A] CACHE_INVALIDATION_INITIATED`, {
        exam_id,
        user_id: exam.user_id,
        reason: `exam_status_changed_to_${examStatus}`,
        timestamp_ms: cacheInvalidationStart,
        structuredData: true,
      });

      await CacheManager.invalidateUserExamCacheForGenerationChange(
        exam.user_id,
        `exam_status_changed_to_${examStatus}`,
      );

      // Selectively clear memory cache (L1) for this user's exams to ensure fresh status
      const memCachePrefix = `${CACHE_CONFIG.KEYS.USER_EXAMS}:${exam.user_id}`;
      const deletedCount = memoryCache.deleteByPattern(memCachePrefix);

      // [CHECKPOINT-4B] Cache Invalidation - After
      const cacheInvalidationDuration = Date.now() - cacheInvalidationStart;
      logger.info(`[CHECKPOINT-4B] CACHE_INVALIDATION_COMPLETE`, {
        exam_id,
        user_id: exam.user_id,
        exam_status: examStatus,
        memory_cache_entries_cleared: deletedCount,
        redis_keys_cleared: 3, // user:exams, exam_questions, exam_details patterns
        total_invalidation_duration_ms: cacheInvalidationDuration,
        timestamp_ms: Date.now(),
        structuredData: true,
      });
    }

    logger.info(
      `updateExamAfterQuestionAssociation: Updated exam ${exam_id} status to ${examStatus} ` +
        `with ${associationResult.associatedQuestionCount} questions`,
    );
  } catch (error) {
    logger.error(
      `updateExamAfterQuestionAssociation: Error updating exam ${exam_id}:`,
      error as any,
    );
    throw error;
  }
}
