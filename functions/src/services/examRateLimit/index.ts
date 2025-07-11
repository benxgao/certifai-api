import logger from '../firebase/logger';
import prismaInstance from '../prisma';
import { MAX_EXAMS_PER_24_HOURS } from '../../endpoints/api/users/exams/createExam';
import {
  calculateRateLimitFromExams,
  getDetailedRateLimitInfo,
  type ExamData,
} from '../../utils/examRateLimit';

export interface ExamRateLimitResult {
  isAllowed: boolean;
  currentCount: number;
  remainingCount: number;
  resetTimeMs: number; // Time when the limit resets (in milliseconds since epoch)
  error?: string;
}

/**
 * Optimized rate limit check that can use pre-fetched exam data
 * Falls back to database query if no exam data is provided
 *
 * @param userId - The user's internal UUID
 * @param examData - Optional pre-fetched exam data to avoid additional queries
 * @returns ExamRateLimitResult indicating if exam creation is allowed
 */
export async function checkExamRateLimit(
  userId: string,
  examData?: ExamData[],
): Promise<ExamRateLimitResult> {
  try {
    // If exam data is provided, use the optimized calculation
    if (examData && examData.length >= 0) {
      logger.info(
        `Using provided exam data for rate limit check for user: ${userId}`,
      );

      const rateLimitInfo = calculateRateLimitFromExams(examData, userId);

      // Convert ExamRateLimitInfo to legacy ExamRateLimitResult format
      return {
        isAllowed: rateLimitInfo.isAllowed,
        currentCount: rateLimitInfo.currentCount,
        remainingCount: rateLimitInfo.remainingCount,
        resetTimeMs: rateLimitInfo.resetTimeMs,
        error: rateLimitInfo.error,
      };
    }

    // Legacy database query fallback
    logger.info(
      `Checking exam rate limit via database query for user: ${userId}`,
    );

    // Calculate 24 hours ago from now
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Count exams created by this user in the last 24 hours
    const examCount = await prismaInstance.examAttempt.count({
      where: {
        user_id: userId,
        started_at: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    logger.info(
      `User ${userId} has created ${examCount} exams in the last 24 hours (limit: ${MAX_EXAMS_PER_24_HOURS})`,
    );

    const isAllowed = examCount < MAX_EXAMS_PER_24_HOURS;
    const remainingCount = Math.max(0, MAX_EXAMS_PER_24_HOURS - examCount);

    // Calculate reset time: 24 hours from the oldest exam in the window
    let resetTimeMs = Date.now() + 24 * 60 * 60 * 1000; // Default to 24 hours from now

    if (examCount > 0) {
      // Get the oldest exam in the current 24-hour window
      const oldestExam = await prismaInstance.examAttempt.findFirst({
        where: {
          user_id: userId,
          started_at: {
            gte: twentyFourHoursAgo,
          },
        },
        orderBy: {
          started_at: 'asc',
        },
        select: {
          started_at: true,
        },
      });

      if (oldestExam) {
        // Reset time is 24 hours after the oldest exam
        resetTimeMs = oldestExam.started_at.getTime() + 24 * 60 * 60 * 1000;
      }
    }

    const result: ExamRateLimitResult = {
      isAllowed,
      currentCount: examCount,
      remainingCount,
      resetTimeMs,
    };

    if (!isAllowed) {
      result.error = `Rate limit exceeded. You can create a maximum of ${MAX_EXAMS_PER_24_HOURS} exams per 24 hours. Please try again later.`;
    }

    return result;
  } catch (error) {
    logger.error('Error checking exam rate limit:', error as any);

    return {
      isAllowed: false,
      currentCount: 0,
      remainingCount: 0,
      resetTimeMs: Date.now() + 24 * 60 * 60 * 1000,
      error: 'Failed to check rate limit. Please try again.',
    };
  }
}

/**
 * Gets detailed rate limit information for a user including when they can create their next exam.
 * Can use pre-fetched exam data for optimization
 *
 * @param userId - The user's internal UUID
 * @param examData - Optional pre-fetched exam data to avoid additional queries
 * @returns Detailed rate limit information
 */
export async function getExamRateLimitInfo(
  userId: string,
  examData?: ExamData[],
): Promise<{
  maxExamsAllowed: number;
  currentCount: number;
  remainingCount: number;
  canCreateExam: boolean;
  nextAvailableTime?: Date;
  hoursUntilNextExam?: number;
}> {
  try {
    // Use the optimized calculation if exam data is provided
    if (examData && examData.length >= 0) {
      logger.info(
        `Using provided exam data for detailed rate limit info for user: ${userId}`,
      );

      const rateLimitInfo = calculateRateLimitFromExams(examData, userId);
      const detailedInfo = getDetailedRateLimitInfo(rateLimitInfo);

      // Convert string dates back to Date objects for consistency with legacy API
      const result = {
        maxExamsAllowed: detailedInfo.maxExamsAllowed,
        currentCount: detailedInfo.currentCount,
        remainingCount: detailedInfo.remainingCount,
        canCreateExam: detailedInfo.canCreateExam,
      };

      if (
        'nextAvailableTime' in detailedInfo &&
        detailedInfo.nextAvailableTime
      ) {
        return {
          ...result,
          nextAvailableTime: new Date(detailedInfo.nextAvailableTime),
          hoursUntilNextExam: detailedInfo.hoursUntilNextExam,
        };
      }

      return result;
    }

    // Fallback to legacy method
    const rateLimitResult = await checkExamRateLimit(userId);

    const result = {
      maxExamsAllowed: MAX_EXAMS_PER_24_HOURS,
      currentCount: rateLimitResult.currentCount,
      remainingCount: rateLimitResult.remainingCount,
      canCreateExam: rateLimitResult.isAllowed,
    };

    if (!rateLimitResult.isAllowed && rateLimitResult.resetTimeMs) {
      const nextAvailableTime = new Date(rateLimitResult.resetTimeMs);
      const hoursUntilNextExam = Math.ceil(
        (rateLimitResult.resetTimeMs - Date.now()) / (1000 * 60 * 60),
      );

      return {
        ...result,
        nextAvailableTime,
        hoursUntilNextExam,
      };
    }

    return result;
  } catch (error) {
    logger.error('Error getting rate limit info:', error as any);

    return {
      maxExamsAllowed: MAX_EXAMS_PER_24_HOURS,
      currentCount: 0,
      remainingCount: 0,
      canCreateExam: false,
    };
  }
}
