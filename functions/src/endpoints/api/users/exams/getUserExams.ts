import logger from '../../../../services/firebase/logger';
import { AuthenticatedRequestHandler } from '../../../../types/express';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';
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
type GetUserExamsQuery = {
  cert_id?: string | string[];
  sort_by?: string | string[];
  sort_order?: string | string[];
  page?: string | number;
  pageSize?: string | number;
  limit?: string | number;
};

const handler: AuthenticatedRequestHandler<
  unknown,
  Record<string, unknown>,
  { user_id: string },
  GetUserExamsQuery
> = async (req, res): Promise<void> => {
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

    // if (!firebaseUserIdFromToken) {
    //   res.status(401).json({
    //     success: false,
    //     error: 'Unauthorized: Firebase token missing.',
    //   });
    //   return;
    // }

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

    // 2. Authorization: Check firebase_user_id from token if available
    // If token has firebase user ID, verify it matches
    if (firebaseUserIdFromToken && user.firebase_user_id !== firebaseUserIdFromToken) {
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

    const whereClause: {
      user_id: string;
      cert_id?: number;
    } = {
      user_id: actualUserId,
    };

    if (cert_id) {
      whereClause.cert_id = parseInt(Array.isArray(cert_id) ? cert_id[0] : (cert_id ?? ''), 10);
    }

    // Configure sorting options with started_at as default
    const validSortFields = [
      'started_at',
      'submitted_at',
      'score',
      'exam_status',
    ] as const;
    const validSortOrders = ['asc', 'desc'] as const;

    type SortField = (typeof validSortFields)[number];
    type SortOrder = (typeof validSortOrders)[number];

    const isSortField = (value: unknown): value is SortField =>
      typeof value === 'string' &&
      validSortFields.includes(value as SortField);
    const isSortOrder = (value: unknown): value is SortOrder =>
      typeof value === 'string' &&
      validSortOrders.includes(value as SortOrder);

    const narrowedSortBy = Array.isArray(sort_by) ? sort_by[0] : sort_by;
    const sortField = isSortField(narrowedSortBy)
      ? narrowedSortBy
      : 'started_at';
    const narrowedSortOrder = Array.isArray(sort_order) ? sort_order[0] : sort_order;
    const sortDirection = isSortOrder(narrowedSortOrder)
      ? narrowedSortOrder
      : 'desc';

    const orderBy = { [sortField]: sortDirection };

    logger.info(
      `Fetching exams for user_id: ${user_id} with sorting: ${sortField} ${sortDirection}${
        cert_id ? ` and cert_id: ${cert_id}` : ''
      }`,
    );

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

    // Use cache for exams - memory cache is now selectively cleared on status changes
    // This ensures fast access while still providing fresh data when exams complete generation
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
        computedStatus = ExamStatus.COMPLETED;
      } else if (exam.exam_status === ExamStatus.READY && exam.started_at) {
        // If exam is ready and has been started, it's in progress
        computedStatus = ExamStatus.IN_PROGRESS;
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
    logger.error('Error in getUserExams handler:', {
      error_message: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      error_stack: error instanceof Error ? error.stack : undefined,
    });
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
