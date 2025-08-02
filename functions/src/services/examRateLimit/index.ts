import logger from '../firebase/logger';
import prismaInstance from '../prisma';
import { MAX_EXAMS_PER_24_HOURS } from '../../endpoints/api/users/exams/createExam';
import {
  calculateRateLimitFromExams,
  type ExamData,
  type ExamRateLimitInfo,
} from '../../utils/examRateLimit';
import { RedisService, CACHE_CONFIG } from '../redis';
import { CacheHierarchyService } from '../cache/cacheHierarchy';

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

    // Legacy database query fallback with caching
    logger.info(
      `Checking exam rate limit via database query for user: ${userId}`,
    );

    // Generate cache key for rate limit data
    const cacheKey = RedisService.generateUserCacheKey(
      CACHE_CONFIG.KEYS.USER_RATE_LIMIT,
      userId,
    );

    // Get rate limit data with cache
    const rateLimitResult = await CacheHierarchyService.getOrSet(
      cacheKey,
      async () => {
        logger.info(
          `Cache miss - fetching rate limit data from database for user ${userId}`,
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
      },
      CACHE_CONFIG.USER_RATE_LIMIT_TTL,
      { forceMemoryCache: true }, // Use memory cache for frequently accessed rate limit data
    );

    return rateLimitResult;
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
export const getExamRateLimitInfo = async (
  userId: string,
): Promise<ExamRateLimitInfo> => {
  try {
    // Generate cache key for rate limit info
    const cacheKey = RedisService.generateUserCacheKey(
      CACHE_CONFIG.KEYS.USER_RATE_LIMIT,
      userId,
    );

    // Get rate limit info with cache
    const rateLimitInfo = await CacheHierarchyService.getOrSet(
      cacheKey,
      async () => {
        logger.info(
          `Cache miss - fetching rate limit info from database for user ${userId}`,
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

        return {
          maxExamsAllowed: MAX_EXAMS_PER_24_HOURS,
          currentCount: examCount,
          remainingCount,
          isAllowed: examCount < MAX_EXAMS_PER_24_HOURS,
          resetTimeMs,
        };
      },
      CACHE_CONFIG.USER_RATE_LIMIT_TTL,
      { forceMemoryCache: true }, // Use memory cache for frequently accessed rate limit data
    );

    return rateLimitInfo;
  } catch (error) {
    logger.error(`Error checking exam rate limit info for user ${userId}:`, {
      error,
    });
    throw error;
  }
};
