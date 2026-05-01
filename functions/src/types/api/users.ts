/**
 * Authentication and User API types
 *
 * Request and response types for auth and user-related endpoints:
 * - POST /api/auth/login
 * - POST /api/auth/register
 * - POST /api/auth/generateToken
 * - GET /api/users/{userId}/profile
 * - DELETE /api/users/{userId}
 * - GET /api/users/{userId}/rate-limit
 */

import { DataResponse } from './common';

/**
 * POST /api/auth/login
 *
 * Authenticates a user via Firebase JWT token and returns or creates user record
 *
 * @guaranteed Response always includes both api_user_id and firebase_user_id
 */
export type LoginRequest = Record<string, never>; // No body; auth from Firebase JWT header

export type LoginResponse = DataResponse<LoginData>;

export interface LoginData {
  /** Internal UUID used for all API operations @guaranteed */
  api_user_id: string;
  /** Firebase UID for reference @guaranteed */
  firebase_user_id: string;
  /** @deprecated Use api_user_id instead */
  user_id: string;
}

/**
 * POST /api/auth/register
 *
 * Registers a new user with Firebase and creates database record
 */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export type RegisterResponse = DataResponse<RegisterData>;

export interface RegisterData {
  /** Internal UUID for API operations @guaranteed */
  api_user_id: string;
  /** Firebase UID @guaranteed */
  firebase_user_id: string;
  /** User's display name @optional */
  displayName?: string;
  /** User creation timestamp @guaranteed */
  created_at: string;
}

/**
 * POST /api/auth/generateToken
 *
 * Generates a service token for background operations
 */
export interface GenerateTokenRequest {
  scope?: string;
  expiresIn?: number;
}

export type GenerateTokenResponse = DataResponse<TokenData>;

export interface TokenData {
  /** Service token for API operations @guaranteed */
  token: string;
  /** Token expiration unix timestamp @guaranteed */
  expiresAt: number;
  /** When token was issued (ISO string) @guaranteed */
  issuedAt: string;
}

/**
 * GET /api/users/{userId}/profile
 *
 * Retrieves user profile and account information
 */
export type GetUserProfileRequest = Record<string, never>; // URL params only

export type GetUserProfileResponse = DataResponse<UserProfileData>;

export interface UserProfileData {
  /** Internal API user ID @guaranteed */
  api_user_id: string;
  /** Firebase user ID @guaranteed */
  firebase_user_id: string;
  /** User's display name @optional */
  displayName?: string;
  /** Avatar URL for user @optional */
  avatar_url?: string;
  /** Current credit token balance @guaranteed */
  credit_tokens: number;
  /** Current energy token balance @guaranteed */
  energy_tokens: number;
  /** Account creation timestamp @guaranteed */
  created_at: string;
  /** Last account update timestamp @guaranteed */
  updated_at: string;
  /** @deprecated Use api_user_id instead */
  user_id?: string;
}

/**
 * DELETE /api/users/{userId}
 *
 * Deletes a user account and all associated data
 */
export type DeleteUserRequest = Record<string, never>; // URL params only

export interface DeleteUserResponse {
  success: true;
}

/**
 * GET /api/users/{userId}/exams
 *
 * Retrieves all exams for a user with sorting and pagination
 *
 * Query params for sorting and filtering
 */
export interface GetUserExamsQuery {
  /** Page number for pagination @optional */
  page?: string | number;
  /** Items per page @optional */
  pageSize?: string | number;
  /** Certification ID to filter by @optional */
  cert_id?: string | number;
  /** Field to sort by (started_at, submitted_at, score, exam_status) @optional */
  sort_by?: 'started_at' | 'submitted_at' | 'score' | 'exam_status';
  /** Sort direction @optional */
  sort_order?: 'asc' | 'desc';
}

/**
 * Single exam summary in exams list
 */
export interface ExamSummary {
  /** Exam attempt ID @guaranteed */
  exam_id: string;
  /** API user ID @guaranteed */
  api_user_id: string;
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Current exam status @guaranteed */
  exam_status: string; // Should use ExamStatus enum value
  /** Exam was started @guaranteed */
  started_at: string; // ISO datetime
  /** Exam was submitted (null if not completed) @optional */
  submitted_at?: string;
  /** User's score on exam @optional */
  score?: number;
  /** Certification details including name, pass score @guaranteed */
  certification: CertificationInfo;
  /** Total questions in exam @optional */
  total_questions?: number;
  /** Custom prompt used for generation @optional */
  custom_prompt_text?: string;
  /** @deprecated Use api_user_id instead */
  user_id: string;
}

export interface CertificationInfo {
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Certification name @guaranteed */
  name: string;
  /** Exam guide URL @optional */
  exam_guide_url?: string;
  /** Minimum questions for full exam @guaranteed */
  min_quiz_counts: number;
  /** Maximum questions for full exam @guaranteed */
  max_quiz_counts: number;
  /** Passing score percentage @guaranteed */
  pass_score: number;
}

/**
 * GET /api/users/{userId}/rate-limit
 *
 * Retrieves current rate limit status for the user
 */
export type GetRateLimitRequest = Record<string, never>; // URL params only

export type GetRateLimitResponse = DataResponse<RateLimitStatus>;

export interface RateLimitStatus {
  /** Remaining daily exam attempts @guaranteed */
  remainingDailyAttempts: number;
  /** Total daily limit @guaranteed */
  dailyLimit: number;
  /** ISO timestamp when limit resets @guaranteed */
  nextResetTime: string;
  /** Current token balance @guaranteed */
  currentTokens: number;
  /** Tokens generated per hour @guaranteed */
  tokensPerHour: number;
  /** User ID this limit applies to @guaranteed */
  user_id: string;
}

/**
 * POST /api/users/{userId}/ensure-account
 *
 * Ensures a user account exists (creates if needed)
 */
export interface EnsureAccountRequest {
  // URL params and optional body
  firebase_user_id?: string;
}

export type EnsureAccountResponse = DataResponse<AccountData>;

export interface AccountData {
  /** Internal API user ID @guaranteed */
  api_user_id: string;
  /** Firebase user ID @guaranteed */
  firebase_user_id: string;
  /** Whether account was newly created @guaranteed */
  created: boolean;
  /** Account creation timestamp @guaranteed */
  created_at: string;
}
