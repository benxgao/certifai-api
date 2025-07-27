import { RedisService } from '../redis';
import logger from '../firebase/logger';

/**
 * Cache Management Service
 *
 * Provides high-level utilities for managing cache invalidation across the application.
 * This service ensures data consistency by properly invalidating related cache entries
 * when underlying data changes.
 *
 * Key Responsibilities:
 * - Coordinate cache invalidation across different data types
 * - Handle cascade invalidation (when one change affects multiple cache entries)
 * - Provide semantic invalidation methods for business logic events
 * - Ensure cache consistency without manual key management
 */
export class CacheManager {
  /**
   * Invalidate all cache entries related to a user's exam data
   *
   * Called when:
   * - User starts a new exam
   * - User completes an exam
   * - Exam results are updated
   * - User exam permissions change
   *
   * @param userId - The user whose exam cache should be invalidated
   */
  static async invalidateUserExamCache(userId: string): Promise<void> {
    try {
      logger.info(`Invalidating user exam cache for user ${userId}`);

      // Invalidate all exam-related cache entries for this user
      await RedisService.invalidateUserCache(userId, 'exams');
      await RedisService.invalidateUserCache(userId, 'exam_questions');
      await RedisService.invalidateUserCache(userId, 'exam_details');

      logger.info('User exam cache invalidation completed');
    } catch (error) {
      logger.error(`Error invalidating user exam cache: ${error}`);
      // Don't throw - cache invalidation failures shouldn't break business logic
    }
  }

