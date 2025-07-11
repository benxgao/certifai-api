import logger from '../firebase/logger';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * In-memory cache implementation for frequently accessed data
 * This provides L1 cache layer for hot data
 */
export class MemoryCache {
  private static instance: MemoryCache;
  private cache: Map<string, CacheItem<any>> = new Map();
  private readonly maxSize: number = 1000; // Maximum number of items to cache
  private readonly defaultTtl: number = 300; // 5 minutes default TTL

  private constructor() {
    // Clean up expired entries every 5 minutes
    setInterval(
      () => {
        this.cleanupExpired();
      },
      5 * 60 * 1000,
    );
  }

  static getInstance(): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache();
    }
    return MemoryCache.instance;
  }

  /**
   * Get item from memory cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * Set item in memory cache
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTtl): void {
    // If cache is at max size, remove oldest item
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Delete item from memory cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all items from memory cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRatio: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRatio: 0, // Would need tracking to implement properly
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl * 1000) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(
        `Memory cache cleanup: removed ${removedCount} expired items`,
      );
    }
  }
}

export default MemoryCache.getInstance();
