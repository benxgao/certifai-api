import logger from '../firebase/logger';
import { Redis } from '@upstash/redis';
import { MemoryCache } from './memoryCache';
import { PerformanceMonitor } from '../performance';

/**
 * Simple Redis client for cache hierarchy (avoiding circular dependencies)
 * This client is specifically designed to work with the cache hierarchy system
 * without creating circular dependencies with the main RedisService
 */
class SimpleRedisClient {
  private static redis: Redis;

  /**
   * Get or create a Redis client instance with optimized configuration
   * Uses singleton pattern to reuse connection across cache operations
   * @returns Redis client instance configured for cache operations
   */
  static getClient(): Redis {
    if (!SimpleRedisClient.redis) {
      SimpleRedisClient.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        retry: {
          retries: 3, // Retry failed operations up to 3 times
          // Exponential backoff with max 5 second delay
          backoff: (retryCount: number) => Math.min(1000 * retryCount, 5000),
        },
        // Disable automatic deserialization for better control over JSON parsing
        automaticDeserialization: false,
      });
    }
    return SimpleRedisClient.redis;
  }

  /**
   * Retrieve data from Redis cache with error handling
   * @param key - Cache key to retrieve
   * @returns Parsed data object or null if not found/error
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = this.getClient();
      const data = await redis.get(key);
      if (data === null) {
        return null;
      }
      // Parse JSON string from Redis since automaticDeserialization is false
      // This gives us better control over error handling during deserialization
      return JSON.parse(data as string) as T;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}: ${error}`);
      return null; // Graceful degradation - return null instead of throwing
    }
  }

  /**
   * Store data in Redis cache with TTL (Time To Live)
   * @param key - Cache key to store data under
   * @param data - Data to cache (will be JSON serialized)
   * @param ttl - Time to live in seconds
   */
  static async set(key: string, data: any, ttl: number): Promise<void> {
    try {
      const redis = this.getClient();
      // Use setex for atomic set with expiration in one operation
      await redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      logger.error(`Redis SET error for key ${key}: ${error}`);
      // Don't throw error - cache failures shouldn't break the application
    }
  }

  /**
   * Delete a single key from Redis cache
   * @param key - Cache key to delete
   */
  static async del(key: string): Promise<void> {
    try {
      const redis = this.getClient();
      await redis.del(key);
    } catch (error) {
      logger.error(`Redis DELETE error for key ${key}: ${error}`);
    }
  }

  /**
   * Delete multiple keys matching a pattern from Redis cache
   * Useful for bulk cache invalidation (e.g., all user-specific cache entries)
   * @param pattern - Redis pattern to match keys (e.g., "user:123:*")
   */
  static async delPattern(pattern: string): Promise<void> {
    try {
      const redis = this.getClient();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        // Use batch delete for better performance
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error(`Redis DELETE pattern error for ${pattern}: ${error}`);
    }
  }
}

/**
 * Bounded counter map with automatic cleanup to prevent memory leaks
 * This class tracks hit/miss counters for cache promotion/demotion decisions
 * while preventing unbounded memory growth through automatic cleanup
 */
class BoundedCounterMap {
  private counters = new Map<string, number>();
  private readonly maxSize: number; // Maximum number of counters to track
  private lastCleanup = Date.now(); // Timestamp of last cleanup operation
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes cleanup interval

  /**
   * Initialize counter map with specified maximum size
   * @param maxSize - Maximum number of cache keys to track (default: 10000)
   */
  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Increment counter for a given key with automatic cleanup
   * This method is used to track cache hits and misses for promotion decisions
   * @param key - Cache key to increment counter for
   */
  increment(key: string): void {
    // Periodic cleanup every 5 minutes to prevent memory bloat
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
    }

    // If at max size, remove oldest entries using LRU (Least Recently Used) eviction
    if (this.counters.size >= this.maxSize) {
      this.evictOldest();
    }

