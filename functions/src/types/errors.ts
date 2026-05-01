/**
 * Custom error classes for the CertifAI API
 *
 * Provides structured error types for consistent error handling
 * across all endpoint handlers, middleware, and services.
 */

/**
 * Base API error class with HTTP status code and optional context
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * 401 - Firebase token missing or invalid
 */
export class AuthenticationError extends APIError {
  constructor(message = 'Authentication token is required or invalid') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 403 - Authenticated user does not have permission for the requested resource
 */
export class AuthorizationError extends APIError {
  constructor(message = 'You do not have permission to access this resource') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * 400 - Request body or parameters failed validation
 */
export class ValidationError extends APIError {
  constructor(
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 404 - Requested resource does not exist
 */
export class NotFoundError extends APIError {
  constructor(
    message: string,
    public resourceType?: string,
    public resourceId?: string,
  ) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 - Resource already exists or state conflict
 */
export class ConflictError extends APIError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 429 - Too many requests from this user
 */
export class RateLimitError extends APIError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 500 - Unexpected server-side failure
 */
export class InternalServerError extends APIError {
  constructor(message = 'An unexpected error occurred') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
    this.name = 'InternalServerError';
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * Exam question generation failed (AI or database error)
 */
export class ExamGenerationError extends APIError {
  constructor(
    message: string,
    public examId: string,
    public certId?: number,
  ) {
    super(message, 500, 'EXAM_GENERATION_ERROR');
    this.name = 'ExamGenerationError';
    Object.setPrototypeOf(this, ExamGenerationError.prototype);
  }
}

/**
 * Exam submission failed (validation, scoring, or persistence error)
 */
export class ExamSubmissionError extends APIError {
  constructor(
    message: string,
    public examId: string,
    public userId: string,
  ) {
    super(message, 422, 'EXAM_SUBMISSION_ERROR');
    this.name = 'ExamSubmissionError';
    Object.setPrototypeOf(this, ExamSubmissionError.prototype);
  }
}

/**
 * Insufficient tokens for an operation.
 * Uses 403 (Forbidden) since the user is authenticated but lacks the credit
 * balance required to perform the action.
 */
export class InsufficientTokensError extends APIError {
  constructor(
    message = 'Insufficient tokens to perform this operation',
    public required?: number,
    public available?: number,
  ) {
    super(message, 403, 'INSUFFICIENT_TOKENS');
    this.name = 'InsufficientTokensError';
    Object.setPrototypeOf(this, InsufficientTokensError.prototype);
  }
}
