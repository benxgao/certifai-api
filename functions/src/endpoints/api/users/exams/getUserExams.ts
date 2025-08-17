import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';
import {
  extractPaginationParams,
  createPaginatedResponse,
  findManyWithCount,
} from '../../../../utils/pagination';
import {
  calculateRateLimitFromExams,
  formatRateLimitResponse,
} from '../../../../utils/examRateLimit';
import { RedisService, CACHE_CONFIG } from '../../../../services/redis';
import { CacheHierarchyService } from '../../../../services/cache/cacheHierarchy';

/**
 * Handler for getting all exams for a user with enhanced sorting capabilities
 *
 * @param req - Express request object
 * @param req.params.user_id - The user ID
 * @param req.query.cert_id - Optional certification ID filter
 * @param req.query.sort_by - Optional sort field (started_at, submitted_at, score, exam_status)
 * @param req.query.sort_order - Optional sort order (asc, desc)
 * @param res - Express response object
 *
 * @example
 * GET /api/users/123/exams?sort_by=started_at&sort_order=desc
 * GET /api/users/123/exams?cert_id=456&sort_by=score&sort_order=asc
 */
const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id } = req.params;
    const { cert_id, sort_by, sort_order } = req.query; // Add sorting parameters
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

    // 1. Find the user by the provided user_id (internal UUID) or firebase_user_id
    let user = await prismaInstance.user.findUnique({
      where: { user_id: user_id },
    });

    // If not found by user_id, try to find by firebase_user_id
    if (!user) {
      user = await prismaInstance.user.findUnique({
        where: { firebase_user_id: user_id },
      });
    }

    if (!user) {
      res
        .status(404)
        .json({ success: false, error: `User with ID: ${user_id} not found.` });
      return;
    }

    // 2. Authorization: Check if the firebase_user_id from token matches the user's firebase_user_id
    if (user.firebase_user_id !== firebaseUserIdFromToken) {
      logger.warn(
        `Forbidden: Firebase user ${firebaseUserIdFromToken} attempted to fetch exams for user ${user_id}.`,
      );
      res.status(403).json({
        success: false,
        error: 'Forbidden: You can only access your own exams.',
      });
      return;
    }

    // Use the internal user_id for the database query
    const actualUserId = user.user_id;

    // Extract pagination parameters
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 50,
    });

    const whereClause: any = {
      user_id: actualUserId,
    };

    if (cert_id) {
      whereClause.cert_id = parseInt(cert_id as string, 10);
    }

    // Configure sorting options with started_at as default
    const validSortFields = [
      'started_at',
      'submitted_at',
      'score',
      'exam_status',
    ] as const;
    const validSortOrders = ['asc', 'desc'] as const;

    const sortField = validSortFields.includes(sort_by as any)
      ? (sort_by as string)
      : 'started_at';
    const sortDirection = validSortOrders.includes(sort_order as any)
      ? (sort_order as string)
      : 'desc';

    const orderBy = { [sortField]: sortDirection };

    logger.info(
      `Fetching exams for user_id: ${user_id} with sorting: ${sortField} ${sortDirection}${
        cert_id ? ` and cert_id: ${cert_id}` : ''
      }`,
    );

    // Note: Previously bypassed cache for generating exams, but now we use RTDB for progress tracking
    // This allows us to use cache for better performance while progress is tracked separately

    // Create cache key for user exams
    const cacheKey = RedisService.generateUserCacheKey(
      CACHE_CONFIG.KEYS.USER_EXAMS,
      actualUserId,
      {
        page: paginationParams.page,
        pageSize: paginationParams.pageSize,
        cert_id,
        sortField,
        sortDirection,
      },
    );

    // Always use cache since progress is now handled via RTDB
    const { data: examsFromDb, total } = await CacheHierarchyService.getOrSet(
      cacheKey,
      async () => {
        logger.info(
          `Cache miss - fetching exams from database for user ${actualUserId}`,
        );

        // Execute findMany and count in parallel
        return await findManyWithCount(
          prismaInstance.examAttempt.findMany({
            where: whereClause,
            include: {
              certification: true, // Include certification details
            },
            skip: paginationParams.skip,
            take: paginationParams.take,
            orderBy,
          }),
          prismaInstance.examAttempt.count({
            where: whereClause,
          }),
        );
      },
      CACHE_CONFIG.USER_EXAMS_TTL,
      { forceMemoryCache: true }, // Use memory cache for frequently accessed user data
    );

    // Create response with proper data structure
    if (examsFromDb.length === 0) {
      // Even with no exams, calculate rate limit (will show all 3 available)
      const rateLimitInfo = calculateRateLimitFromExams([], actualUserId);
      const rateLimitData = formatRateLimitResponse(rateLimitInfo);

      const response = createPaginatedResponse([], total, paginationParams);
      const enhancedResponse = {
        ...response,
        rateLimit: rateLimitData,
      };

      res.status(200).json(enhancedResponse);
      return;
    }

    // findMany returns an empty array if no records are found, so a 404 might not be appropriate here.
    // Sending a 200 with an empty array is common practice.
    // However, if the requirement is to return 404 for no exams, this check can be modified:
    // if (exams.length === 0) {
    //   res.status(404).json({
    //     success: false,
    //     error: 'No exams found for this user.',
    //   });
    //   return;
    // }

    const exams = examsFromDb.map((exam) => {
      let computedStatus: string = exam.exam_status; // Use the actual exam_status from database

      // Override status based on submission
      if (exam.submitted_at) {
        computedStatus = 'COMPLETED';
      } else if (exam.exam_status === 'READY' && exam.started_at) {
        // If exam is ready and has been started, it's in progress
        computedStatus = 'IN_PROGRESS';
      }

      return {
        exam_id: exam.exam_id,
        api_user_id: exam.user_id, // Our internal UUID for API operations
        cert_id: exam.cert_id,
        exam_status: exam.exam_status, // Include the actual database status for reference
        score: exam.score,
        token_cost: exam.token_cost,
        total_questions: exam.total_questions, // Add total_questions field
        custom_prompt_text: exam.custom_prompt_text, // Add custom_prompt_text field
        started_at: exam.started_at, // Use correct field name
        submitted_at: exam.submitted_at, // Use correct field name
        certification: exam.certification, // Include certification details for additional context
        status: computedStatus, // Keep computed status for backward compatibility
        // Deprecated: keeping for backward compatibility only
        user_id: exam.user_id, // @deprecated Use api_user_id instead
      };
    });

    // Calculate rate limit information from the exam data we already have
    // This eliminates the need for separate rate limit API calls
    const examDataForRateLimit = examsFromDb.map((exam) => ({
      exam_id: exam.exam_id,
      started_at: exam.started_at,
      exam_status: exam.exam_status,
      submitted_at: exam.submitted_at,
    }));

    const rateLimitInfo = calculateRateLimitFromExams(
      examDataForRateLimit,
      actualUserId,
    );
    const rateLimitData = formatRateLimitResponse(rateLimitInfo);

    // Create paginated response with rate limit information
    const response = createPaginatedResponse(exams, total, paginationParams);

    // Add rate limit information to the response for client convenience
    const enhancedResponse = {
      ...response,
      rateLimit: rateLimitData,
    };

    res.status(200).json(enhancedResponse);
  } catch (error) {
    logger.error('Error in getUserExams handler:', error as any);
    res
      .status(
        error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
      )
      .json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
  }
};

export default handler;
