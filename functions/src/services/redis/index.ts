import { Redis } from '@upstash/redis';
import logger from '../firebase/logger';
import { PerformanceMonitor } from '../performance';
import memoryCache from '../cache/memoryCache';

// Redis Connection Pool implementation
class RedisConnectionPool {
  private static instance: RedisConnectionPool;
  private connectionPool: Redis[] = [];
  private readonly POOL_SIZE = 10;
  private currentIndex = 0;

  private constructor() {
    this.initializePool();
  }

  static getInstance(): RedisConnectionPool {
    if (!RedisConnectionPool.instance) {
      RedisConnectionPool.instance = new RedisConnectionPool();
    }
    return RedisConnectionPool.instance;
  }

  private initializePool(): void {
    logger.info(
      `Initializing Redis connection pool with ${this.POOL_SIZE} connections`,
    );

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const connection = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        retry: {
          retries: 3,
          backoff: (retryCount: number) => Math.min(1000 * retryCount, 5000),
        },
        // Optimize connection settings
        automaticDeserialization: false, // Better performance for JSON data
      });

      this.connectionPool.push(connection);
    }
  }

  getConnection(): Redis {
    // Round-robin connection selection
    const connection = this.connectionPool[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.POOL_SIZE;
    return connection;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const connection = this.getConnection();
      const result = await connection.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis pool health check failed:', error as any);
      return false;
    }
  }
}