  /**
   * Invalidate user exam cache when exam status changes to/from generating states
   *
   * This method is specifically called when:
   * - Exam status changes to QUESTIONS_GENERATING (exam creation)
   * - Exam status changes from QUESTIONS_GENERATING to READY (generation complete)
   * - Exam status changes to QUESTION_GENERATION_FAILED (generation failed)
   *
   * The invalidation ensures that subsequent calls to getUserExams will:
   * - Bypass cache when exams are generating (for real-time progress)
   * - Return to normal caching when no exams are generating
   *
   * @param userId - The user whose exam cache should be invalidated
   * @param reason - The reason for cache invalidation (for logging)
   */
  static async invalidateUserExamCacheForGenerationChange(
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      logger.info(
        `Invalidating user exam cache for generation status change: user ${userId}, reason: ${reason}`,
      );

      // Invalidate exam cache to ensure fresh data
      await RedisService.invalidateUserCache(userId, 'exams');

      logger.info(
        'User exam cache invalidation completed for generation change',
      );
    } catch (error) {
      logger.error(
        `Error invalidating user exam cache for generation change: ${error}`,
      );
      // Don't throw - cache invalidation failures shouldn't break business logic
    }
  }

  /**
   * Invalidate all cache entries related to a user's certification data
   *
   * Called when:
   * - User earns a new certification
   * - User's certification status changes
   * - Certification requirements are updated
   * - User certification progress changes
   *
   * @param userId - The user whose certification cache should be invalidated
   */
  static async invalidateUserCertificationCache(userId: string): Promise<void> {
    try {
      logger.info(`Invalidating user certification cache for user ${userId}`);

      // Invalidate certification-related cache entries for this user
      await RedisService.invalidateUserCache(userId, 'certifications');

      logger.info('User certification cache invalidation completed');
    } catch (error) {
      logger.error(`Error invalidating user certification cache: ${error}`);
    }
  }

  /**
   * Invalidate cache entries when firm data changes
   *
   * This method handles cascade invalidation because firm changes can affect:
   * - Individual firm cache entries
   * - Firm list pagination cache
   * - Certifications associated with the firm
   *
   * Called when:
   * - Firm is created, updated, or deleted
   * - Firm certification counts change
   * - Firm status or visibility changes
   *
   * @param firmId - Optional specific firm ID (if null, invalidates all firm cache)
   */
  static async invalidateFirmCache(firmId?: number): Promise<void> {
    try {
      logger.info(
        `Invalidating firm cache${firmId ? ` for firm ${firmId}` : ''}`,
      );

      if (firmId) {
        // Invalidate specific firm cache entry
        await RedisService.del(`firm:id:${firmId}`);
        // Invalidate certifications by firm cache (contains firmId in key pattern)
        await RedisService.delPattern(`certifications:firm:*firmId*${firmId}*`);
      }

      // Invalidate all firms list cache entries (all pagination pages)
      // This is necessary because firm changes affect list ordering, counts, etc.
      await RedisService.delPattern('firms:list:*');

      logger.info('Firm cache invalidation completed');
    } catch (error) {
      logger.error(`Error invalidating firm cache: ${error}`);
    }
  }

  /**
   * Invalidate cache entries when certification data changes
   *
   * This method handles complex cascade invalidation because certification changes affect:
   * - Individual certification cache entries
   * - Certification list pagination cache
   * - Firm cache (due to certification count changes)
   * - Firm-specific certification lists
   *
   * Called when:
   * - Certification is created, updated, or deleted
   * - Certification-firm relationships change
   * - Certification requirements or content change
   *
   * @param certId - Optional specific certification ID
   * @param firmId - Optional firm ID if the change affects firm-certification relationship
   */
  static async invalidateCertificationCache(
    certId?: number,
    firmId?: number,
  ): Promise<void> {
    try {
      logger.info(
        `Invalidating certification cache${
          certId ? ` for cert ${certId}` : ''
        }`,
      );

      if (certId) {
        // Invalidate specific certification cache entry
        await RedisService.del(`certification:id:${certId}`);
      }

      if (firmId) {
        // Invalidate certifications by firm cache (firm-specific certification lists)
        await RedisService.delPattern(`certifications:firm:*firmId*${firmId}*`);
        // Also invalidate firm cache since certification counts may have changed
        await RedisService.del(`firm:id:${firmId}`);
      }

      // Invalidate all certifications list cache (all pagination pages)
      // This is necessary because certification changes affect list ordering, counts, etc.
      await RedisService.delPattern('certifications:list:*');

      // Invalidate firms list cache since certification counts may have changed
      // This handles the cascade effect where certification changes affect firm statistics
      await RedisService.delPattern('firms:list:*');

      logger.info('Certification cache invalidation completed');
    } catch (error) {
      logger.error(`Error invalidating certification cache: ${error}`);
    }
  }

  /**
   * Invalidate all cache (useful for bulk operations or when data integrity is uncertain)
   */
  static async invalidateAllCache(): Promise<void> {
    try {
      logger.info('Invalidating all cache');
      await RedisService.invalidateAllCache();
      logger.info('All cache invalidation completed');
    } catch (error) {
      logger.error(`Error invalidating all cache: ${error}`);
    }
  }

  /**
   * Invalidate all cache entries related to a specific user
   * Called when user account is deleted or requires complete cache cleanup
   *
   * @param userId - The user whose all cache entries should be invalidated
   */
  static async invalidateUserCaches(userId: string): Promise<void> {
    try {
      logger.info(`Invalidating all cache entries for user ${userId}`);

      // Invalidate all types of user-specific cache
      await Promise.all([
        RedisService.invalidateUserCache(userId, 'exams'),
        RedisService.invalidateUserCache(userId, 'exam_questions'),
        RedisService.invalidateUserCache(userId, 'exam_details'),
        RedisService.invalidateUserCache(userId, 'certifications'),
      ]);

      logger.info(`All cache invalidation completed for user ${userId}`);
    } catch (error) {
      logger.error(`Error invalidating user caches: ${error}`);
      // Don't throw - cache invalidation failures shouldn't break business logic
    }
  }

  /**
   * Warm up cache by pre-loading frequently accessed data
   */
  static async warmUpCache(): Promise<void> {
    try {
      logger.info('Starting cache warm-up');

      // Pre-load first page of firms (most frequently accessed)
      // This would typically be called from a cron job or during app startup
      // Implementation would depend on your specific needs

      logger.info('Cache warm-up completed');
    } catch (error) {
      logger.error(`Error during cache warm-up: ${error}`);
    }
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  static async getCacheStats(): Promise<{
    isConnected: boolean;
    keyCount?: number;
  }> {
    try {
      const isConnected = await RedisService.ping();

      return {
        isConnected,
        // Note: Getting key count requires SCAN command which might be expensive
        // Consider implementing this carefully in production
      };
    } catch (error) {
      logger.error(`Error getting cache stats: ${error}`);
      return { isConnected: false };
    }
  }
}

export default CacheManager;
