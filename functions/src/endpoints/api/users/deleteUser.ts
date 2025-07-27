import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import prismaInstance from '../../../services/prisma';
import { firebaseAdmin } from '../../../services/firebase/admin';
import { CacheManager } from '../../../services/cache';

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
 * Deletes a user account along with all associated data in proper cascade order
 * This is a destructive operation that removes:
 * 1. ExamUserAnswer records (foreign key references)
 * 2. ExamAttempt records (user's exam history)
 * 3. UserCertification records (certification registrations)
 * 4. User record (main user account)
 * 5. Firebase user account
 * 6. Cache invalidation
 */
const handler = async (req: any | CustomRequest, res: Response) => {
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
    const [examAttempts, userCertifications, examUserAnswers] =
      await Promise.all([
        prismaInstance.examAttempt.findMany({
          where: { user_id },
          select: {
            exam_id: true,
            exam_status: true,
          },
        }),
        prismaInstance.userCertification.count({
          where: { user_id },
        }),
        prismaInstance.examUserAnswer.count({
          where: {
            examAttempt: {
              user_id,
            },
          },
        }),
      ]);

    logger.info(
      `deleteUser: Found data to delete for user ${user_id}: ${examAttempts.length} exam attempts, ${userCertifications} certification registrations, ${examUserAnswers} user answers`,
    );

    // Use a transaction to ensure all related data is cleaned up atomically
    // Delete in proper cascade order to avoid foreign key constraint violations
    const deletionCounts = await prismaInstance.$transaction(async (prisma) => {
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
    });

    // Delete Firebase user account after successful database deletion
    try {
      if (user.firebase_user_id) {
        await firebaseAdmin.auth().deleteUser(user.firebase_user_id);
        logger.info(
          `deleteUser: Successfully deleted Firebase user ${user.firebase_user_id}`,
        );
      }
    } catch (firebaseError) {
      logger.warn(
        `deleteUser: Failed to delete Firebase user ${user.firebase_user_id}:`,
        firebaseError as any,
      );
      // Continue with response even if Firebase deletion fails
      // The database cleanup was successful
    }

    // Invalidate all caches for this user
    try {
      await CacheManager.invalidateUserCaches(user_id);
      logger.info(`deleteUser: Invalidated caches for user ${user_id}`);
    } catch (cacheError) {
      logger.warn(
        `deleteUser: Failed to invalidate caches for user ${user_id}:`,
        cacheError as any,
      );
      // Continue with response even if cache invalidation fails
    }

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
          user_answers_deleted: deletionCounts.deletedUserAnswers,
          exam_attempts_deleted: deletionCounts.deletedExamAttempts,
          user_certifications_deleted: deletionCounts.deletedUserCertifications,
        },
        validation: {
          completely_deleted: validationResults.isCompletelyDeleted,
          remaining_data_check: validationResults.remainingData,
        },
      },
    });
  } catch (error) {
    logger.error('deleteUser: Error deleting user:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
