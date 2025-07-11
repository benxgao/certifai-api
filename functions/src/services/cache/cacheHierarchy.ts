import logger from '../firebase/logger';
import { RedisService } from '../redis';
import { MemoryCache } from './memoryCache';
import { PerformanceMonitor } from '../performance';

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

  // Hit tracking for promotion/demotion decisions
  private static hitCounters = new Map<string, number>();
  private static missCounters = new Map<string, number>();

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
        this.recordHit(key);
      }

      return memoryData;
    }

    // L2: Check Redis cache
    const redisData = await RedisService.get<T>(key);
    if (redisData !== null) {
      const duration = Date.now() - startTime;
      PerformanceMonitor.trackCacheOperation('REDIS_HIT', true, duration, key);

      if (useIntelligentHierarchy) {
        this.recordHit(key);
        // Consider promoting to L1 if frequently accessed
        await this.considerPromotion(key, redisData);
      } else {
        // Always promote Redis hits to memory cache for next access
        this.memoryCache.set(key, redisData, 300); // 5 min default
      }

      return redisData;
    }

    // Cache miss at all levels
    const duration = Date.now() - startTime;
    PerformanceMonitor.trackCacheOperation('CACHE_MISS', false, duration, key);

    if (useIntelligentHierarchy) {
      this.recordMiss(key);
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
   * Invalidate by pattern from all cache levels
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Clear relevant memory cache entries
      this.memoryCache.clear(); // Simple approach - clear all memory cache

      // Clear Redis pattern
      await RedisService.delPattern(pattern);

      // Clear hit/miss counters for pattern (simplified)
      this.hitCounters.clear();
      this.missCounters.clear();

      logger.info(`Cache pattern invalidated at all levels: ${pattern}`);
    } catch (error) {
      logger.error('Error invalidating cache pattern:', {
        error: error as any,
        pattern,
      });
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
      promotionCandidates: this.hitCounters.size,
      demotionCandidates: this.missCounters.size,
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
   * Record cache hit for promotion consideration
   */
  private static recordHit(key: string): void {
    const currentHits = this.hitCounters.get(key) || 0;
    this.hitCounters.set(key, currentHits + 1);

    // Reset miss counter on hit
    this.missCounters.delete(key);
  }

  /**
   * Record cache miss for demotion consideration
   */
  private static recordMiss(key: string): void {
    const currentMisses = this.missCounters.get(key) || 0;
    this.missCounters.set(key, currentMisses + 1);
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
   * Determine if item should be promoted to memory cache
   */
  private static shouldPromoteToMemory(key: string): boolean {
    const hitCount = this.hitCounters.get(key) || 0;
    return hitCount >= this.PROMOTION_THRESHOLD;
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
