import { Redis } from '@upstash/redis';
import logger from '../firebase/logger';
import { PerformanceMonitor } from '../performance';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache configuration
export const CACHE_CONFIG = {
  // TTL (Time To Live) in seconds
  FIRMS_TTL: 3600, // 1 hour
  CERTIFICATIONS_TTL: 3600, // 1 hour
  FIRM_BY_ID_TTL: 1800, // 30 minutes
  CERTIFICATION_BY_ID_TTL: 1800, // 30 minutes
  CERTIFICATIONS_BY_FIRM_TTL: 1800, // 30 minutes

  // Cache key prefixes
  KEYS: {
    FIRMS_LIST: 'firms:list',
    FIRM_BY_ID: 'firm:id',
    CERTIFICATIONS_LIST: 'certifications:list',
    CERTIFICATION_BY_ID: 'certification:id',
    CERTIFICATIONS_BY_FIRM: 'certifications:firm',
  },
};

/**
 * Generate cache key for paginated data
 */
export function generatePaginatedCacheKey(
  prefix: string,
  page: number,
  pageSize: number,
  additionalParams?: Record<string, any>,
): string {
  const params = additionalParams ? `_${JSON.stringify(additionalParams)}` : '';
  return `${prefix}:page_${page}:size_${pageSize}${params}`;
}

/**
 * Generate cache key for single item
 */
export function generateItemCacheKey(
  prefix: string,
  id: string | number,
): string {
  return `${prefix}:${id}`;
}

/**
 * Redis Cache Service
 */
export class RedisService {
  /**
   * Get data from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (data) {
        logger.info(`Cache HIT for key: ${key}`);
        return data as T;
      }
      logger.info(`Cache MISS for key: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Set data in cache with TTL
   */
  static async set(key: string, data: any, ttl: number): Promise<void> {
    try {
      await redis.setex(key, ttl, JSON.stringify(data));
      logger.info(`Cache SET for key: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Redis SET error for key ${key}: ${error}`);
    }
  }

  /**
   * Delete data from cache
   */
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
      logger.info(`Cache DELETE for key: ${key}`);
    } catch (error) {
      logger.error(`Redis DELETE error for key ${key}: ${error}`);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  static async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Cache DELETE pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error(`Redis DELETE pattern error for ${pattern}: ${error}`);
    }
  }

  /**
   * Check if Redis is connected
   */
  static async ping(): Promise<boolean> {
    try {
      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error(`Redis PING error: ${error}`);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache, or execute function and cache result
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
  ): Promise<T> {
    const startTime = Date.now();

    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      const duration = Date.now() - startTime;
      PerformanceMonitor.trackCacheOperation('GET', true, duration, key);
      return cached;
    }

    // Cache miss - fetch fresh data
    const freshData = await fetcher();

    // Store in cache for next time
    await this.set(key, freshData, ttl);

    const duration = Date.now() - startTime;
    PerformanceMonitor.trackCacheOperation('GET_SET', false, duration, key);

    return freshData;
  }

  /**
   * Invalidate all cache related to firms
   */
  static async invalidateFirmsCache(): Promise<void> {
    const patterns = [
      `${CACHE_CONFIG.KEYS.FIRMS_LIST}*`,
      `${CACHE_CONFIG.KEYS.FIRM_BY_ID}*`,
      `${CACHE_CONFIG.KEYS.CERTIFICATIONS_BY_FIRM}*`,
    ];

    for (const pattern of patterns) {
      await this.delPattern(pattern);
    }
  }

  /**
   * Invalidate all cache related to certifications
   */
  static async invalidateCertificationsCache(): Promise<void> {
    const patterns = [
      `${CACHE_CONFIG.KEYS.CERTIFICATIONS_LIST}*`,
      `${CACHE_CONFIG.KEYS.CERTIFICATION_BY_ID}*`,
      `${CACHE_CONFIG.KEYS.CERTIFICATIONS_BY_FIRM}*`,
    ];

    for (const pattern of patterns) {
      await this.delPattern(pattern);
    }
  }

  /**
   * Invalidate all cache
   */
  static async invalidateAllCache(): Promise<void> {
    await this.delPattern('*');
  }

  /**
   * Add member to sorted set with score
   */
  static async zAdd(key: string, score: number, member: string): Promise<void> {
    try {
      await redis.zadd(key, { score, member });
      logger.info(
        `Redis ZADD for key: ${key}, score: ${score}, member: ${member}`,
      );
    } catch (error) {
      logger.error(`Redis ZADD error for key ${key}: ${error as any}`);
    }
  }

  /**
   * Get members from sorted set by score range
   */
  static async zRangeByScore(
    key: string,
    min: number,
    max: number,
  ): Promise<string[]> {
    try {
      const result = await redis.zrange(key, min, max, { byScore: true });
      logger.info(`Redis ZRANGE for key: ${key}, range: ${min}-${max}`);
      return Array.isArray(result) ? result.map((item) => String(item)) : [];
    } catch (error) {
      logger.error(`Redis ZRANGE error for key ${key}: ${error as any}`);
      return [];
    }
  }

  /**
   * Remove members from sorted set by score range
   */
  static async zRemRangeByScore(
    key: string,
    min: number,
    max: number,
  ): Promise<void> {
    try {
      await redis.zremrangebyscore(key, min, max);
      logger.info(
        `Redis ZREMRANGEBYSCORE for key: ${key}, range: ${min}-${max}`,
      );
    } catch (error) {
      logger.error(
        `Redis ZREMRANGEBYSCORE error for key ${key}: ${error as any}`,
      );
    }
  }

  /**
   * Set expiration time for a key
   */
  static async expire(key: string, seconds: number): Promise<void> {
    try {
      await redis.expire(key, seconds);
      logger.info(`Redis EXPIRE for key: ${key}, seconds: ${seconds}`);
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}: ${error as any}`);
    }
  }
}

export default RedisService;
