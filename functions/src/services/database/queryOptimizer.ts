import { PrismaClient } from '@prisma/client';
import logger from '../firebase/logger';
import { PerformanceMonitor } from '../performance';
import { QueryCacheService, QueryType } from '../cache/queryCache';

/**
 * Advanced Database Query Optimizer
 * Provides intelligent query optimization, parallel execution, and result caching
 */
export class DatabaseQueryOptimizer {
  /**
   * Execute multiple queries in parallel with optimized batching
   */
  static async executeParallel<T extends readonly unknown[]>(
    queries: readonly [...{ [K in keyof T]: () => Promise<T[K]> }],
    options: ParallelExecutionOptions = {},
  ): Promise<T> {
    const { batchSize = 5 } = options;
    const startTime = Date.now();

    try {
      // Split queries into batches to avoid overwhelming the database
      const batches: Array<Array<() => Promise<any>>> = [];
      for (let i = 0; i < queries.length; i += batchSize) {
        batches.push(
          queries.slice(i, i + batchSize) as Array<() => Promise<any>>,
        );
      }

      const results: any[] = [];

      // Execute batches sequentially, queries within each batch in parallel
      for (const batch of batches) {
        const batchResults = await Promise.all(batch.map((query) => query()));
        results.push(...batchResults);
      }

      const duration = Date.now() - startTime;
      PerformanceMonitor.trackDatabaseQuery('parallel_execution', duration, {
        query_count: queries.length,
        batch_count: batches.length,
        batch_size: batchSize,
      });

      logger.info('Parallel query execution completed', {
        query_count: queries.length,
        duration_ms: duration,
        avg_per_query: Math.round(duration / queries.length),
      });

      return results as unknown as T;
    } catch (error) {
      logger.error('Error in parallel query execution:', {
        error: error as any,
      });
      throw error;
    }
  }

  /**
   * Optimized findMany with count - executes both queries in parallel
   */
  static async findManyWithCount<T>(
    findManyQuery: Promise<T[]>,
    countQuery: Promise<number>,
    cacheOptions?: {
      cacheKey?: string;
      queryType?: QueryType;
      ttl?: number;
    },
  ): Promise<{ data: T[]; total: number }> {
    const startTime = Date.now();

    try {
      // If caching is enabled and cache key provided
      if (cacheOptions?.cacheKey) {
        const cached = await QueryCacheService.getCachedQueryResult<{
          data: T[];
          total: number;
        }>(cacheOptions.cacheKey, cacheOptions.queryType);

        if (cached) {
          return cached;
        }
      }

      // Execute both queries in parallel
      const [data, total] = await Promise.all([findManyQuery, countQuery]);
      const result = { data, total };

      const duration = Date.now() - startTime;
      PerformanceMonitor.trackDatabaseQuery('find_many_with_count', duration, {
        result_count: data.length,
        total,
      });

      // Cache the result if caching is enabled
      if (cacheOptions?.cacheKey) {
        await QueryCacheService.cacheQueryResult(
          cacheOptions.cacheKey,
          result,
          cacheOptions.queryType,
          cacheOptions.ttl,
        );
      }

      return result;
    } catch (error) {
      logger.error('Error in findManyWithCount:', { error: error as any });
      throw error;
    }
  }

  /**
   * Optimized query with field selection and caching
   */
  static async optimizedQuery<T>(
    queryExecutor: () => Promise<T>,
    options: OptimizedQueryOptions,
  ): Promise<T> {
    const {
      cacheKey,
      queryType = 'default',
      ttl,
      enablePerformanceTracking = true,
    } = options;
    const startTime = Date.now();

    try {
      // Try cache first if enabled
      if (cacheKey) {
        const cached = await QueryCacheService.getCachedQueryResult<T>(
          cacheKey,
          queryType,
        );
        if (cached) {
          return cached;
        }
      }

      // Execute the query
      const result = await queryExecutor();
      const duration = Date.now() - startTime;

      // Track performance if enabled
      if (enablePerformanceTracking) {
        PerformanceMonitor.trackDatabaseQuery(
          `optimized_query_${queryType}`,
          duration,
          { cache_key: cacheKey },
        );
      }

      // Cache the result if enabled
      if (cacheKey) {
        await QueryCacheService.cacheQueryResult(
          cacheKey,
          result,
          queryType,
          ttl,
        );
      }

      return result;
    } catch (error) {
      logger.error('Error in optimized query:', {
        error: error as any,
        options,
      });
      throw error;
    }
  }

