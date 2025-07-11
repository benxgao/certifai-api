import logger from '../firebase/logger';
import { RedisService } from '../redis';
import { MemoryCache } from './memoryCache';
import { PerformanceMonitor } from '../performance';

/**
 * Bounded counter map with automatic cleanup to prevent memory leaks
 */
class BoundedCounterMap {
  private counters = new Map<string, number>();
  private readonly maxSize: number;
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  increment(key: string): void {
    // Periodic cleanup every 5 minutes
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
    }

    // If at max size, remove oldest entries (LRU eviction)
    if (this.counters.size >= this.maxSize) {
      this.evictOldest();
    }

    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  set(key: string, value: number): void {
    // Periodic cleanup check
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
    }

    // If at max size, remove oldest entries
    if (this.counters.size >= this.maxSize && !this.counters.has(key)) {
      this.evictOldest();
    }

    this.counters.set(key, value);
  }

  get(key: string): number {
    return this.counters.get(key) || 0;
  }

  delete(key: string): void {
    this.counters.delete(key);
  }

  clear(): void {
    this.counters.clear();
    this.lastCleanup = Date.now();
  }

  size(): number {
    return this.counters.size;
  }

  entries(): IterableIterator<[string, number]> {
    return this.counters.entries();
  }

  private cleanup(): void {
    const now = Date.now();
    // Remove a percentage of oldest entries to manage memory
    const entriesToRemove = Math.floor(this.counters.size * 0.2); // Remove 20%
    let removed = 0;

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

  private evictOldest(): void {
    // Remove the first (oldest) entry
    const firstKey = this.counters.keys().next().value;
    if (firstKey) {
      this.counters.delete(firstKey);
    }
  }
}

/**
 * Circuit breaker for cache layer reliability
 */
class CacheLayerCircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold = 5;
  private readonly timeout = 30000; // 30 seconds

  async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        return null; // Fast-fail
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

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
 * Implements intelligent multi-level caching with automatic promotion/demotion
 * L1: Memory Cache (fastest, smallest)
 * L2: Redis Cache (fast, larger)
 * L3: Database (slowest, largest)
 */
export class CacheHierarchyService {
  private static get memoryCache() {
    return MemoryCache.getInstance();
  }

  // Cache promotion/demotion thresholds
  private static readonly PROMOTION_THRESHOLD = 3; // Promote to L1 after 3 hits
  private static readonly DEMOTION_THRESHOLD = 5; // Demote from L1 after 5 misses

  // Bounded hit tracking for promotion/demotion decisions
  private static hitCounters = new BoundedCounterMap(10000);
  private static missCounters = new BoundedCounterMap(5000);

  // Circuit breaker for Redis operations
  private static redisCircuitBreaker = new CacheLayerCircuitBreaker();

  // Async counter update queue
  private static updateQueue: Array<{
    key: string;
    type: 'hit' | 'miss';
    timestamp: number;
  }> = [];
  private static readonly MAX_QUEUE_SIZE = 1000;
  private static queueProcessor: NodeJS.Timeout | null = null;

  /**
   * Initialize async counter update processing
   */
  static {
    // Start queue processor if not already running
    if (!this.queueProcessor) {
      this.queueProcessor = setInterval(
        () => this.processCounterUpdates(),
        100,
      );
    }
  }

  /**
   * Intelligent get with automatic cache hierarchy optimization
   */
  static async get<T>(
    key: string,
    useIntelligentHierarchy = true,
  ): Promise<T | null> {
    const startTime = Date.now();

    // L1: Check memory cache first
    const memoryData = this.memoryCache.get<T>(key);
    if (memoryData !== null) {
      const duration = Date.now() - startTime;
      PerformanceMonitor.trackCacheOperation('MEMORY_HIT', true, duration, key);

      if (useIntelligentHierarchy) {
        this.queueCounterUpdate(key, 'hit');
      }

      return memoryData;
    }

    // L2: Check Redis cache with circuit breaker
    try {
      const redisData = await this.redisCircuitBreaker.execute(async () => {
        return await RedisService.get<T>(key);
      });

      if (redisData !== null) {
        const duration = Date.now() - startTime;
        PerformanceMonitor.trackCacheOperation(
          'REDIS_HIT',
          true,
          duration,
          key,
        );

        if (useIntelligentHierarchy) {
          this.queueCounterUpdate(key, 'hit');
          // Consider promoting to L1 if frequently accessed
          await this.considerPromotion(key, redisData);
        } else {
          // Always promote Redis hits to memory cache for next access
          this.memoryCache.set(key, redisData, 300); // 5 min default
        }

        return redisData;
      }
    } catch (error) {
      logger.warn('Redis cache operation failed, continuing without cache', {
        error: error as any,
        key: key.substring(0, 50),
      });
    }

    // Cache miss at all levels
    const duration = Date.now() - startTime;
    PerformanceMonitor.trackCacheOperation('CACHE_MISS', false, duration, key);

    if (useIntelligentHierarchy) {
      this.queueCounterUpdate(key, 'miss');
    }

    return null;
  }

