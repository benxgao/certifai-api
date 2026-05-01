import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import { RedisService, CACHE_CONFIG } from '../../../services/redis';
import { CacheHierarchyService } from '../../../services/cache/cacheHierarchy';
import { AuthenticatedRequestHandler, ApiResponse } from '../../../types/express';
import { UserProfileData } from '../../../types/api/users';

const handler: AuthenticatedRequestHandler<
  unknown,
  ApiResponse<UserProfileData>,
  { user_id: string }
> = async (req, res): Promise<void> => {
  try {
    const { user_id } = req.params;
    const firebaseUserIdFromToken = req.firebase_user_info?.uid;
    const verifiedUser = req.verified_user; // Added by verifyUserAccess middleware

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

    // User verification is now handled by verifyUserAccess middleware
    // We can use the verified user directly
    if (!verifiedUser) {
      res.status(500).json({
        success: false,
        error: 'User verification middleware not properly configured',
      });
      return;
    }

    logger.info(`Getting user profile for user_id: ${user_id}`);

    // Generate cache key for user profile
    const cacheKey = RedisService.generateUserCacheKey(
      CACHE_CONFIG.KEYS.USER_PROFILE,
      user_id,
    );

    // Get user profile with cache
    const user = await CacheHierarchyService.getOrSet(
      cacheKey,
      async () => {
        logger.info(
          `Cache miss - fetching user profile from database for user ${user_id}`,
        );

        // Get the full user profile data
        return await prismaInstance.user.findUnique({
          where: { user_id: user_id },
          select: {
            user_id: true,
            firebase_user_id: true,
            credit_tokens: true,
            energy_tokens: true,
            created_at: true,
            updated_at: true,
          },
        });
      },
      CACHE_CONFIG.USER_PROFILE_TTL,
      { forceMemoryCache: false }, // Profile data can be large, use Redis cache
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: `User with ID: ${user_id} not found.`,
      });
      return;
    }

    logger.info(
      `Successfully retrieved profile for user ${user.user_id} with ${user.credit_tokens} credit tokens.`,
    );

    res.status(200).json({
      success: true,
      data: {
        api_user_id: user.user_id, // Our internal UUID for API operations
        firebase_user_id: user.firebase_user_id ?? '', // Firebase UID for reference
        credit_tokens: user.credit_tokens,
        energy_tokens: user.energy_tokens,
        created_at: new Date(user.created_at).toISOString(),
        updated_at: new Date(user.updated_at).toISOString(),
        // Deprecated: keeping for backward compatibility only
        user_id: user.user_id, // @deprecated Use api_user_id instead
      },
    });
  } catch (error) {
    logger.error('Error in getUserProfile handler:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