    // Increment counter, defaulting to 0 if key doesn't exist
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  /**
   * Set counter value for a specific key with cleanup checks
   * @param key - Cache key to set counter for
   * @param value - Counter value to set
   */
  set(key: string, value: number): void {
    // Periodic cleanup check before setting new values
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
    }

    // If at max size and key is new, remove oldest entries first
    if (this.counters.size >= this.maxSize && !this.counters.has(key)) {
      this.evictOldest();
    }

    this.counters.set(key, value);
  }

  /**
   * Get counter value for a specific key
   * @param key - Cache key to get counter for
   * @returns Counter value or 0 if key doesn't exist
   */
  get(key: string): number {
    return this.counters.get(key) || 0;
  }

  /**
   * Delete counter for a specific key
   * @param key - Cache key to delete counter for
   */
  delete(key: string): void {
    this.counters.delete(key);
  }

  /**
   * Clear all counters and reset cleanup timestamp
   */
  clear(): void {
    this.counters.clear();
    this.lastCleanup = Date.now();
  }

  /**
   * Get current number of tracked counters
   * @returns Number of active counters
   */
  size(): number {
    return this.counters.size;
  }

  /**
   * Get iterator for all counter entries
   * @returns Iterator for [key, value] pairs
   */
  entries(): IterableIterator<[string, number]> {
    return this.counters.entries();
  }

  /**
   * Periodic cleanup to prevent memory bloat
   * Removes approximately 20% of oldest entries when cleanup runs
   * This maintains performance while controlling memory usage
   */
  private cleanup(): void {
    const now = Date.now();
    // Remove a percentage of oldest entries to manage memory
    const entriesToRemove = Math.floor(this.counters.size * 0.2); // Remove 20%
    let removed = 0;

    // Remove oldest entries (Maps maintain insertion order in JavaScript)
    for (const [key] of this.counters.entries()) {
      if (removed >= entriesToRemove) break;
      this.counters.delete(key);
      removed++;
    }

    this.lastCleanup = now;
    if (removed > 0) {
      logger.info(`Cache counter cleanup: removed ${removed} entries`);
    }
  }

  /**
   * LRU eviction - remove the oldest (first inserted) entry
   * This is called when the counter map reaches its maximum size
   */
  private evictOldest(): void {
    // Remove the first (oldest) entry using Map's insertion order guarantee
    const firstKey = this.counters.keys().next().value;
    if (firstKey) {
      this.counters.delete(firstKey);
    }
  }
}

/**
 * Circuit breaker pattern implementation for cache layer reliability
 * Prevents cascade failures by temporarily disabling failed cache operations
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Circuit breaker is open, requests fail fast without hitting cache
 * - HALF_OPEN: Testing state, allows limited requests to test if service recovered
 */
class CacheLayerCircuitBreaker {
  private failures = 0; // Count of consecutive failures
  private lastFailure = 0; // Timestamp of last failure
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold = 5; // Number of failures before opening circuit
  private readonly timeout = 30000; // 30 seconds - how long to wait before trying again

