import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';
import {
  getRtdbValue,
  deleteRtdbValue,
} from '../../../../services/firebase/rtdb';
import { CacheManager } from '../../../../services/cache';

/**
 * Deletes multiple exam-related data from Firebase Realtime Database
 * @param exam_ids - Array of exam identifiers
 * @returns Promise<{examPlansDeleted: number, examDataDeleted: number}>
 */
async function deleteMultipleExamsFromRtdb(exam_ids: string[]): Promise<{
  examPlansDeleted: number;
  examDataDeleted: number;
}> {
  const results = {
    examPlansDeleted: 0,
    examDataDeleted: 0,
  };

  // Process deletions in parallel for better performance
  const deletionPromises = exam_ids.map(async (exam_id) => {
    const examResults = {
      examPlanDeleted: false,
      examDataDeleted: false,
    };

    try {
      // Delete exam plan data
      const examPlanPath = `exam_plans/${exam_id}`;

      // First check if data exists, but proceed with deletion even if check fails
      try {
        const examPlanData = await getRtdbValue(examPlanPath);
        if (examPlanData) {
          logger.info(
            `deleteCertification: Found exam plan data in RTDB at path: ${examPlanPath}`,
          );
        } else {
          logger.info(
            `deleteCertification: No exam plan found in RTDB at path: ${examPlanPath}`,
          );
        }
      } catch (readError) {
        logger.warn(
          `deleteCertification: Failed to read exam plan from RTDB, will still attempt deletion: ${readError}`,
        );
      }

      // Always attempt deletion regardless of read result
      await deleteRtdbValue(examPlanPath);
      examResults.examPlanDeleted = true;
      logger.info(
        `deleteCertification: Successfully deleted exam plan from RTDB at path: ${examPlanPath}`,
      );
    } catch (error) {
      logger.warn(
        `deleteCertification: Failed to delete exam plan from RTDB for exam ${exam_id}: ${error}`,
      );
    }

    try {
      // Mark exam data as deleted (no longer used in RTDB per refactoring)
      logger.info(
        `deleteCertification: Skipped exam data deletion from RTDB for exam ${exam_id} (exams collection removed as unused)`,
        {
          exam_id,
          reason: 'exams_collection_removed_as_unused',
          structuredData: true,
        },
      );
      examResults.examDataDeleted = true;
    } catch (error) {
      logger.warn(
        `deleteCertification: Failed to delete exam data from RTDB for exam ${exam_id}: ${error}`,
      );
    }

    return examResults;
  });

  const allResults = await Promise.all(deletionPromises);

  // Count successful deletions
  allResults.forEach((result) => {
    if (result.examPlanDeleted) results.examPlansDeleted++;
    if (result.examDataDeleted) results.examDataDeleted++;
  });

  return results;
}

/**
 * Validates that all certification-related data has been properly deleted
 */
async function validateCertificationDeletion(
  cert_id: number,
  user_id: string,
): Promise<{
  isCompletelyDeleted: boolean;
  remainingData: {
    userCertification: number;
    examAttempts: number;
    quizQuestions: number;
    answerOptions: number;
    examUserAnswers: number;
  };
}> {
  const [
    userCertification,
    examAttempts,
    quizQuestions,
    answerOptions,
    examUserAnswers,
  ] = await Promise.all([
    prismaInstance.userCertification.count({
      where: {
        cert_id,
        user_id,
      },
    }),
    prismaInstance.examAttempt.count({
      where: {
        cert_id,
        user_id,
      },
    }),
    prismaInstance.quizQuestion.count({
      where: {
        cert_id,
        generated_from: {
          in: await prismaInstance.examAttempt
            .findMany({
              where: { cert_id, user_id },
              select: { exam_id: true },
            })
            .then((exams) => exams.map((e) => e.exam_id)),
        },
      },
    }),
    prismaInstance.answerOption.count({
      where: {
        quizQuestion: {
          cert_id,
          generated_from: {
            in: await prismaInstance.examAttempt
              .findMany({
                where: { cert_id, user_id },
                select: { exam_id: true },
              })
              .then((exams) => exams.map((e) => e.exam_id)),
          },
        },
      },
    }),
    prismaInstance.examUserAnswer.count({
      where: {
        examAttempt: {
          cert_id,
          user_id,
        },
      },
    }),
  ]);

  const remainingData = {
    userCertification,
    examAttempts,
    quizQuestions,
    answerOptions,
    examUserAnswers,
  };

  const isCompletelyDeleted = Object.values(remainingData).every(
    (count) => count === 0,
  );

  return {
    isCompletelyDeleted,
    remainingData,
  };
}

