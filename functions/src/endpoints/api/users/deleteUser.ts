import logger from '../../../services/firebase/logger';
import { AuthenticatedRequestHandler } from '../../../types/express';
import prismaInstance from '../../../services/prisma';
import { firebaseAdmin } from '../../../services/firebase/admin';
import { CacheManager } from '../../../services/cache';
import { firestoreService } from '../../../services/firebase/firestore';
import { CertSummaryFirestoreService } from '../../../services/firebase/certSummaryFirestore';
import { deleteRtdbValue } from '../../../services/firebase/rtdb';

/**
 * Validates that all related data has been properly deleted for a user
 * This is a safety check to ensure complete cleanup
 */
async function validateUserDeletion(user_id: string): Promise<{
  isCompletelyDeleted: boolean;
  remainingData: {
    user: number;
    examAttempts: number;
    userCertifications: number;
    examUserAnswers: number;
  };
}> {
  const [user, examAttempts, userCertifications, examUserAnswers] =
    await Promise.all([
      prismaInstance.user.count({ where: { user_id } }),
      prismaInstance.examAttempt.count({ where: { user_id } }),
      prismaInstance.userCertification.count({ where: { user_id } }),
      prismaInstance.examUserAnswer.count({
        where: {
          examAttempt: {
            user_id,
          },
        },
      }),
    ]);

  const remainingData = {
    user,
    examAttempts,
    userCertifications,
    examUserAnswers,
  };

  const isCompletelyDeleted =
    user === 0 &&
    examAttempts === 0 &&
    userCertifications === 0 &&
    examUserAnswers === 0;

  return { isCompletelyDeleted, remainingData };
}

/**
 * Helper function to execute with exponential backoff retry
 * @param operation - Async function to execute
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 100)
 * @returns Promise resolving to the result of the operation
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('DEADLINE_EXCEEDED') ||
          error.message.includes('UNAVAILABLE') ||
          error.message.includes('timeout') ||
          error.message.includes('connection') ||
          error.message.includes('P2024') ||
          error.message.includes('P2034') ||
          error.message.includes('deadlock'));

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(
        `deleteUser: Retrying operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms:`,
        { error: error instanceof Error ? error.message : error },
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Delete all Firestore data for a user's certifications (exam reports and summaries)
 * Executes deletions in parallel for 1-5 certs
 */
async function deleteUserFirestoreCertData(
  user_id: string,
  userCertifications: Array<{ cert_id: string }>,
): Promise<{
  certsProcessed: number;
  reportDocsDeleted: number;
  summariesDeleted: number;
  certDeleteErrors: Array<{ cert_id: string; error: string }>;
}> {
  const startTime = Date.now();
  const certDeleteErrors: Array<{ cert_id: string; error: string }> = [];
  let reportDocsDeleted = 0;
  let summariesDeleted = 0;

  // Parallel deletion of all cert data (exam reports + summaries)
  const certDeletionPromises = userCertifications.map(async ({ cert_id }) => {
    try {
      // Step 1: Delete exam reports subcollection in bulk
      try {
        const reportsPath = `users/${user_id}/certs/${cert_id}/exam_reports`;
        const reportDocs = await firestoreService.list(reportsPath);

        if (reportDocs.length > 0) {
          // Batch delete all report documents
          const deleteOps = reportDocs.map((doc: any) => ({
            type: 'delete' as const,
            collectionPath: reportsPath,
            docId: doc.id,
          }));

          await firestoreService.batch(deleteOps);
          reportDocsDeleted += reportDocs.length;
          logger.info(
            `deleteUser: Deleted ${reportDocs.length} exam reports for cert ${cert_id}`,
            { user_id, cert_id, count: reportDocs.length },
          );
        }
      } catch (reportsError) {
        logger.warn(
          `deleteUser: Failed to delete exam reports for cert ${cert_id}:`,
          { error: reportsError instanceof Error ? reportsError.message : String(reportsError) },
        );
        // Continue to summary deletion even if reports fail
      }

      // Step 2: Delete cert summary document
      try {
        await CertSummaryFirestoreService.deleteCertSummary(user_id, cert_id);
        summariesDeleted++;
        logger.info(`deleteUser: Deleted cert summary for cert ${cert_id}`, {
          user_id,
          cert_id,
        });
      } catch (summaryError) {
        logger.warn(
          `deleteUser: Failed to delete cert summary for cert ${cert_id}:`,
          { error: summaryError instanceof Error ? summaryError.message : String(summaryError) },
        );
        // Continue even if summary deletion fails
      }
    } catch (certError) {
      certDeleteErrors.push({
        cert_id,
        error:
          certError instanceof Error ? certError.message : String(certError),
      });
    }
  });

  // Execute all cert deletions in parallel
  await Promise.allSettled(certDeletionPromises);

  const duration = Date.now() - startTime;
  logger.info(`deleteUser: Completed Firestore cert deletions`, {
    user_id,
    certsProcessed: userCertifications.length,
    reportDocsDeleted,
    summariesDeleted,
    certDeleteErrors: certDeleteErrors.length,
    durationMs: duration,
  });

  return {
    certsProcessed: userCertifications.length,
    reportDocsDeleted,
    summariesDeleted,
    certDeleteErrors,
  };
}