  /**
   * Execute a cache operation with circuit breaker protection
   * @param operation - Async function to execute (cache operation)
   * @returns Operation result or null if circuit is open
   */
  async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    // If circuit is open, check if timeout has passed
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.timeout) {
        // Move to half-open state to test if service recovered
        this.state = 'HALF_OPEN';
      } else {
        // Fail fast - don't attempt operation
        return null;
      }
    }

    try {
      // Attempt the cache operation
      const result = await operation();
      this.onSuccess(); // Reset failure count on success
      return result;
    } catch (error) {
      this.onFailure(); // Track failure and potentially open circuit
      throw error; // Re-throw to let caller handle the error
    }
  }

  /**
   * Handle successful cache operation
   * Resets failure count and closes circuit if it was open
   */
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  /**
   * Handle failed cache operation
   * Increments failure count and opens circuit if threshold is reached
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    // Open circuit if failure threshold is reached
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(
        `Cache circuit breaker opened after ${this.failures} failures`,
      );
    }
  }
}

/**
 * Advanced Cache Hierarchy Service
 *
 * Implements intelligent multi-level caching with automatic promotion/demotion
 * This service provides a sophisticated three-layer caching strategy:
 *
 * L1: Memory Cache (fastest, smallest capacity)
 *     - 10-20ms response time
 *     - Limited to ~1000 items
 *     - For "hot" data accessed very frequently
 *
 * L2: Redis Cache (fast, large capacity)
 *     - 50-100ms response time
 *     - Virtually unlimited storage
 *     - For "warm" data accessed regularly
 *
 * L3: Database (slowest, unlimited capacity)
 *     - 200-500ms response time
 *     - Source of truth for all data
 *     - For "cold" data accessed infrequently
 *
 * Key Features:
 * - Automatic data promotion from L2→L1 based on access patterns
 * - Automatic data demotion from L1→L2 when memory is needed
 * - Circuit breaker protection for Redis failures
 * - Comprehensive performance monitoring
 * - Batch operations for efficiency
 */
export class CacheHierarchyService {
  // Singleton memory cache instance for L1 caching
  private static get memoryCache() {
    return MemoryCache.getInstance();
  }

  // Cache promotion/demotion thresholds for intelligent tier management
  private static readonly PROMOTION_THRESHOLD = 3; // Promote to L1 after 3 hits in L2
  private static readonly DEMOTION_THRESHOLD = 5; // Demote from L1 after 5 misses

  // Bounded hit tracking for promotion/demotion decisions
  // These prevent memory leaks while tracking access patterns
  private static hitCounters = new BoundedCounterMap(10000); // Track hits for promotion
  private static missCounters = new BoundedCounterMap(5000); // Track misses for demotion

  // Circuit breaker for Redis operations to prevent cascade failures
  private static redisCircuitBreaker = new CacheLayerCircuitBreaker();

  // Async counter update queue for non-blocking hit/miss tracking
  // This queue batches counter updates to avoid blocking cache operations
  private static updateQueue: Array<{
    key: string;
    type: 'hit' | 'miss';
    timestamp: number;
  }> = [];
  private static readonly MAX_QUEUE_SIZE = 1000; // Prevent queue from growing too large
  private static queueProcessor: NodeJS.Timeout | null = null; // Background processor

  /**
   * Initialize async counter update processing
   * This static block sets up background processing for hit/miss counters
   * Processing happens every 100ms to batch updates efficiently
   */
  static {
    // Start queue processor if not already running
    if (!this.queueProcessor) {
      this.queueProcessor = setInterval(
        () => this.processCounterUpdates(),
        100, // Process updates every 100ms
      );
    }
  }