// Cache configuration
export const CACHE_CONFIG = {
  // TTL (Time To Live) in seconds
  FIRMS_TTL: 3600, // 1 hour
  CERTIFICATIONS_TTL: 3600, // 1 hour
  FIRM_BY_ID_TTL: 1800, // 30 minutes
  CERTIFICATION_BY_ID_TTL: 1800, // 30 minutes
  CERTIFICATIONS_BY_FIRM_TTL: 1800, // 30 minutes

  // User-specific cache TTLs (shorter for data consistency)
  USER_EXAMS_TTL: 300, // 5 minutes
  USER_EXAM_QUESTIONS_TTL: 600, // 10 minutes
  USER_EXAM_DETAILS_TTL: 300, // 5 minutes
  USER_CERTIFICATIONS_TTL: 600, // 10 minutes

  // Cache key prefixes
  KEYS: {
    FIRMS_LIST: 'firms:list',
    FIRM_BY_ID: 'firm:id',
    CERTIFICATIONS_LIST: 'certifications:list',
    CERTIFICATION_BY_ID: 'certification:id',
    CERTIFICATIONS_BY_FIRM: 'certifications:firm',

    // User-specific cache keys
    USER_EXAMS: 'user:exams',
    USER_EXAM_QUESTIONS: 'user:exam:questions',
    USER_EXAM_DETAILS: 'user:exam:details',
    USER_CERTIFICATIONS: 'user:certifications',
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
 * Redis Cache Service with connection pooling
 */
export class RedisService {
  /**
   * Get a Redis connection from the pool
   */
  private static getConnection(): Redis {
    return RedisConnectionPool.getInstance().getConnection();
  }

  /**
   * Get data from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      const redis = this.getConnection();
      const data = await redis.get(key);
      if (data) {
        logger.info(`Cache HIT for key: ${key}`);
        PerformanceMonitor.trackCacheOperation(
          'GET',
          true,
          Date.now() - startTime,
          key,
        );
        return data as T;
      }
      logger.info(`Cache MISS for key: ${key}`);
      PerformanceMonitor.trackCacheOperation(
        'GET',
        false,
        Date.now() - startTime,
        key,
      );
      return null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}: ${error}`);
      PerformanceMonitor.trackCacheOperation(
        'GET',
        false,
        Date.now() - startTime,
        key,
      );
      return null;
    }
  }

  /**
   * Set data in cache with TTL
   */
  static async set(key: string, data: any, ttl: number): Promise<void> {
    const startTime = Date.now();
    try {
      const redis = this.getConnection();
      await redis.setex(key, ttl, JSON.stringify(data));
      logger.info(`Cache SET for key: ${key} (TTL: ${ttl}s)`);
      PerformanceMonitor.trackCacheOperation(
        'SET',
        true,
        Date.now() - startTime,
        key,
      );
    } catch (error) {
      logger.error(`Redis SET error for key ${key}: ${error}`);
      PerformanceMonitor.trackCacheOperation(
        'SET',
        false,
        Date.now() - startTime,
        key,
      );
    }
  }

  /**
   * Delete data from cache
   */
  static async del(key: string): Promise<void> {
    try {
      const redis = this.getConnection();
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
      const redis = this.getConnection();
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
      return await RedisConnectionPool.getInstance().healthCheck();
    } catch (error) {
      logger.error(`Redis PING error: ${error}`);
      return false;
    }
  }

  /**
   * Get or set pattern with multi-level caching - fetch from cache, or execute function and cache result
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    useMemoryCache: boolean = true,
  ): Promise<T> {
    const startTime = Date.now();

    // Check L1 cache (memory) first for hot data
    if (useMemoryCache) {
      const memoryData = memoryCache.get<T>(key);
      if (memoryData !== null) {
        const duration = Date.now() - startTime;
        PerformanceMonitor.trackCacheOperation(
          'MEMORY_HIT',
          true,
          duration,
          key,
        );
        return memoryData;
      }
    }

    // Check L2 cache (Redis)
    const cached = await this.get<T>(key);
    if (cached !== null) {
      // Store in memory cache for next access
      if (useMemoryCache) {
        memoryCache.set(key, cached, Math.min(ttl, 300)); // Max 5 min in memory
      }
      const duration = Date.now() - startTime;
      PerformanceMonitor.trackCacheOperation('REDIS_HIT', true, duration, key);
      return cached;
    }

    // Cache miss - fetch fresh data
    const freshData = await fetcher();

    // Store in both caches
    await this.set(key, freshData, ttl);
    if (useMemoryCache) {
      memoryCache.set(key, freshData, Math.min(ttl, 300)); // Max 5 min in memory
    }

    const duration = Date.now() - startTime;
    PerformanceMonitor.trackCacheOperation('CACHE_MISS', false, duration, key);

    return freshData;
  }

  /**
   * Generate cache key for user-specific data
   */
  static generateUserCacheKey(
    prefix: string,
    userId: string,
    additionalParams?: Record<string, any>,
  ): string {
    const params = additionalParams
      ? `_${JSON.stringify(additionalParams)}`
      : '';
    return `${prefix}:${userId}${params}`;
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
   * Invalidate user-specific cache
   */
  static async invalidateUserCache(
    userId: string,
    cacheType?: string,
  ): Promise<void> {
    const patterns = [];

    if (!cacheType || cacheType === 'exams') {
      patterns.push(`${CACHE_CONFIG.KEYS.USER_EXAMS}:${userId}*`);
    }

    if (!cacheType || cacheType === 'exam_questions') {
      patterns.push(`${CACHE_CONFIG.KEYS.USER_EXAM_QUESTIONS}:${userId}*`);
    }

    if (!cacheType || cacheType === 'exam_details') {
      patterns.push(`${CACHE_CONFIG.KEYS.USER_EXAM_DETAILS}:${userId}*`);
    }

    if (!cacheType || cacheType === 'certifications') {
      patterns.push(`${CACHE_CONFIG.KEYS.USER_CERTIFICATIONS}:${userId}*`);
    }

    for (const pattern of patterns) {
      await this.delPattern(pattern);
      // Also clear from memory cache
      memoryCache.clear(); // For simplicity, clear all memory cache
    }

    logger.info(
      `Invalidated user cache for user ${userId}, type: ${cacheType || 'all'}`,
    );
  }

  /**
   * Invalidate all cache
   */
  static async invalidateAllCache(): Promise<void> {
    await this.delPattern('*');
    memoryCache.clear();
  }

  /**
   * Add member to sorted set with score
   */
  static async zAdd(key: string, score: number, member: string): Promise<void> {
    try {
      const redis = this.getConnection();
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
      const redis = this.getConnection();
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
      const redis = this.getConnection();
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
      const redis = this.getConnection();
      await redis.expire(key, seconds);
      logger.info(`Redis EXPIRE for key: ${key}, seconds: ${seconds}`);
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}: ${error as any}`);
    }
  }
}

export default RedisService;
