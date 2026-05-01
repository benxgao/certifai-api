import logger from '../services/firebase/logger';
import { MAX_EXAMS_PER_24_HOURS } from '../endpoints/api/users/exams/createExam';

// Interface for exam data used in rate limit calculations
export interface ExamData {
  exam_id: string;
  started_at: Date | string;
  exam_status: string;
  submitted_at?: Date | string | null;
}

// Interface for rate limit information
export interface ExamRateLimitInfo {
  maxExamsAllowed: number;
  currentCount: number;
  remainingCount: number;
  isAllowed: boolean;
  resetTimeMs: number;
  error?: string;
}

// Interface for detailed rate limit info with time calculations
export interface DetailedRateLimitInfo extends ExamRateLimitInfo {
  canCreateExam: boolean;
  nextAvailableTime?: string;
  hoursUntilNextExam?: number;
}

// Interface for formatted rate limit response
export interface RateLimitResponse {
  maxExamsAllowed: number;
  currentCount: number;
  remainingCount: number;
  canCreateExam: boolean;
  resetTime: string;
  error?: string;
}

/**
 * Calculate rate limit information from exam data
 * This function reuses exam data that's already been fetched to avoid additional database calls
 *
 * @param examData - Array of exam data to analyze
 * @param userId - User ID for logging purposes
 * @returns Rate limit information calculated from the provided exam data
 */
export function calculateRateLimitFromExams(
  examData: ExamData[],
  userId: string,
): ExamRateLimitInfo {
  try {
    // Calculate 24 hours ago from now
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Filter exams created in the last 24 hours
    const recentExams = examData.filter((exam) => {
      const startedAt = new Date(exam.started_at);
      return startedAt >= twentyFourHoursAgo;
    });

    const currentCount = recentExams.length;
    const remainingCount = Math.max(0, MAX_EXAMS_PER_24_HOURS - currentCount);
    const isAllowed = currentCount < MAX_EXAMS_PER_24_HOURS;

    // Calculate reset time: 24 hours from the oldest exam in the window
    let resetTimeMs = Date.now() + 24 * 60 * 60 * 1000; // Default to 24 hours from now

    if (recentExams.length > 0) {
      // Sort by started_at to find the oldest exam
      const sortedExams = recentExams.sort(
        (a, b) =>
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
      );
      const oldestExam = sortedExams[0];

      // Reset time is 24 hours after the oldest exam
      resetTimeMs =
        new Date(oldestExam.started_at).getTime() + 24 * 60 * 60 * 1000;
    }

    const result: ExamRateLimitInfo = {
      maxExamsAllowed: MAX_EXAMS_PER_24_HOURS,
      currentCount,
      remainingCount,
      isAllowed,
      resetTimeMs,
    };

    if (!isAllowed) {
      result.error = `Rate limit exceeded. You can create a maximum of ${MAX_EXAMS_PER_24_HOURS} exams per 24 hours. Please try again later.`;
    }

    logger.info(
      `Rate limit calculated from exam data for user ${userId}: ${currentCount}/${MAX_EXAMS_PER_24_HOURS} exams used, allowed: ${isAllowed}`,
    );

    return result;
  } catch (error) {
    logger.error('Error calculating rate limit from exam data:', error);

    return {
      maxExamsAllowed: MAX_EXAMS_PER_24_HOURS,
      currentCount: 0,
      remainingCount: MAX_EXAMS_PER_24_HOURS,
      isAllowed: true,
      resetTimeMs: Date.now() + 24 * 60 * 60 * 1000,
      error: 'Failed to calculate rate limit. Please try again.',
    };
  }
}

/**
 * Get detailed rate limit information including time calculations
 *
 * @param rateLimitInfo - Basic rate limit information
 * @returns Detailed rate limit information with time calculations
 */
export function getDetailedRateLimitInfo(
  rateLimitInfo: ExamRateLimitInfo,
): DetailedRateLimitInfo {
  const result: DetailedRateLimitInfo = {
    ...rateLimitInfo,
    canCreateExam: rateLimitInfo.isAllowed,
  };

  // Add time calculations if rate limit is exceeded
  if (!rateLimitInfo.isAllowed && rateLimitInfo.resetTimeMs) {
    const now = Date.now();
    const timeUntilReset = rateLimitInfo.resetTimeMs - now;

    if (timeUntilReset > 0) {
      result.nextAvailableTime = new Date(
        rateLimitInfo.resetTimeMs,
      ).toISOString();
      result.hoursUntilNextExam = Math.ceil(timeUntilReset / (1000 * 60 * 60));
    }
  }

  return result;
}

/**
 * Format rate limit information for API response
 *
 * @param rateLimitInfo - Rate limit information to format
 * @returns Formatted rate limit response suitable for API responses
 */
export function formatRateLimitResponse(
  rateLimitInfo: ExamRateLimitInfo,
): RateLimitResponse {
  return {
    maxExamsAllowed: rateLimitInfo.maxExamsAllowed,
    currentCount: rateLimitInfo.currentCount,
    remainingCount: rateLimitInfo.remainingCount,
    canCreateExam: rateLimitInfo.isAllowed,
    resetTime: new Date(rateLimitInfo.resetTimeMs).toISOString(),
    error: rateLimitInfo.error,
  };
}

/**
 * Transform exam database result to ExamData format
 *
 * @param exam - Raw exam data from database
 * @returns ExamData formatted for rate limit calculations
 */
export function transformToExamData(exam: {
  exam_id: string;
  started_at: Date | string;
  exam_status: string;
  submitted_at?: Date | string | null;
}): ExamData {
  return {
    exam_id: exam.exam_id,
    started_at: exam.started_at,
    exam_status: exam.exam_status,
    submitted_at: exam.submitted_at,
  };
}