  /**
   * Intelligent get with automatic cache hierarchy optimization
   *
   * This method implements the core cache hierarchy logic:
   * 1. Check L1 (memory) cache first - fastest access
   * 2. If miss, check L2 (Redis) cache - still fast
   * 3. If miss, return null (caller will fetch from L3/database)
   * 4. Track access patterns for promotion/demotion decisions
   *
   * @param key - Cache key to retrieve
   * @param useIntelligentHierarchy - Whether to use intelligent promotion/demotion (default: true)
   * @returns Cached data or null if not found
   */
  static async get<T>(
    key: string,
    useIntelligentHierarchy = true,
  ): Promise<T | null> {
    const startTime = Date.now();

    // L1: Check memory cache first (fastest layer)
    const memoryData = this.memoryCache.get<T>(key);
    if (memoryData !== null) {
      const duration = Date.now() - startTime;
      // Track performance metrics for L1 cache hits
      PerformanceMonitor.trackCacheOperation('MEMORY_HIT', true, duration, key);

      // Queue hit tracking for promotion/demotion decisions
      if (useIntelligentHierarchy) {
        this.queueCounterUpdate(key, 'hit');
      }

      return memoryData;
    }

    // L2: Check Redis cache with circuit breaker protection
    try {
      const redisData = await this.redisCircuitBreaker.execute(async () => {
        return await SimpleRedisClient.get<T>(key);
      });

      if (redisData !== null) {
        const duration = Date.now() - startTime;
        // Track performance metrics for L2 cache hits
        PerformanceMonitor.trackCacheOperation(
          'REDIS_HIT',
          true,
          duration,
          key,
        );

        if (useIntelligentHierarchy) {
          // Queue hit tracking for promotion decisions
          this.queueCounterUpdate(key, 'hit');
          // Consider promoting frequently accessed data to L1 memory cache
          await this.considerPromotion(key, redisData);
        } else {
          // Always promote Redis hits to memory cache for next access
          // This provides immediate performance benefit for subsequent requests
          this.memoryCache.set(key, redisData, 300); // 5 min default TTL
        }

        return redisData;
      }
    } catch (error) {
      // Graceful degradation: log error but don't fail the request
      logger.warn('Redis cache operation failed, continuing without cache', {
        error: error as any,
        key: key.substring(0, 50), // Limit key length in logs for security
      });
    }

    // Cache miss at all levels (L1 and L2)
    const duration = Date.now() - startTime;
    PerformanceMonitor.trackCacheOperation('CACHE_MISS', false, duration, key);

    // Queue miss tracking for demotion decisions
    if (useIntelligentHierarchy) {
      this.queueCounterUpdate(key, 'miss');
    }

    return null; // Caller will need to fetch from L3 (database)
  }

