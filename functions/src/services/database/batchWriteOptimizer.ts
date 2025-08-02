import {
  PrismaClient,
  DifficultyLevel,
} from '../../../src/generated/prisma/client';
import logger from '../firebase/logger';

/**
 * High-performance batch operations utility for Prisma writes
 * Optimized for concurrent operations and large data sets
 */

/**
 * Optimized batch operations for database writes
 * Implements high-performance batch processing for concurrent user scenarios
 */
export class BatchWriteOptimizer {
  private static readonly OPTIMAL_BATCH_SIZE = 50;
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY_BASE = 1000; // 1 second base delay

  /**
   * Execute batch operations with intelligent batching and error handling
   */
  static async batchOperations<T>(
    prisma: PrismaClient | any, // Support both client and transaction
    operations: BatchOperation<T>[],
    options: BatchOperationOptions = {},
  ): Promise<T[]> {
    const {
      batchSize = this.OPTIMAL_BATCH_SIZE,
      useTransaction = true,
      maxRetries = this.MAX_RETRIES,
    } = options;

    if (operations.length === 0) return [];

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        if (useTransaction && 'prisma' in prisma) {
          // We're using the main client, need to wrap in transaction
          return await prisma.$transaction(
            async (tx: any) => {
              return this.executeBatchOperations(tx, operations, batchSize);
            },
            {
              timeout: 180000, // 180 seconds for large batches
              isolationLevel: 'ReadCommitted',
            },
          );
        } else {
          // We're already in a transaction or using a transaction object
          return await this.executeBatchOperations(
            prisma,
            operations,
            batchSize,
          );
        }
      } catch (error: any) {
        attempt++;

        if (!this.isRetryableError(error) || attempt >= maxRetries) {
          logger.error('Batch operation failed after retries', {
            attempt,
            maxRetries,
            error: error.message,
            errorCode: error.code,
            operationCount: operations.length,
            structuredData: true,
          });
          throw error;
        }

        const delay = this.calculateRetryDelay(attempt);
        logger.warn('Batch operation failed, retrying', {
          attempt,
          maxRetries,
          delay,
          error: error.message,
          structuredData: true,
        });

        await this.sleep(delay);
      }
    }

    throw new Error('Max retries exceeded for batch operation');
  }

  /**
   * Execute operations in optimal batch sizes with parallel processing
   */
  private static async executeBatchOperations<T>(
    prismaOrTx: any,
    operations: BatchOperation<T>[],
    batchSize: number,
  ): Promise<T[]> {
    const results: T[] = [];

    // Process operations in batches
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchStartTime = Date.now();

      // Execute batch operations in parallel for better performance
      const batchResults = await Promise.all(
        batch.map((op, index) => {
          try {
            return op.operation(prismaOrTx);
          } catch (error) {
            logger.error(`Batch operation ${i + index} failed`, {
              error: error as any,
              operationDescription: op.description,
              structuredData: true,
            });
            throw error;
          }
        }),
      );

      results.push(...batchResults);

      const batchDuration = Date.now() - batchStartTime;

      // Log performance for monitoring
      if (batchDuration > 5000) {
        logger.warn('Slow batch operation detected', {
          batchSize: batch.length,
          duration: batchDuration,
          avgTimePerOperation: batchDuration / batch.length,
          structuredData: true,
        });
      }

      // Add small delay between batches to prevent overwhelming the database
      if (i + batchSize < operations.length) {
        await this.sleep(10); // 10ms between batches
      }
    }

    return results;
  }

  /**
   * Check if error is retryable (deadlock, connection timeout, etc.)
   */
  private static isRetryableError(error: any): boolean {
    const retryableErrors = [
      'P2034', // Transaction failed due to write conflict
      'P2024', // Timed out fetching a new connection
      'P1008', // Operations timed out
      'P1000', // Connection error
      'P1017', // Server has closed the connection
    ];

    return (
      retryableErrors.includes(error.code) ||
      error.message?.includes('deadlock') ||
      error.message?.includes('timeout') ||
      error.message?.includes('connection reset') ||
      error.message?.includes('connection terminated')
    );
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private static calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 10000); // Cap at 10 seconds
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Optimize data for batch creation - helper method
   */
  static prepareForBatchCreate<T extends Record<string, any>>(
    items: T[],
    transformer?: (item: T, index: number) => T,
  ): T[] {
    const now = new Date();

    return items.map((item, index) => {
      const transformed = transformer ? transformer(item, index) : item;

      // Add timestamps if not present (common optimization)
      if (!('created_at' in transformed) || !transformed.created_at) {
        (transformed as any).created_at = now;
      }
      if ('updated_at' in transformed && !transformed.updated_at) {
        (transformed as any).updated_at = now;
      }

      return transformed;
    });
  }
}

/**
 * Interface for batch operations
 */
export interface BatchOperation<T> {
  operation: (prismaOrTx: any) => Promise<T>;
  description?: string;
}

/**
 * Options for batch operations
 */
export interface BatchOperationOptions {
  batchSize?: number;
  useTransaction?: boolean;
  enableRollback?: boolean;
  maxRetries?: number;
}

/**
 * Helper for creating question batch operations
 */
export class QuestionBatchHelper {
  /**
   * Create optimized batch data for questions and options
   */
  static prepareBatchData(
    questions: any[],
    cert_id: number,
    exam_id: string,
  ): {
    questionsData: any[];
    getOptionsData: (createdQuestions: any[]) => any[];
  } {
    const now = new Date();

    const questionsData = questions.map((question) => ({
      cert_id,
      question_text: question.question,
      explanations: question.explanation || '',
      exam_topic: question.examTopic.trim().toLowerCase(),
      generated_from: exam_id,
      difficulty: question.difficulty || DifficultyLevel.EASY, // Default to EASY if no difficulty specified
      created_at: now,
      // updated_at: now,
    }));

    const getOptionsData = (createdQuestions: any[]) => {
      const optionsData: any[] = [];

      createdQuestions.forEach((createdQuestion, index) => {
        const originalQuestion = questions[index];

        if (
          !originalQuestion.choices ||
          !Array.isArray(originalQuestion.choices)
        ) {
          return; // Skip invalid questions
        }

        originalQuestion.choices.forEach(
          (choice: string, choiceIndex: number) => {
            optionsData.push({
              quiz_question_id: createdQuestion.quiz_question_id,
              option_text: choice.trim(),
              is_correct: choiceIndex === originalQuestion.answerIndex,
              created_at: now,
              // updated_at: now,
            });
          },
        );
      });

      return optionsData;
    };

    return { questionsData, getOptionsData };
  }
}
