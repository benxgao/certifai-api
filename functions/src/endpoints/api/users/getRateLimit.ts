import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { CustomRequest } from '../../../types';
import { getExamRateLimitInfo } from '../../../services/examRateLimit';

/**
 * Gets the current rate limit information for a user
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "maxExamsAllowed": 3,
 *     "currentCount": 1,
 *     "remainingCount": 2,
 *     "canCreateExam": true,
 *     "nextAvailableTime": "2025-07-03T10:30:00.000Z", // Only if canCreateExam is false
 *     "hoursUntilNextExam": 2 // Only if canCreateExam is false
 *   }
 * }
 */
const handler = async (
  req: any | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id } = req.params;
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

    logger.info(
      `RATE_LIMIT_INFO_REQUEST: user_id=${user_id}, firebase_user_id=${firebaseUserIdFromToken}`,
    );

    // Get rate limit information for the user
    const rateLimitInfo = await getExamRateLimitInfo(user_id);

    logger.info(
      `RATE_LIMIT_INFO_SUCCESS: user_id=${user_id}, canCreateExam=${rateLimitInfo.canCreateExam}, currentCount=${rateLimitInfo.currentCount}`,
    );

    res.status(200).json({
      success: true,
      data: rateLimitInfo,
    });
  } catch (error) {
    logger.error('Error getting rate limit info:', error as any);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
