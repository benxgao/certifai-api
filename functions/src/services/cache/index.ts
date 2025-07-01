import { RedisService } from '../redis';
import logger from '../firebase/logger';

/**
 * Cache Management Service
 * Provides utilities for managing cache invalidation across the application
 */
export class CacheManager {
  /**
   * Invalidate cache when a firm is created, updated, or deleted
   */
  static async invalidateFirmCache(firmId?: number): Promise<void> {
    try {
      logger.info(
        `Invalidating firm cache${firmId ? ` for firm ${firmId}` : ''}`,
      );

      if (firmId) {
        // Invalidate specific firm cache
        await RedisService.del(`firm:id:${firmId}`);
        // Invalidate certifications by firm cache
        await RedisService.delPattern(`certifications:firm:*firmId*${firmId}*`);
      }

      // Invalidate all firms list cache (all pages)
      await RedisService.delPattern('firms:list:*');

      logger.info('Firm cache invalidation completed');
    } catch (error) {
      logger.error(`Error invalidating firm cache: ${error}`);
    }
  }

  /**
   * Invalidate cache when a certification is created, updated, or deleted
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
        // Invalidate specific certification cache
        await RedisService.del(`certification:id:${certId}`);
      }

      if (firmId) {
        // Invalidate certifications by firm cache
        await RedisService.delPattern(`certifications:firm:*firmId*${firmId}*`);
        // Also invalidate firm cache since certification counts may change
        await RedisService.del(`firm:id:${firmId}`);
      }

      // Invalidate all certifications list cache (all pages)
      await RedisService.delPattern('certifications:list:*');

      // Invalidate firms list cache since certification counts may have changed
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