/**
 * Delete Firestore account document
 */
async function deleteUserFirestoreAccount(
  user_id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await firestoreService.batch([
      { type: 'delete', collectionPath: 'users', docId: user_id },
    ]);
    logger.info(`deleteUser: Deleted Firestore account doc for user`, {
      user_id,
    });
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`deleteUser: Failed to delete Firestore account doc:`, {
      user_id,
      error: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}

/**
 * Delete all RTDB exam plans for a user
 * Executes parallel chunk deletions (100 per chunk) with exponential backoff
 */
async function deleteUserRtdbExamPlans(user_id: string): Promise<{
  examPlansFound: number;
  examPlansDeleted: number;
  examPlanErrors: number;
}> {
  const startTime = Date.now();
  let examPlansFound = 0;
  let examPlansDeleted = 0;
  let examPlanErrors = 0;

  try {
    // Step 1: Query all exam_plans from RTDB (this is a single query, not paginated)
    const examPlansSnapshot = await executeWithRetry(
      () => firebaseAdmin.database().ref('exam_plans').once('value'),
      3,
      100,
    );

    const allExamPlans = examPlansSnapshot.val();
    if (!allExamPlans || typeof allExamPlans !== 'object') {
      logger.info(`deleteUser: No exam_plans found in RTDB for user`, {
        user_id,
      });
      return { examPlansFound: 0, examPlansDeleted: 0, examPlanErrors: 0 };
    }

    // Step 2: Filter exam plans that belong to this user
    const userExamPlanIds = Object.entries(allExamPlans)
      .filter(([, planData]) => {
        const plan = planData as Record<string, unknown>;
        return plan && plan.user_id === user_id;
      })
      .map(([examId]) => examId);

    examPlansFound = userExamPlanIds.length;
    logger.info(`deleteUser: Found ${examPlansFound} exam plans for user`, {
      user_id,
      count: examPlansFound,
    });

    if (examPlansFound === 0) {
      return { examPlansFound: 0, examPlansDeleted: 0, examPlanErrors: 0 };
    }

    // Step 3: Delete exam plans in parallel chunks (100 per chunk)
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < userExamPlanIds.length; i += CHUNK_SIZE) {
      chunks.push(userExamPlanIds.slice(i, i + CHUNK_SIZE));
    }

    const chunkDeletionPromises = chunks.map(async (chunk) => {
      return Promise.allSettled(
        chunk.map((examId: string) =>
          executeWithRetry(
            () => deleteRtdbValue(`exam_plans/${examId}`),
            3,
            100,
          ).catch((error) => {
            examPlanErrors++;
            logger.warn(
              `deleteUser: Failed to delete exam_plan ${examId}:`,
              { error: error instanceof Error ? error.message : String(error) },
            );
            return null;
          }),
        ),
      );
    });

    // Execute all chunks in parallel (no inter-chunk delays for speed)
    const results = await Promise.all(chunkDeletionPromises);
    examPlansDeleted = results
      .flat()
      .filter((r) => r.status === 'fulfilled' && r.value !== null).length;

    logger.info(`deleteUser: Completed RTDB exam_plans deletions`, {
      user_id,
      examPlansFound,
      examPlansDeleted,
      examPlanErrors,
      chunks: chunks.length,
    });
  } catch (error) {
    logger.error(`deleteUser: Failed to delete RTDB exam_plans:`, {
      user_id,
      error: error instanceof Error ? error.message : error,
    });
  }

  const duration = Date.now() - startTime;
  logger.info(`deleteUser: RTDB exam_plans deletion took ${duration}ms`, {
    user_id,
  });

  return { examPlansFound, examPlansDeleted, examPlanErrors };
}

/**
 * Deletes a user account along with all associated data in proper cascade order
 * This is a destructive operation that removes:
 * 1. ExamUserAnswer records (foreign key references)
 * 2. ExamAttempt records (user's exam history)
 * 3. UserCertification records (certification registrations)
 * 4. User record (main user account)
 * 5. Firebase user account
 * 6. Cache invalidation
 */