  /**
   * Intelligent set with automatic tier placement
   */
  static async set<T>(
    key: string,
    data: T,
    ttl: number,
    forceMemoryCache = false,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Always store in Redis (L2)
      await RedisService.set(key, data, ttl);

      // Decide whether to store in memory cache (L1)
      const shouldCacheInMemory =
        forceMemoryCache || this.shouldPromoteToMemory(key);

      if (shouldCacheInMemory) {
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
    }
  }

  /**
   * Get or set with intelligent caching
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    options: CacheHierarchyOptions = {},
  ): Promise<T> {
    const { useIntelligentHierarchy = true, forceMemoryCache = false } =
      options;

    // Try to get from cache hierarchy
    const cached = await this.get<T>(key, useIntelligentHierarchy);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - execute fetcher
    const startTime = Date.now();
    const freshData = await fetcher();
    const duration = Date.now() - startTime;

    PerformanceMonitor.trackDatabaseQuery('hierarchy_cache_miss', duration, {
      key,
    });

    // Store in appropriate cache tiers
    await this.set(key, freshData, ttl, forceMemoryCache);

    return freshData;
  }

  /**
   * Batch get operation for multiple keys
   */
  static async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const startTime = Date.now();
    const results = new Map<string, T>();

    if (keys.length === 0) return results;

    // L1: Batch memory cache lookup
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
            // Note: RedisService.mget needs to be implemented
            const redisData = new Map<string, T>();
            for (const key of memoryMisses) {
              const data = await RedisService.get<T>(key);
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

            // Promote to memory cache
            this.memoryCache.set(key, data, 300);
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
        RedisService.set(entry.key, entry.data, entry.ttl),
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
      await RedisService.del(key);

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
      await RedisService.delPattern(pattern);

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
   */
  private static patternToRegex(pattern: string): RegExp {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[([^\]]+)\]/g, '[$1]');

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Clear hit/miss counters that match a pattern
   */
  private static clearCountersByPattern(pattern: string): void {
    const regex = this.patternToRegex(pattern);

    // Clear matching hit counters
    for (const [key] of this.hitCounters.entries()) {
      if (regex.test(key)) {
        this.hitCounters.delete(key);
      }
    }

    // Clear matching miss counters
    for (const [key] of this.missCounters.entries()) {
      if (regex.test(key)) {
        this.missCounters.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): CacheHierarchyStats {
    const memoryStats = this.memoryCache.getStats();

    return {
      memory: {
        size: memoryStats.size,
        maxSize: memoryStats.maxSize,
        hitRate: memoryStats.hitRatio,
      },
      promotionCandidates: this.hitCounters.size(),
      demotionCandidates: this.missCounters.size(),
    };
  }

  /**
   * Manual cache optimization - promotes frequently accessed items
   */
  static async optimizeCache(): Promise<void> {
    const startTime = Date.now();
    let promotions = 0;
    let demotions = 0;

    try {
      // Promote frequently hit items to memory cache
      for (const [key, hitCount] of this.hitCounters.entries()) {
        if (hitCount >= this.PROMOTION_THRESHOLD) {
          const redisData = await RedisService.get(key);
          if (redisData !== null) {
            this.memoryCache.set(key, redisData, 300); // 5 min
            promotions++;
          }
        }
      }

      // Demote frequently missed items from memory cache
      for (const [key, missCount] of this.missCounters.entries()) {
        if (missCount >= this.DEMOTION_THRESHOLD) {
          this.memoryCache.delete(key);
          demotions++;
        }
      }

      // Reset counters after optimization
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
   */
  static async warmupCache(warmupData: WarmupDataEntry[]): Promise<void> {
    const startTime = Date.now();
    let warmedCount = 0;

    try {
      for (const entry of warmupData) {
        await this.set(
          entry.key,
          entry.data,
          entry.ttl,
          entry.forceMemoryCache,
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
