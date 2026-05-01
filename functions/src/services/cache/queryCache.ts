import logger from '../firebase/logger';
import { RedisService } from '../redis';
import { PerformanceMonitor } from '../performance';

/**
 * Query Result Cache Service
 * Provides intelligent caching for complex database query results
 * Implements query fingerprinting and cache optimization
 */
export class QueryCacheService {
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly LONG_TTL = 3600; // 1 hour
  private static readonly SHORT_TTL = 60; // 1 minute

  /**
   * Cache a query result with intelligent TTL based on query type
   */
  static async cacheQueryResult<T>(
    queryFingerprint: string,
    result: T,
    queryType: QueryType = 'default',
    customTtl?: number,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = customTtl || this.getTtlByQueryType(queryType);
      const cacheKey = this.generateQueryCacheKey(queryFingerprint, queryType);

      await RedisService.set(cacheKey, result, ttl);

      const duration = Date.now() - startTime;
      PerformanceMonitor.trackCacheOperation(
        'QUERY_CACHE_SET',
        true,
        duration,
        cacheKey,
      );

      logger.info(`Query result cached: ${queryType}`, {
        fingerprint: queryFingerprint.substring(0, 50),
        ttl,
        size_bytes: JSON.stringify(result).length,
      });
    } catch (error) {
      logger.error('Error caching query result:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Retrieve cached query result
   */
  static async getCachedQueryResult<T>(
    queryFingerprint: string,
    queryType: QueryType = 'default',
  ): Promise<T | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateQueryCacheKey(queryFingerprint, queryType);
      const result = await RedisService.get<T>(cacheKey);

      const duration = Date.now() - startTime;
      PerformanceMonitor.trackCacheOperation(
        'QUERY_CACHE_GET',
        result !== null,
        duration,
        cacheKey,
      );

      if (result) {
        logger.info(`Query cache hit: ${queryType}`, {
          fingerprint: queryFingerprint.substring(0, 50),
        });
      }

      return result;
    } catch (error) {
      logger.error('Error retrieving cached query result:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Execute query with caching - fetch from cache or execute and cache
   */
  static async executeWithCache<T>(
    queryExecutor: () => Promise<T>,
    queryFingerprint: string,
    queryType: QueryType = 'default',
    customTtl?: number,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.getCachedQueryResult<T>(
      queryFingerprint,
      queryType,
    );
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    const startTime = Date.now();
    const result = await queryExecutor();
    const duration = Date.now() - startTime;

    // Track the database query performance
    PerformanceMonitor.trackDatabaseQuery(
      `cached_query_${queryType}`,
      duration,
      { fingerprint: queryFingerprint.substring(0, 50) },
    );

    // Cache the result
    await this.cacheQueryResult(queryFingerprint, result, queryType, customTtl);

    return result;
  }

  /**
   * Generate a unique fingerprint for a query
   */
  static generateQueryFingerprint(
    operation: string,
    parameters: Record<string, unknown>,
    userId?: string,
  ): string {
    const paramString = JSON.stringify(
      parameters,
      Object.keys(parameters).sort(),
    );
    const userPart = userId ? `_user:${userId}` : '';
    return `${operation}${userPart}_${this.hashString(paramString)}`;
  }

  /**
   * Invalidate cached queries by pattern
   */
  static async invalidateQueryCache(pattern: string): Promise<void> {
    try {
      const cachePattern = `query_cache:${pattern}`;
      await RedisService.delPattern(cachePattern);

      logger.info(`Query cache invalidated: ${pattern}`);
    } catch (error) {
      logger.error('Error invalidating query cache:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Invalidate user-specific query cache
   */
  static async invalidateUserQueryCache(userId: string): Promise<void> {
    await this.invalidateQueryCache(`*_user:${userId}_*`);
  }

  /**
   * Generate cache key for query result
   */
  private static generateQueryCacheKey(
    fingerprint: string,
    queryType: QueryType,
  ): string {
    return `query_cache:${queryType}:${fingerprint}`;
  }

  /**
   * Get TTL based on query type
   */
  private static getTtlByQueryType(queryType: QueryType): number {
    switch (queryType) {
      case 'user_data':
        return this.SHORT_TTL; // User data changes frequently
      case 'exam_questions':
        return this.DEFAULT_TTL; // Moderate frequency
      case 'certification_data':
        return this.LONG_TTL; // Static data
      case 'aggregate':
        return this.DEFAULT_TTL; // Aggregate queries
      case 'reference_data':
        return this.LONG_TTL; // Reference data rarely changes
      default:
        return this.DEFAULT_TTL;
    }
  }

  /**
   * Simple hash function for string
   */
  private static hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }
}

/**
 * Query types for intelligent caching
 */
export type QueryType =
  | 'default'
  | 'user_data'
  | 'exam_questions'
  | 'certification_data'
  | 'aggregate'
  | 'reference_data';

/**
 * Decorator for caching query results
 */
export function CacheQuery(queryType: QueryType = 'default', ttl?: number) {
  return function (
    target: object,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const method = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const queryFingerprint = QueryCacheService.generateQueryFingerprint(
        `${(target as { constructor?: { name?: string } }).constructor?.name ?? 'UnknownTarget'}.${propertyName}`,
        { args },
      );

      return QueryCacheService.executeWithCache(
        () => method.apply(this, args),
        queryFingerprint,
        queryType,
        ttl,
      );
    };

    return descriptor;
  };
}

export default QueryCacheService;
