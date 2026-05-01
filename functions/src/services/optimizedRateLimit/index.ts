import { RedisService } from '../redis';
import logger from '../firebase/logger';
import { PerformanceMonitor } from '../performance';

export interface OptimizedRateLimitResult {
  isAllowed: boolean;
  currentCount: number;
  remainingCount: number;
  resetTimeMs: number;
  error?: string;
}

/**
 * Redis-based rate limiting service for high performance
 * Replaces database-based rate limiting to reduce DB load
 */
export class OptimizedRateLimitService {
  private static readonly RATE_LIMIT_PREFIX = 'rate_limit:exam:';
  private static readonly WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private static readonly MAX_EXAMS_PER_24_HOURS = 3;

  /**
   * Check exam rate limit using Redis for high performance
   * @param userId - The user's internal UUID
   * @returns Promise<OptimizedRateLimitResult>
   */
  static async checkExamRateLimit(
    userId: string,
  ): Promise<OptimizedRateLimitResult> {
    const startTime = Date.now();

    try {
      const cacheKey = `${this.RATE_LIMIT_PREFIX}${userId}`;
      const now = Date.now();
      const windowStart = now - this.WINDOW_MS;

      // Use Redis sorted set to track exam timestamps
      // This allows us to efficiently count exams in the time window

      // First, clean up old entries
      await RedisService.zRemRangeByScore(cacheKey, 0, windowStart - 1);

      const examData = await RedisService.zRangeByScoreWithScores(
        cacheKey,
        windowStart,
        now,
      );

      const currentCount = examData?.length || 0;
      const duration = Date.now() - startTime;

      // Track performance
      PerformanceMonitor.trackRateLimitCheck(
        userId,
        duration,
        'redis',
        currentCount < this.MAX_EXAMS_PER_24_HOURS,
      );

      // Fix the comparison logic: should be >= not >
      if (currentCount >= this.MAX_EXAMS_PER_24_HOURS) {
        // Calculate reset time based on oldest exam in window
        let resetTimeMs = now + this.WINDOW_MS; // Default to 24 hours from now

        if (examData && examData.length > 0) {
          try {
            // Sort by score (timestamp) to get the oldest exam
            const sortedExams = examData.sort((a, b) => a.score - b.score);
            const oldestExamTime = sortedExams[0].score;
            // Reset time should be when the oldest exam expires (24 hours after it was created)
            resetTimeMs = oldestExamTime + this.WINDOW_MS;

            // Ensure reset time is in the future
            if (resetTimeMs <= now) {
              resetTimeMs = now + this.WINDOW_MS;
            }
          } catch {
            logger.warn(`Failed to parse oldest exam timestamp from exam data`);
            resetTimeMs = now + this.WINDOW_MS;
          }
        }

        logger.info(
          `Rate limit exceeded for user ${userId}: ${currentCount}/${this.MAX_EXAMS_PER_24_HOURS} exams`,
        );

        return {
          isAllowed: false,
          currentCount,
          remainingCount: 0,
          resetTimeMs,
          error: `Rate limit exceeded. You can create a maximum of ${this.MAX_EXAMS_PER_24_HOURS} exams per 24 hours.`,
        };
      }

      logger.info(
        `Rate limit check passed for user ${userId}: ${currentCount}/${this.MAX_EXAMS_PER_24_HOURS} exams`,
      );

      return {
        isAllowed: true,
        currentCount,
        remainingCount: this.MAX_EXAMS_PER_24_HOURS - currentCount,
        resetTimeMs: now + this.WINDOW_MS,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      PerformanceMonitor.trackRateLimitCheck(userId, duration, 'redis', false);

      logger.error(
        `Error checking rate limit for user ${userId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      );

      // Fallback to allowing the request if Redis fails
      // This ensures availability over strict rate limiting
      return {
        isAllowed: true,
        currentCount: 0,
        remainingCount: this.MAX_EXAMS_PER_24_HOURS,
        resetTimeMs: Date.now() + this.WINDOW_MS,
        error: 'Rate limit check failed, allowing request',
      };
    }
  }

  /**
   * Record a new exam creation in the rate limit tracker
   * @param userId - The user's internal UUID
   * @param examId - The exam ID for tracking
   */
  static async recordExamCreation(
    userId: string,
    examId: string,
  ): Promise<void> {
    try {
      const cacheKey = `${this.RATE_LIMIT_PREFIX}${userId}`;
      const now = Date.now();
      const windowStart = now - this.WINDOW_MS;

      // Add current exam to sorted set with timestamp as score
      await RedisService.zAdd(cacheKey, now, examId);

      // Remove old entries outside the time window
      await RedisService.zRemRangeByScore(cacheKey, 0, windowStart - 1);

      // Set expiration on the key to prevent memory leaks
      await RedisService.expire(cacheKey, this.WINDOW_MS / 1000);

      logger.info(`Recorded exam creation for user ${userId}: exam ${examId}`);
    } catch (error) {
      logger.error(
        `Error recording exam creation for user ${userId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      );
      // Don't throw here - exam creation should succeed even if tracking fails
    }
  }

  /**
   * Get detailed rate limit information for a user
   * @param userId - The user's internal UUID
   * @returns Promise<OptimizedRateLimitResult & { nextAllowedTime?: number }>
   */
  static async getDetailedRateLimitInfo(
    userId: string,
  ): Promise<OptimizedRateLimitResult & { nextAllowedTime?: number }> {
    const result = await this.checkExamRateLimit(userId);

    if (!result.isAllowed && result.currentCount > 0) {
      // Calculate when the user can create their next exam
      // This would be when the oldest exam in the window expires
      const cacheKey = `${this.RATE_LIMIT_PREFIX}${userId}`;
      const now = Date.now();
      const windowStart = now - this.WINDOW_MS;

      try {
        const examData = await RedisService.zRangeByScoreWithScores(
          cacheKey,
          windowStart,
          now,
        );

        if (examData && examData.length > 0) {
          // Sort by score (timestamp) to get the oldest exam
          const sortedExams = examData.sort((a, b) => a.score - b.score);
          const oldestExamTime = sortedExams[0].score;
          const nextAllowedTime = oldestExamTime + this.WINDOW_MS;

          return {
            ...result,
            nextAllowedTime,
          };
        }
      } catch (error) {
        logger.error(
          `Error getting detailed rate limit info for user ${userId}:`,
          { error: error instanceof Error ? error.message : String(error) },
        );
      }
    }

    return result;
  }

  /**
   * Clear rate limit data for a user (admin function)
   * @param userId - The user's internal UUID
   */
  static async clearUserRateLimit(userId: string): Promise<void> {
    try {
      const cacheKey = `${this.RATE_LIMIT_PREFIX}${userId}`;
      await RedisService.del(cacheKey);
      logger.info(`Cleared rate limit data for user ${userId}`);
    } catch (error) {
      logger.error(
        `Error clearing rate limit for user ${userId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      );
      throw error;
    }
  }

  /**
   * Clear all rate limit data for all users (debug function)
   */
  static async clearAllRateLimits(): Promise<void> {
    try {
      await RedisService.delPattern(`${this.RATE_LIMIT_PREFIX}*`);
      logger.info('Cleared all rate limit data');
    } catch (error) {
      logger.error('Error clearing all rate limits:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get debug information for a user's rate limit state
   * @param userId - The user's internal UUID
   */
  static async getDebugInfo(userId: string): Promise<{
    cacheKey: string;
    windowStart: number;
    windowEnd: number;
    examIds: string[];
    timestamps: number[];
    currentCount: number;
    isAllowed: boolean;
  }> {
    const cacheKey = `${this.RATE_LIMIT_PREFIX}${userId}`;
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;

    try {
      const examData = await RedisService.zRangeByScoreWithScores(
        cacheKey,
        windowStart,
        now,
      );

      const examIds = examData.map((item) => item.member);
      const timestamps = examData.map((item) => item.score);

      return {
        cacheKey,
        windowStart,
        windowEnd: now,
        examIds,
        timestamps,
        currentCount: examData.length,
        isAllowed: examData.length < this.MAX_EXAMS_PER_24_HOURS,
      };
    } catch (error) {
      logger.error(
        `Error getting debug info for user ${userId}:`,
        { error: error instanceof Error ? error.message : String(error) },
      );
      throw error;
    }
  }
}

export default OptimizedRateLimitService;