/**
 * Deletes a user's certification along with all associated data in proper cascade order
 *
 * This endpoint explicitly deletes all related data in the correct order:
 * 1. ExamUserAnswer records (for all exams of this certification)
 * 2. AnswerOption records (for quiz questions generated for exams of this certification)
 * 3. QuizQuestion records (generated specifically for exams of this certification)
 * 4. ExamAttempt records (all exams for this certification)
 * 5. UserCertification record (the certification registration)
 * 6. RTDB data: exam plans for all related exams
 * 7. Cache invalidation
 *
 * Note: This endpoint has a 180-second timeout to handle large certification deletions
 * with many related exams, questions, and answers.
 */
const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id, cert_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required.',
      });
      return;
    }

    if (!cert_id) {
      res.status(400).json({
        success: false,
        error: 'Certification ID is required.',
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

    const certIdNumber = parseInt(cert_id, 10);
    if (isNaN(certIdNumber)) {
      res.status(400).json({
        success: false,
        error: 'Invalid certification ID format.',
      });
      return;
    }

    // Prevent deletion of Google Cloud Professional Cloud Developer cert for demo purposes
    const PROTECTED_CERT_IDS = [8, 10, 11];
    if (PROTECTED_CERT_IDS.includes(certIdNumber)) {
      res.status(403).json({
        success: false,
        error: 'This certification cannot be deleted at this time.',
      });
      return;
    }

    const startTime = Date.now();
    logger.info(
      `deleteCertification: Starting certification deletion for cert_id: ${cert_id}, user_id: ${user_id}`,
    );

    // Get certification details with user information
    const userCertification = await prismaInstance.userCertification.findUnique(
      {
        where: {
          user_id_cert_id: {
            user_id,
            cert_id: certIdNumber,
          },
        },
        include: {
          user: {
            select: {
              user_id: true,
              firebase_user_id: true,
            },
          },
          certification: {
            select: {
              cert_id: true,
              name: true,
              firm: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
    );

    if (!userCertification) {
      res.status(404).json({
        success: false,
        error: 'User certification not found.',
      });
      return;
    }

    // Verify user has access to this certification via Firebase token
    if (userCertification.user.firebase_user_id !== firebaseUserIdFromToken) {
      res.status(403).json({
        success: false,
        error: 'Access denied: You can only delete your own certifications.',
      });
      return;
    }

    // Immediately update certification status to DELETING to indicate deletion in progress
    const originalStatus = userCertification.status;
    await prismaInstance.userCertification.update({
      where: {
        user_id_cert_id: {
          user_id,
          cert_id: certIdNumber,
        },
      },
      data: {
        status: 'DELETING',
      },
    });

    logger.info(
      `deleteCertification: Updated certification status to DELETING for cert_id: ${cert_id}, user_id: ${user_id} (original status: ${originalStatus})`,
    );

    // Invalidate user certification cache immediately after status update
    await CacheManager.invalidateUserCertificationCache(user_id);

    // Get all exams for this certification and user
    const relatedExams = await prismaInstance.examAttempt.findMany({
      where: {
        cert_id: certIdNumber,
        user_id,
      },
      select: {
        exam_id: true,
        exam_status: true,
        total_questions: true,
      },
    });

    const examIds = relatedExams.map((exam) => exam.exam_id);

    // Get all quiz questions that were specifically generated for these exams
    const [associatedQuizQuestions, examUserAnswersCount] = await Promise.all([
      prismaInstance.quizQuestion.findMany({
        where: {
          generated_from: {
            in: examIds,
          },
        },
        select: {
          quiz_question_id: true,
          _count: {
            select: {
              answerOptions: true,
            },
          },
        },
      }),
      prismaInstance.examUserAnswer.count({
        where: {
          exam_id: {
            in: examIds,
          },
        },
      }),
    ]);

    // Extract question IDs and calculate total answer options
    const questionIds = associatedQuizQuestions.map((q) => q.quiz_question_id);
    const totalAnswerOptions = associatedQuizQuestions.reduce(
      (sum, q) => sum + q._count.answerOptions,
      0,
    );

    logger.info(
      `deleteCertification: Found data to delete for certification ${cert_id}: ${relatedExams.length} exams, ${questionIds.length} quiz questions, ${totalAnswerOptions} answer options, ${examUserAnswersCount} user answers`,
    );

    logger.info(
      `deleteCertification: Starting database transaction for certification ${cert_id} (may take up to 3 minutes for large datasets)`,
    );

    const transactionStartTime = Date.now();
    // Use a transaction to ensure all related data is cleaned up atomically
    // Delete in proper cascade order to avoid foreign key constraint violations
    const deletionCounts = await prismaInstance.$transaction(async (prisma) => {
      let deletedAnswerOptions = 0;
      let deletedQuestions = 0;
      let deletedUserAnswers = 0;
      let deletedExams = 0;

      // Step 1: Delete exam user answers first (they reference both exams and questions)
      if (examUserAnswersCount > 0) {
        const userAnswerResult = await prisma.examUserAnswer.deleteMany({
          where: {
            exam_id: {
              in: examIds,
            },
          },
        });
        deletedUserAnswers = userAnswerResult.count;
        logger.info(
          `deleteCertification: Deleted ${deletedUserAnswers} exam user answers for certification ${cert_id}`,
        );
      }

      // Step 2: Delete answer options for questions generated for these exams
      if (questionIds.length > 0) {
        const answerOptionsResult = await prisma.answerOption.deleteMany({
          where: {
            quiz_question_id: {
              in: questionIds,
            },
          },
        });
        deletedAnswerOptions = answerOptionsResult.count;
        logger.info(
          `deleteCertification: Deleted ${deletedAnswerOptions} answer options for quiz questions of certification ${cert_id}`,
        );

        // Step 3: Delete quiz questions generated specifically for these exams
        const questionsResult = await prisma.quizQuestion.deleteMany({
          where: {
            generated_from: {
              in: examIds,
            },
          },
        });
        deletedQuestions = questionsResult.count;
        logger.info(
          `deleteCertification: Deleted ${deletedQuestions} quiz questions generated for certification ${cert_id}`,
        );
      }

      // Step 4: Delete all exam attempts for this certification
      if (examIds.length > 0) {
        const examsResult = await prisma.examAttempt.deleteMany({
          where: {
            cert_id: certIdNumber,
            user_id,
          },
        });
        deletedExams = examsResult.count;
        logger.info(
          `deleteCertification: Deleted ${deletedExams} exam attempts for certification ${cert_id}`,
        );
      }

      // Step 5: Delete the user certification record itself
      await prisma.userCertification.delete({
        where: {
          user_id_cert_id: {
            user_id,
            cert_id: certIdNumber,
          },
        },
      });

      logger.info(
        `deleteCertification: Successfully deleted certification ${cert_id} for user ${user_id} with all related data:`,
        {
          cert_id,
          user_id,
          deleted_exams: deletedExams,
          deleted_user_answers: deletedUserAnswers,
          deleted_answer_options: deletedAnswerOptions,
          deleted_quiz_questions: deletedQuestions,
        },
      );

      // Return deletion counts for response
      return {
        deletedExams,
        deletedUserAnswers,
        deletedAnswerOptions,
        deletedQuestions,
      };
    });

    const transactionDuration = Date.now() - transactionStartTime;
    logger.info(
      `deleteCertification: Database transaction completed successfully for certification ${cert_id} in ${transactionDuration}ms`,
    );

    // Clean up RTDB data after successful database deletion
    logger.info(
      `deleteCertification: Starting RTDB cleanup for ${examIds.length} exams of certification ${cert_id}`,
    );
    const rtdbStartTime = Date.now();
    const rtdbCleanupResults = await deleteMultipleExamsFromRtdb(examIds);

    const rtdbDuration = Date.now() - rtdbStartTime;
    logger.info(
      `deleteCertification: RTDB cleanup completed for certification ${cert_id} in ${rtdbDuration}ms`,
    );

    // Validate that all related data has been completely removed
    const validationResults = await validateCertificationDeletion(
      certIdNumber,
      user_id,
    );
    if (!validationResults.isCompletelyDeleted) {
      logger.warn(
        `deleteCertification: Validation check found remaining data for certification ${cert_id}:`,
        validationResults.remainingData,
      );
    } else {
      logger.info(
        `deleteCertification: Validation confirmed complete deletion of certification ${cert_id}`,
      );
    }

    // Invalidate user certification and exam caches
    await Promise.all([
      CacheManager.invalidateUserExamCache(user_id),
      CacheManager.invalidateUserCertificationCache(user_id),
    ]);

    const totalDuration = Date.now() - startTime;
    logger.info(
      `deleteCertification: Certification deletion completed successfully for cert_id: ${cert_id}, user_id: ${user_id} in ${totalDuration}ms`,
    );

    // Return success response with comprehensive deletion details
    res.status(200).json({
      success: true,
      message: 'Certification and all related data deleted successfully.',
      data: {
        cert_id: certIdNumber,
        user_id,
        certification_name: userCertification.certification.name,
        firm_name: userCertification.certification.firm.name,
        certification_status: userCertification.status,
        deletion_summary: {
          exams_deleted: deletionCounts.deletedExams,
          exams_expected: relatedExams.length,
          exam_ids_deleted: examIds,
          exam_user_answers_deleted: deletionCounts.deletedUserAnswers,
          exam_user_answers_expected: examUserAnswersCount,
          answer_options_deleted: deletionCounts.deletedAnswerOptions,
          answer_options_expected: totalAnswerOptions,
          quiz_questions_deleted: deletionCounts.deletedQuestions,
          quiz_questions_expected: questionIds.length,
          quiz_question_ids_deleted: questionIds,
        },
        rtdb_cleanup: {
          exam_plans_deleted: rtdbCleanupResults.examPlansDeleted,
          exam_data_deleted: rtdbCleanupResults.examDataDeleted,
          total_exams_processed: examIds.length,
        },
        validation: {
          completely_deleted: validationResults.isCompletelyDeleted,
          remaining_data_check: validationResults.remainingData,
        },
        timing: {
          total_duration_ms: totalDuration,
          database_transaction_ms: transactionDuration,
          rtdb_cleanup_ms: rtdbDuration,
        },
      },
    });
  } catch (error) {
    logger.error(
      'deleteCertification: Error deleting certification:',
      error as any,
    );

    // If we have the original status and certification details, try to revert the status
    try {
      const { user_id, cert_id } = req.params;
      const certIdNumber = parseInt(cert_id, 10);

      if (user_id && cert_id && !isNaN(certIdNumber)) {
        // Check if the certification still exists and has DELETING status
        const currentCert = await prismaInstance.userCertification.findUnique({
          where: {
            user_id_cert_id: {
              user_id,
              cert_id: certIdNumber,
            },
          },
        });

        if (currentCert && currentCert.status === 'DELETING') {
          // Revert to the original status if we can determine it from the error context
          // Since we can't access originalStatus here, we'll set it to IN_PROGRESS as a safe default
          await prismaInstance.userCertification.update({
            where: {
              user_id_cert_id: {
                user_id,
                cert_id: certIdNumber,
              },
            },
            data: {
              status: 'IN_PROGRESS',
            },
          });

          logger.info(
            `deleteCertification: Reverted certification status from DELETING to IN_PROGRESS after error for cert_id: ${cert_id}, user_id: ${user_id}`,
          );

          // Invalidate cache after status reversion
          await CacheManager.invalidateUserCertificationCache(user_id);
        }
      }
    } catch (revertError) {
      logger.error(
        'deleteCertification: Failed to revert certification status after deletion error:',
        revertError as any,
      );
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