  /**
   * Batch operations with transaction support
   */
  static async batchOperations<T>(
    prisma: PrismaClient,
    operations: BatchOperation<T>[],
    options: BatchOperationOptions = {},
  ): Promise<T[]> {
    const {
      useTransaction = true,
      batchSize = 10,
      enableRollback = true,
    } = options;
    const startTime = Date.now();

    try {
      if (useTransaction) {
        return await prisma.$transaction(async (tx: any) => {
          return this.executeBatchOperations(tx, operations, batchSize);
        });
      } else {
        return await this.executeBatchOperations(prisma, operations, batchSize);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Batch operations failed:', {
        error: error as any,
        operation_count: operations.length,
        duration_ms: duration,
        use_transaction: useTransaction,
      });

      if (enableRollback && useTransaction) {
        logger.info('Transaction automatically rolled back due to error');
      }

      throw error;
    }
  }

  /**
   * Advanced aggregation with caching
   */
  static async performAggregation<T>(
    aggregationQuery: () => Promise<T>,
    aggregationType: string,
    cacheKey?: string,
    ttl = 600, // 10 minutes default for aggregations
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await this.optimizedQuery(aggregationQuery, {
        cacheKey,
        queryType: 'aggregate',
        ttl,
        enablePerformanceTracking: true,
      });

      const duration = Date.now() - startTime;

      logger.info('Aggregation completed', {
        type: aggregationType,
        duration_ms: duration,
        cached: !!cacheKey,
      });

      return result;
    } catch (error) {
      logger.error('Error in aggregation:', {
        error: error as any,
        type: aggregationType,
      });
      throw error;
    }
  }

  /**
   * Raw query execution with optimization
   */
  static async executeRawQuery<T>(
    prisma: PrismaClient,
    query: string,
    params: any[] = [],
    options: RawQueryOptions = {},
  ): Promise<T> {
    const { cacheKey, ttl = 300, enableOptimization = true } = options;
    const startTime = Date.now();

    try {
      // Create query fingerprint for caching
      const queryFingerprint =
        cacheKey ||
        QueryCacheService.generateQueryFingerprint('raw_query', {
          query,
          params,
        });

      if (enableOptimization && cacheKey) {
        const cached = await QueryCacheService.getCachedQueryResult<T>(
          queryFingerprint,
          'default',
        );
        if (cached) {
          return cached;
        }
      }

      // Execute raw query
      const result = (await (prisma as any).$queryRawUnsafe(
        query,
        ...params,
      )) as T;
      const duration = Date.now() - startTime;

      PerformanceMonitor.trackDatabaseQuery('raw_query', duration, {
        query_length: query.length,
        param_count: params.length,
      });

      // Cache result if enabled
      if (enableOptimization && cacheKey) {
        await QueryCacheService.cacheQueryResult(
          queryFingerprint,
          result,
          'default',
          ttl,
        );
      }

      return result;
    } catch (error) {
      logger.error('Raw query execution failed:', {
        error: error as any,
        query: query.substring(0, 100),
      });
      throw error;
    }
  }

  /**
   * Execute batch operations (internal helper)
   */
  private static async executeBatchOperations<T>(
    prismaOrTx: PrismaClient | any,
    operations: BatchOperation<T>[],
    batchSize: number,
  ): Promise<T[]> {
    const results: T[] = [];

    // Process operations in batches
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchStartTime = Date.now();

      const batchResults = await Promise.all(
        batch.map((op) => op.operation(prismaOrTx)),
      );

      results.push(...batchResults);

      const batchDuration = Date.now() - batchStartTime;
      PerformanceMonitor.trackBatchOperation(
        'database_batch_operation',
        batch.length,
        batchDuration,
        { batch_number: Math.floor(i / batchSize) + 1 },
      );
    }

    return results;
  }
}

/**
 * Parallel execution options
 */
export interface ParallelExecutionOptions {
  batchSize?: number;
  enableCaching?: boolean;
}

/**
 * Optimized query options
 */
export interface OptimizedQueryOptions {
  cacheKey?: string;
  queryType?: QueryType;
  ttl?: number;
  enablePerformanceTracking?: boolean;
}

/**
 * Batch operation definition
 */
export interface BatchOperation<T> {
  operation: (prismaOrTx: PrismaClient | any) => Promise<T>;
  description?: string;
}

/**
 * Batch operation options
 */
export interface BatchOperationOptions {
  useTransaction?: boolean;
  batchSize?: number;
  enableRollback?: boolean;
}

/**
 * Raw query options
 */
export interface RawQueryOptions {
  cacheKey?: string;
  ttl?: number;
  enableOptimization?: boolean;
}

/**
 * Decorator for optimized queries
 */
export function OptimizeQuery(options: OptimizedQueryOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey =
        options.cacheKey ||
        QueryCacheService.generateQueryFingerprint(
          `${target.constructor.name}.${propertyName}`,
          { args },
        );

      return DatabaseQueryOptimizer.optimizedQuery(
        () => method.apply(this, args),
        { ...options, cacheKey },
      );
    };

    return descriptor;
  };
}

export default DatabaseQueryOptimizer;
