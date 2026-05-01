/**
 * Express type extensions for the CertifAI API
 *
 * Provides typed request/response interfaces that extend Express
 * base types with application-specific fields set by middleware.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { FirebaseJwtToken } from './index';

/**
 * Verified user record attached by verifyUserAccess middleware.
 */
export interface VerifiedUser {
  user_id: string;
  firebase_user_id: string | null;
}

/**
 * Extends Express Request with fields populated by auth middleware:
 * - `firebase_user_info` – decoded Firebase JWT (set by verifyFirebaseToken)
 * - `verified_user`      – DB user record   (set by verifyUserAccess)
 */
export interface AuthenticatedRequest extends Request {
  firebase_user_info: FirebaseJwtToken;
  verified_user?: VerifiedUser;
}

/**
 * Strongly-typed Express request handler for **public** (unauthenticated) routes.
 *
 * Auth-related fields (`firebase_user_info`, `verified_user`) are optional
 * because this type covers routes that do not require authentication.
 * For routes behind auth middleware use {@link AuthenticatedRequestHandler} instead.
 *
 * @template ReqBody   - Shape of `req.body`
 * @template ResBody   - Shape of the JSON response body
 * @template Params    - Shape of `req.params` (defaults to Record<string, string>)
 * @template Query     - Shape of `req.query`  (defaults to Record<string, unknown>)
 */
export type TypedRequestHandler<
  ReqBody = unknown,
  ResBody = unknown,
  Params extends Record<string, string> = Record<string, string>,
  Query extends Record<string, unknown> = Record<string, unknown>,
> = (
  req: Request<Params, ResBody, ReqBody, Query> & {
    firebase_user_info?: FirebaseJwtToken;
    verified_user?: VerifiedUser;
  },
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<void> | void;

/**
 * Typed version of Express RequestHandler using AuthenticatedRequest.
 * Use for middleware that runs after verifyFirebaseToken + verifyUserAccess.
 */
export type AuthenticatedRequestHandler<
  ReqBody = unknown,
  ResBody = unknown,
  Params extends Record<string, string> = Record<string, string>,
  Query extends Record<string, unknown> = Record<string, unknown>,
> = (
  req: AuthenticatedRequest & Request<Params, ResBody, ReqBody, Query>,
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<void> | void;

/**
 * Standard success API response envelope.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Standard error API response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Union of success and error response envelopes.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Re-export base Express types for convenience
export type { RequestHandler, Request, Response, NextFunction };
