/**
 * Common API types and response envelopes
 *
 * Provides shared request/response structures used across all endpoint types.
 * Extends base response types from express.ts with pagination and list support.
 */

import { ApiSuccessResponse } from '../express';

/**
 * Pagination metadata included in list responses
 */
export interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Generic paginated list response envelope
 *
 * @template T - The type of items in the list
 *
 * @example
 * ```typescript
 * interface GetExamsResponse extends ListResponse<ExamData> {}
 * ```
 */
export interface ListResponse<T> extends ApiSuccessResponse<T[]> {
  success: true;
  data: T[];
  meta: PaginationMetadata;
}

/**
 * Standard single-item success response envelope
 *
 * @template T - The type of the returned data
 */
export type DataResponse<T> = ApiSuccessResponse<T>;

/**
 * Empty success response for operations like DELETE that don't return data
 */
export interface EmptyResponse {
  success: true;
}

/**
 * Common query parameters for paginated endpoints
 */
export interface PaginationQuery {
  page?: string | number;
  pageSize?: string | number;
  limit?: string | number; // Alternative name for pageSize
}

/**
 * Common rate limit information returned by user-related endpoints
 *
 * @guaranteed Fields are always present when endpoint includes rate limit info
 */
export interface RateLimitInfo {
  /** Remaining daily exam attempts */
  remainingDailyAttempts: number;
  /** Total daily limit for exams */
  dailyLimit: number;
  /** Next reset time as ISO string */
  nextResetTime: string;
  /** Current tokens available */
  currentTokens: number;
  /** Token generation rate per hour */
  tokensPerHour: number;
}

/**
 * Extended user list response that includes rate limit info
 * Used by endpoints like GET /api/users/{userId}/exams
 */
export interface ListResponseWithRateLimit<T> extends ListResponse<T> {
  rateLimit: RateLimitInfo;
}

/**
 * Error response codes used throughout the API
 */
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INSUFFICIENT_TOKENS = 'INSUFFICIENT_TOKENS',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Standard error response envelope with code
 */
export interface ApiErrorResponseWithCode {
  success: false;
  error: string;
  code: ApiErrorCode;
}