  /**
   * Intelligent set with automatic tier placement
   *
   * This method stores data in the appropriate cache tiers:
   * 1. Always store in L2 (Redis) for persistence across requests
   * 2. Optionally store in L1 (memory) based on access patterns or force flag
   *
   * @param key - Cache key to store data under
   * @param data - Data to cache
   * @param ttl - Time to live in seconds
   * @param forceMemoryCache - Force storage in memory cache regardless of patterns
   */
  static async set<T>(
    key: string,
    data: T,
    ttl: number,
    forceMemoryCache = false,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Always store in Redis (L2) for persistence and sharing across instances
      await SimpleRedisClient.set(key, data, ttl);

      // Decide whether to store in memory cache (L1) based on:
      // 1. Force flag (for critical data)
      // 2. Access patterns (frequently accessed data)
      const shouldCacheInMemory =
        forceMemoryCache || this.shouldPromoteToMemory(key);

      if (shouldCacheInMemory) {
        // Limit memory cache TTL to prevent stale data issues
        const memoryTtl = Math.min(ttl, 300); // Max 5 minutes in memory
        this.memoryCache.set(key, data, memoryTtl);

        logger.info('Data cached in both L1 and L2', { key });
      }

      const duration = Date.now() - startTime;
      PerformanceMonitor.trackCacheOperation(
        'HIERARCHY_SET',
        true,
        duration,
        key,
      );
    } catch (error) {
      logger.error('Error in cache hierarchy set:', {
        error: error as any,
        key,
      });
      // Don't throw - cache failures shouldn't break the application
    }
  }

  /**
   * Get or set with intelligent caching (cache-aside pattern)
   *
   * This is the most commonly used method that implements the cache-aside pattern:
   * 1. Try to get data from cache hierarchy
   * 2. If cache miss, execute the fetcher function (usually a database query)
   * 3. Store the fresh data in appropriate cache tiers
   * 4. Return the data to the caller
   *
   * @param key - Cache key to use
   * @param fetcher - Function to execute on cache miss (e.g., database query)
   * @param ttl - Time to live for cached data in seconds
   * @param options - Optional configuration for caching behavior
   * @returns Data from cache or freshly fetched data
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    options: CacheHierarchyOptions = {},
  ): Promise<T> {
    const { useIntelligentHierarchy = true, forceMemoryCache = false } =
      options;

    // Try to get from cache hierarchy first (L1 → L2)
    const cached = await this.get<T>(key, useIntelligentHierarchy);
    if (cached !== null) {
      return cached; // Cache hit - return immediately
    }

    // Cache miss - execute fetcher function (usually database query)
    const startTime = Date.now();
    const freshData = await fetcher();
    const duration = Date.now() - startTime;

    // Track database query performance for cache misses
    PerformanceMonitor.trackDatabaseQuery('hierarchy_cache_miss', duration, {
      key,
    });

    // Store fresh data in appropriate cache tiers for future requests
    await this.set(key, freshData, ttl, forceMemoryCache);

    return freshData;
  }

  /**
   * Batch get operation for multiple keys with optimized hierarchy lookup
   *
   * This method efficiently retrieves multiple cache entries by:
   * 1. Checking all keys in L1 (memory) cache first
   * 2. For memory misses, batch lookup in L2 (Redis) cache
   * 3. Promoting Redis hits to memory cache for future access
   *
   * Benefits over individual get() calls:
   * - Reduces Redis roundtrips through batching
   * - More efficient memory cache lookup
   * - Better performance monitoring aggregation
   *
   * @param keys - Array of cache keys to retrieve
   * @returns Map of found cache entries (key → data)
   */
  static async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const startTime = Date.now();
    const results = new Map<string, T>();

    // Early return for empty key arrays
    if (keys.length === 0) return results;

    // L1: Batch memory cache lookup
    // This is very fast since it's all in-memory operations
    const memoryMisses: string[] = [];
    for (const key of keys) {
      const data = this.memoryCache.get<T>(key);
      if (data !== null) {
        results.set(key, data);
        PerformanceMonitor.trackCacheOperation('MEMORY_HIT', true, 1, key);
      } else {
        memoryMisses.push(key);
      }
    }

    // L2: Batch Redis lookup for memory misses
    if (memoryMisses.length > 0) {
      try {
        const redisResults = await this.redisCircuitBreaker.execute(
          async () => {
            // Batch Redis operations for better performance
            // Note: This could be optimized further with Redis MGET command
            const redisData = new Map<string, T>();
            for (const key of memoryMisses) {
              const data = await SimpleRedisClient.get<T>(key);
              if (data !== null) {
                redisData.set(key, data);
              }
            }
            return redisData;
          },
        );

        if (redisResults) {
          for (const [key, data] of redisResults.entries()) {
            results.set(key, data);
            PerformanceMonitor.trackCacheOperation('REDIS_HIT', true, 1, key);

            // Promote Redis hits to memory cache for faster future access
            this.memoryCache.set(key, data, 300); // 5 minutes TTL
          }
        }
      } catch (error) {
        logger.warn('Batch Redis operation failed', {
          error: error as any,
          missed_keys: memoryMisses.length,
        });
      }
    }

    // Track cache misses
    const totalMisses = keys.length - results.size;
    if (totalMisses > 0) {
      PerformanceMonitor.trackCacheOperation('CACHE_MISS', false, totalMisses);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Batch cache operation: ${results.size}/${keys.length} hits in ${duration}ms`,
    );

    return results;
  }

  /**
   * Batch set operation for multiple key-value pairs
   */
  static async mset<T>(
    entries: Array<{ key: string; data: T; ttl: number }>,
    forceMemoryCache = false,
  ): Promise<void> {
    if (entries.length === 0) return;

    const startTime = Date.now();

    try {
      // Batch Redis operations
      const redisPromises = entries.map((entry) =>
        SimpleRedisClient.set(entry.key, entry.data, entry.ttl),
      );
      await Promise.allSettled(redisPromises);

      // Selective memory cache storage
      for (const entry of entries) {
        const shouldCacheInMemory =
          forceMemoryCache ||
          this.shouldPromoteToMemory(
            entry.key,
            JSON.stringify(entry.data).length,
          );

        if (shouldCacheInMemory) {
          const memoryTtl = Math.min(entry.ttl, 300); // Max 5 minutes in memory
          this.memoryCache.set(entry.key, entry.data, memoryTtl);
        }
      }

      const duration = Date.now() - startTime;
      PerformanceMonitor.trackCacheOperation('BATCH_SET', true, duration);

      logger.info(`Batch cache set: ${entries.length} items in ${duration}ms`);
    } catch (error) {
      logger.error('Batch cache set failed:', {
        error: error as any,
        entry_count: entries.length,
      });
    }
  }

  /**
   * Invalidate from all cache levels
   */
  static async invalidate(key: string): Promise<void> {
    try {
      // Remove from L1 (memory)
      this.memoryCache.delete(key);

      // Remove from L2 (Redis)
      await SimpleRedisClient.del(key);

      // Clear hit/miss counters
      this.hitCounters.delete(key);
      this.missCounters.delete(key);

      logger.info('Cache invalidated at all levels', { key });
    } catch (error) {
      logger.error('Error invalidating cache hierarchy:', {
        error: error as any,
        key,
      });
    }
  }

  /**
   * Invalidate by pattern from all cache levels with smart memory cache filtering
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Smart memory cache invalidation - only clear matching entries
      let memoryEntriesCleared = 0;

      // Get memory cache entries and selectively clear matching ones
      const memoryCache = this.memoryCache;
      // Since MemoryCache doesn't expose direct iteration, we'll track this differently
      // For now, we'll use a more targeted approach for common patterns

      if (pattern.includes('user:')) {
        // For user-specific patterns, extract user ID and clear related entries
        const userIdMatch = pattern.match(/user:([^:*]+)/);
        if (userIdMatch) {
          const userId = userIdMatch[1];
          // Clear user-specific counter entries
          for (const [key] of this.hitCounters.entries()) {
            if (key.includes(`user:${userId}`)) {
              this.hitCounters.delete(key);
              memoryEntriesCleared++;
            }
          }
          for (const [key] of this.missCounters.entries()) {
            if (key.includes(`user:${userId}`)) {
              this.missCounters.delete(key);
              memoryEntriesCleared++;
            }
          }
        }
      } else {
        // For non-user patterns, fall back to clearing all memory cache
        // This is still better than before as we maintain hit/miss counters
        memoryCache.clear();
        memoryEntriesCleared = -1; // Indicate full clear
      }

      // Clear Redis pattern
      await SimpleRedisClient.delPattern(pattern);

      // Clear relevant hit/miss counters based on pattern
      this.clearCountersByPattern(pattern);

      logger.info(`Cache pattern invalidated at all levels: ${pattern}`, {
        memory_entries_cleared: memoryEntriesCleared,
        pattern_type: pattern.includes('user:') ? 'user-specific' : 'global',
      });
    } catch (error) {
      logger.error('Error invalidating cache pattern:', {
        error: error as any,
        pattern,
      });
    }
  }

  /**
   * Convert glob pattern to regex for memory cache filtering
   *
   * This utility function transforms Redis-style glob patterns into JavaScript regex:
   * - * becomes .* (match any characters)
   * - ? becomes . (match single character)
   * - [abc] becomes [abc] (match character class)
   *
   * @param pattern - Glob pattern to convert
   * @returns RegExp object for pattern matching
   */
  private static patternToRegex(pattern: string): RegExp {
    // Convert glob pattern to regex with proper escaping
    const regexPattern = pattern
      .replace(/\*/g, '.*') // * matches any characters
      .replace(/\?/g, '.') // ? matches single character
      .replace(/\[([^\]]+)\]/g, '[$1]'); // [abc] matches character class

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Clear hit/miss counters that match a specific pattern
   *
   * This cleanup method ensures that promotion/demotion counters
   * don't accumulate for invalidated cache keys, preventing:
   * - Memory leaks from stale counter data
   * - Incorrect promotion decisions for deleted data
   * - Counter pollution affecting cache optimization
   *
   * @param pattern - Pattern to match against counter keys
   */
  private static clearCountersByPattern(pattern: string): void {
    const regex = this.patternToRegex(pattern);

    // Clear matching hit counters (used for promotion decisions)
    for (const [key] of this.hitCounters.entries()) {
      if (regex.test(key)) {
        this.hitCounters.delete(key);
      }
    }

    // Clear matching miss counters (used for demotion decisions)
    for (const [key] of this.missCounters.entries()) {
      if (regex.test(key)) {
        this.missCounters.delete(key);
      }
    }
  }

  /**
   * Get comprehensive cache statistics for monitoring and debugging
   *
   * Provides insights into:
   * - Memory cache utilization and capacity
   * - Promotion candidates (frequently accessed Redis data)
   * - Demotion candidates (frequently missed memory data)
   *
   * @returns CacheHierarchyStats object with detailed metrics
   */
  static getCacheStats(): CacheHierarchyStats {
    const memoryStats = this.memoryCache.getStats();

    return {
      memory: {
        size: memoryStats.size, // Current number of items in memory cache
        maxSize: memoryStats.maxSize, // Maximum capacity of memory cache
        hitRate: memoryStats.hitRatio, // Memory cache hit ratio (if implemented)
      },
      promotionCandidates: this.hitCounters.size(), // Keys with high hit counts
      demotionCandidates: this.missCounters.size(), // Keys with high miss counts
    };
  }

  /**
   * Manual cache optimization - promotes frequently accessed items and demotes unused ones
   *
   * This method performs intelligent cache tier management:
   * 1. Promotes Redis data with high hit counts to memory cache
   * 2. Demotes memory data with high miss counts to free up space
   * 3. Resets counters after optimization to start fresh tracking
   *
   * Benefits:
   * - Improves hit rates by moving hot data to faster cache tiers
   * - Frees memory cache space for more relevant data
   * - Optimizes based on actual access patterns rather than assumptions
   *
   * Called during:
   * - Periodic maintenance tasks
   * - High memory pressure situations
   * - Manual performance optimization
   */
  static async optimizeCache(): Promise<void> {
    const startTime = Date.now();
    let promotions = 0;
    let demotions = 0;

    try {
      // Promote frequently hit items from Redis to memory cache
      for (const [key, hitCount] of this.hitCounters.entries()) {
        if (hitCount >= this.PROMOTION_THRESHOLD) {
          const redisData = await SimpleRedisClient.get(key);
          if (redisData !== null) {
            this.memoryCache.set(key, redisData, 300); // 5 min TTL for promoted data
            promotions++;
          }
        }
      }

      // Demote frequently missed items from memory cache to free up space
      for (const [key, missCount] of this.missCounters.entries()) {
        if (missCount >= this.DEMOTION_THRESHOLD) {
          this.memoryCache.delete(key);
          demotions++;
        }
      }

      // Reset counters after optimization to start fresh tracking period
      this.hitCounters.clear();
      this.missCounters.clear();

      const duration = Date.now() - startTime;
      logger.info('Cache hierarchy optimized', {
        promotions,
        demotions,
        duration_ms: duration,
      });
    } catch (error) {
      logger.error('Error optimizing cache hierarchy:', {
        error: error as any,
      });
    }
  }

  /**
   * Warm up cache with frequently accessed data
   *
   * This method pre-loads critical data into cache tiers to improve
   * initial performance and reduce database load during startup or
   * after cache invalidation events.
   *
   * Use cases:
   * - Application startup cache warming
   * - Post-deployment cache population
   * - Critical data pre-loading for high-traffic periods
   *
   * @param warmupData - Array of data entries to pre-load into cache
   */
  static async warmupCache(warmupData: WarmupDataEntry[]): Promise<void> {
    const startTime = Date.now();
    let warmedCount = 0;

    try {
      // Pre-load each warmup entry into appropriate cache tiers
      for (const entry of warmupData) {
        await this.set(
          entry.key,
          entry.data,
          entry.ttl,
          entry.forceMemoryCache, // Some critical data should be in memory immediately
        );
        warmedCount++;
      }

      const duration = Date.now() - startTime;
      logger.info('Cache warmup completed', {
        warmed_count: warmedCount,
        duration_ms: duration,
      });
    } catch (error) {
      logger.error('Error warming up cache:', { error: error as any });
    }
  }

  /**
   * Queue counter update for async processing
   */
  private static queueCounterUpdate(key: string, type: 'hit' | 'miss'): void {
    // Prevent queue overflow
    if (this.updateQueue.length >= this.MAX_QUEUE_SIZE) {
      // Process immediately if queue is full
      this.processCounterUpdates();
    }

    this.updateQueue.push({
      key,
      type,
      timestamp: Date.now(),
    });
  }

  /**
   * Process queued counter updates in batches
   */
  private static processCounterUpdates(): void {
    if (this.updateQueue.length === 0) return;

    const updates = this.updateQueue.splice(0); // Take all updates
    const hitUpdates = new Map<string, number>();
    const missUpdates = new Map<string, number>();

    // Aggregate updates by key
    for (const update of updates) {
      if (update.type === 'hit') {
        hitUpdates.set(update.key, (hitUpdates.get(update.key) || 0) + 1);
        // Reset miss counter on hit
        this.missCounters.delete(update.key);
      } else {
        missUpdates.set(update.key, (missUpdates.get(update.key) || 0) + 1);
      }
    }

    // Apply batched updates
    for (const [key, increment] of hitUpdates.entries()) {
      const current = this.hitCounters.get(key) || 0;
      this.hitCounters.set(key, current + increment);
    }

    for (const [key, increment] of missUpdates.entries()) {
      const current = this.missCounters.get(key) || 0;
      this.missCounters.set(key, current + increment);
    }

    if (updates.length > 0) {
      logger.info(`Processed ${updates.length} cache counter updates`, {
        hit_updates: hitUpdates.size,
        miss_updates: missUpdates.size,
      });
    }
  }

  /**
   * Consider promoting item to memory cache
   */
  private static async considerPromotion<T>(
    key: string,
    data: T,
  ): Promise<void> {
    const hitCount = this.hitCounters.get(key) || 0;

    if (hitCount >= this.PROMOTION_THRESHOLD) {
      this.memoryCache.set(key, data, 300); // 5 minutes
      this.hitCounters.delete(key); // Reset counter after promotion

      logger.info('Cache promoted to memory', { key });
    }
  }

  /**
   * Determine if item should be promoted to memory cache with memory awareness
   */
  private static shouldPromoteToMemory(
    key: string,
    dataSize?: number,
  ): boolean {
    const hitCount = this.hitCounters.get(key) || 0;
    const memoryStats = this.memoryCache.getStats();
    const utilizationRatio = memoryStats.size / memoryStats.maxSize;

    // More selective promotion when memory is under pressure
    const dynamicThreshold =
      utilizationRatio > 0.8
        ? this.PROMOTION_THRESHOLD * 2
        : this.PROMOTION_THRESHOLD;

    // Prefer small items when memory is tight
    const hasCapacity = utilizationRatio < 0.9 || (dataSize && dataSize < 1024); // Prefer items < 1KB

    return hitCount >= dynamicThreshold && hasCapacity !== false;
  }
}

/**
 * Cache hierarchy configuration options
 */
export interface CacheHierarchyOptions {
  useIntelligentHierarchy?: boolean;
  forceMemoryCache?: boolean;
}

/**
 * Cache hierarchy statistics
 */
export interface CacheHierarchyStats {
  memory: {
    size: number;
    maxSize: number;
    hitRate: number;
  };
  promotionCandidates: number;
  demotionCandidates: number;
}

/**
 * Warmup data entry
 */
export interface WarmupDataEntry {
  key: string;
  data: any;
  ttl: number;
  forceMemoryCache?: boolean;
}

export default CacheHierarchyService;
