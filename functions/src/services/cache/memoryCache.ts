import logger from '../firebase/logger';

/**
 * Interface for cached items with metadata
 * Stores the actual data along with timing information for TTL management
 */
interface CacheItem<T> {
  data: T; // The cached data
  timestamp: number; // When the item was cached (milliseconds since epoch)
  ttl: number; // Time to live in seconds
}

/**
 * In-memory cache implementation for frequently accessed data (L1 Cache Layer)
 *
 * This class provides the fastest cache layer in our hierarchy:
 * - Response time: 10-20ms (fastest possible)
 * - Capacity: Limited (~1000 items) to prevent memory bloat
 * - Use case: "Hot" data that's accessed very frequently
 * - Persistence: Lost on application restart (ephemeral)
 *
 * Key Features:
 * - Automatic TTL expiration to prevent stale data
 * - LRU (Least Recently Used) eviction when at capacity
 * - Singleton pattern for consistent state across the application
 * - Background cleanup to remove expired entries
 * - Memory-efficient with bounded size limits
 */
export class MemoryCache {
  private static instance: MemoryCache;
  private cache: Map<string, CacheItem<unknown>> = new Map(); // Main cache storage
  private readonly maxSize: number = 1000; // Maximum number of items (prevents memory bloat)
  private readonly defaultTtl: number = 300; // 5 minutes default TTL in seconds

  /**
   * Private constructor to enforce singleton pattern
   * Sets up automatic cleanup interval for expired entries
   */
  private constructor() {
    // Clean up expired entries every 5 minutes to prevent memory accumulation
    setInterval(
      () => {
        this.cleanupExpired();
      },
      5 * 60 * 1000, // 5 minutes in milliseconds
    );
  }

  /**
   * Get singleton instance of MemoryCache
   * Ensures consistent cache state across the entire application
   * @returns MemoryCache singleton instance
   */
  static getInstance(): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache();
    }
    return MemoryCache.instance;
  }

  /**
   * Get item from memory cache with automatic TTL checking
   *
   * @param key - Cache key to retrieve
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null; // Cache miss
    }

    // Check if item has expired based on TTL
    if (Date.now() - item.timestamp > item.ttl * 1000) {
      // Item expired - remove it and return null
      this.cache.delete(key);
      return null;
    }

    // Cache hit - return the data
    return item.data as T;
  }

  /**
   * Set item in memory cache with LRU eviction when at capacity
   *
   * @param key - Cache key to store data under
   * @param data - Data to cache
   * @param ttl - Time to live in seconds (optional, uses default if not provided)
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTtl): void {
    // If cache is at max size, remove oldest item (LRU eviction)
    if (this.cache.size >= this.maxSize) {
      // Maps maintain insertion order, so first key is oldest
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Store item with current timestamp for TTL calculation
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Delete specific item from memory cache
   * @param key - Cache key to delete
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete multiple items from memory cache by pattern
   * Useful for selective cache invalidation without wiping entire cache
   * @param pattern - Pattern to match (simple prefix match, e.g., "user:exams:123")
   */
  deleteByPattern(pattern: string): number {
    let deletedCount = 0;
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Clear all items from memory cache
   * Useful for cache invalidation or memory cleanup
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring and debugging
   * @returns Object with cache metrics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRatio: number;
  } {
    return {
      size: this.cache.size, // Current number of cached items
      maxSize: this.maxSize, // Maximum allowed items
      hitRatio: 0, // Would need hit/miss tracking to implement properly
    };
  }

  /**
   * Background cleanup process to remove expired entries
   * This prevents memory accumulation from expired but unchecked cache items
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let removedCount = 0;

    // Iterate through all cache items and remove expired ones
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl * 1000) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    // Log cleanup results for monitoring
    if (removedCount > 0) {
      logger.info(
        `Memory cache cleanup: removed ${removedCount} expired items`,
      );
    }
  }
}

// Export singleton instance for convenient access across the application
export default MemoryCache.getInstance();