const handler: AuthenticatedRequestHandler<unknown, Record<string, unknown>, { user_id: string }> = async (req, res) => {
  try {
    const { user_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.user_id;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required.',
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

    logger.info(`deleteUser: Starting user deletion for user_id: ${user_id}`);

    // Get user details
    const user = await prismaInstance.user.findUnique({
      where: { user_id },
      select: {
        user_id: true,
        firebase_user_id: true,
        created_at: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found.',
      });
      return;
    }

    // Verify user has access to delete this account via Firebase token
    if (user.firebase_user_id !== firebaseUserIdFromToken) {
      res.status(403).json({
        success: false,
        error: 'Access denied: You can only delete your own account.',
      });
      return;
    }

    // Get count of all related data for logging
    const [examAttempts, userCertificationsData, examUserAnswers] =
      await Promise.all([
        prismaInstance.examAttempt.findMany({
          where: { user_id },
          select: {
            exam_id: true,
            exam_status: true,
          },
        }),
        prismaInstance.userCertification.findMany({
          where: { user_id },
          select: { cert_id: true },
        }),
        prismaInstance.examUserAnswer.count({
          where: {
            examAttempt: {
              user_id,
            },
          },
        }),
      ]);

    const userCertifications = userCertificationsData.length;

    logger.info(
      `deleteUser: Found data to delete for user ${user_id}: ${examAttempts.length} exam attempts, ${userCertifications} certification registrations, ${examUserAnswers} user answers`,
    );

    // ===== PHASE 2 & 3: Delete Firestore cert data and account doc (parallel) =====
    const startTime = Date.now();

    const firestoreDeletionPromises = [
      // Phase 2: Delete Firestore cert data (exam reports + summaries)
      deleteUserFirestoreCertData(
        user_id,
        userCertificationsData as unknown as Array<{ cert_id: string }>,
      ),
      // Phase 3: Delete Firestore account document (parallel)
      deleteUserFirestoreAccount(user_id),
    ];

    const firestoreResults = await Promise.allSettled(
      firestoreDeletionPromises,
    );
    const firestoreCertResults =
      firestoreResults[0].status === 'fulfilled'
        ? firestoreResults[0].value
        : null;
    const firestoreAccountResult =
      firestoreResults[1].status === 'fulfilled'
        ? firestoreResults[1].value
        : null;

    logger.info(`deleteUser: Completed Firestore deletions`, {
      user_id,
      firestoreCertResults,
      firestoreAccountError:
        firestoreAccountResult &&
        'success' in firestoreAccountResult &&
        !firestoreAccountResult.success
          ? firestoreAccountResult.error
          : null,
    });

    // ===== PHASE 4: Delete RTDB exam plans (parallel chunks) =====
    const rtdbDeletionResult = await deleteUserRtdbExamPlans(user_id);

    // ===== PHASE 5: Prisma Transaction (extended timeout for bulk delete) =====
    logger.info(
      `deleteUser: Starting Prisma transaction (extended timeout: 45s)`,
      {
        user_id,
      },
    );

    const deletionCounts = await prismaInstance.$transaction(
      async (prisma) => {
        let deletedUserAnswers = 0;
        let deletedExamAttempts = 0;
        let deletedUserCertifications = 0;

        // Step 1: Delete exam user answers first (they reference exam attempts)
        if (examUserAnswers > 0) {
          const userAnswerResult = await prisma.examUserAnswer.deleteMany({
            where: {
              examAttempt: {
                user_id,
              },
            },
          });
          deletedUserAnswers = userAnswerResult.count;
          logger.info(
            `deleteUser: Deleted ${deletedUserAnswers} exam user answers for user ${user_id}`,
          );
        }

        // Step 2: Delete exam attempts
        if (examAttempts.length > 0) {
          const examAttemptResult = await prisma.examAttempt.deleteMany({
            where: { user_id },
          });
          deletedExamAttempts = examAttemptResult.count;
          logger.info(
            `deleteUser: Deleted ${deletedExamAttempts} exam attempts for user ${user_id}`,
          );
        }

        // Step 3: Delete user certifications
        if (userCertifications > 0) {
          const userCertificationResult =
            await prisma.userCertification.deleteMany({
              where: { user_id },
            });
          deletedUserCertifications = userCertificationResult.count;
          logger.info(
            `deleteUser: Deleted ${deletedUserCertifications} user certifications for user ${user_id}`,
          );
        }

        // Step 4: Delete the user record itself
        await prisma.user.delete({
          where: { user_id },
        });

        logger.info(
          `deleteUser: Successfully deleted user ${user_id} with all related data:`,
          {
            user_id,
            deleted_user_answers: deletedUserAnswers,
            deleted_exam_attempts: deletedExamAttempts,
            deleted_user_certifications: deletedUserCertifications,
          },
        );

        // Return deletion counts for response
        return {
          deletedUserAnswers,
          deletedExamAttempts,
          deletedUserCertifications,
        };
      },
      {
        timeout: 60000, // 60 seconds timeout for bulk operations (100+ exams, 5000-20000 answers)
        isolationLevel: 'ReadCommitted',
      },
    );

    // ===== PHASE 6: Firebase Auth + Cache Invalidation (parallel, non-blocking) =====
    let firebaseAuthDeleted = false;
    let cacheInvalidated = false;

    const authCachePromises = [
      (async () => {
        try {
          if (user.firebase_user_id) {
            await firebaseAdmin.auth().deleteUser(user.firebase_user_id);
            logger.info(
              `deleteUser: Successfully deleted Firebase user ${user.firebase_user_id}`,
            );
            firebaseAuthDeleted = true;
          }
        } catch (firebaseError) {
          logger.warn(
            `deleteUser: Failed to delete Firebase user ${user.firebase_user_id}:`,
            { error: firebaseError instanceof Error ? firebaseError.message : String(firebaseError) },
          );
        }
      })(),
      (async () => {
        try {
          await CacheManager.invalidateUserCaches(user_id);
          logger.info(`deleteUser: Invalidated caches for user ${user_id}`);
          cacheInvalidated = true;
        } catch (cacheError) {
          logger.warn(
            `deleteUser: Failed to invalidate caches for user ${user_id}:`,
            { error: cacheError instanceof Error ? cacheError.message : String(cacheError) },
          );
        }
      })(),
    ];

    // Execute Firebase Auth and cache invalidation in parallel (non-blocking)
    await Promise.allSettled(authCachePromises);

    // ===== PHASE 7: Validation & Response =====
    const totalDuration = Date.now() - startTime;

    // Validate that all related data has been completely removed
    const validationResults = await validateUserDeletion(user_id);
    if (!validationResults.isCompletelyDeleted) {
      logger.warn(
        `deleteUser: Validation check found remaining data for user ${user_id}:`,
        validationResults.remainingData,
      );
    } else {
      logger.info(
        `deleteUser: Validation confirmed complete deletion of user ${user_id}`,
      );
    }

    // Successful response
    res.status(200).json({
      success: true,
      message: 'User account deleted successfully',
      data: {
        deleted_user_id: user_id,
        deleted_firebase_user_id: user.firebase_user_id,
        deletion_summary: {
          // Firestore deletions
          firestore_cert_reports_deleted:
            firestoreCertResults && 'reportDocsDeleted' in firestoreCertResults
              ? firestoreCertResults.reportDocsDeleted
              : 0,
          firestore_cert_summaries_deleted:
            firestoreCertResults && 'summariesDeleted' in firestoreCertResults
              ? firestoreCertResults.summariesDeleted
              : 0,
          firestore_cert_deletions_with_errors:
            firestoreCertResults && 'certDeleteErrors' in firestoreCertResults
              ? firestoreCertResults.certDeleteErrors.length
              : 0,
          firestore_account_doc_deleted:
            firestoreAccountResult && 'success' in firestoreAccountResult
              ? firestoreAccountResult.success
              : false,
          // RTDB deletions
          rtdb_exam_plans_found: rtdbDeletionResult.examPlansFound,
          rtdb_exam_plans_deleted: rtdbDeletionResult.examPlansDeleted,
          rtdb_exam_plan_deletion_errors: rtdbDeletionResult.examPlanErrors,
          // Prisma deletions
          user_answers_deleted: deletionCounts.deletedUserAnswers,
          exam_attempts_deleted: deletionCounts.deletedExamAttempts,
          user_certifications_deleted: deletionCounts.deletedUserCertifications,
          // Firebase Auth & Cache
          firebase_user_deleted: firebaseAuthDeleted,
          user_caches_invalidated: cacheInvalidated,
        },
        validation: {
          completely_deleted: validationResults.isCompletelyDeleted,
          remaining_data_check: validationResults.remainingData,
        },
        performance: {
          total_duration_ms: totalDuration,
          estimated_exams: examAttempts.length,
          estimated_certifications: userCertifications,
          estimated_answered_questions: examUserAnswers,
        },
      },
    });
  } catch (error) {
    logger.error('deleteUser: Error deleting user:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
