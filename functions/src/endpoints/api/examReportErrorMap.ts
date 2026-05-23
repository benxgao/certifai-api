import { Response } from 'express';

export type ExamReportErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'ACCESS_DENIED'
  | 'EXAM_NOT_FOUND'
  | 'EXAM_NOT_COMPLETED'
  | 'NO_PERFORMANCE_DATA'
  | 'GENKIT_SCHEMA_INVALID'
  | 'REPORT_PERSISTENCE_FAILED'
  | 'REPORT_GENERATION_TRANSIENT'
  | 'INTERNAL_CONFIGURATION_ERROR';

export interface ExamReportErrorEnvelope {
  status: number;
  error: string;
  error_code: ExamReportErrorCode;
  retriable: boolean;
  details?: Record<string, unknown>;
}

const buildErrorEnvelope = (
  status: number,
  error: string,
  errorCode: ExamReportErrorCode,
  retriable: boolean,
  details?: Record<string, unknown>,
): ExamReportErrorEnvelope => ({
  status,
  error,
  error_code: errorCode,
  retriable,
  details,
});

export const mapExamReportError = (
  error: unknown,
  fallbackMessage: string,
): ExamReportErrorEnvelope => {
  const errorMessage =
    error instanceof Error ? error.message : String(error || fallbackMessage);
  const normalizedMessage = errorMessage.toLowerCase();

  if (normalizedMessage.includes('exam_id is required')) {
    return buildErrorEnvelope(400, errorMessage, 'VALIDATION_ERROR', false);
  }

  if (
    normalizedMessage.includes('user id and exam id are required') ||
    normalizedMessage.includes('invalid task payload')
  ) {
    return buildErrorEnvelope(400, errorMessage, 'VALIDATION_ERROR', false);
  }

  if (normalizedMessage.includes('authentication required')) {
    return buildErrorEnvelope(401, errorMessage, 'AUTH_REQUIRED', false);
  }

  if (normalizedMessage.includes('user verification middleware')) {
    return buildErrorEnvelope(
      500,
      errorMessage,
      'INTERNAL_CONFIGURATION_ERROR',
      false,
    );
  }

  if (normalizedMessage.includes('exam not found')) {
    return buildErrorEnvelope(404, errorMessage, 'EXAM_NOT_FOUND', false);
  }

  if (normalizedMessage.includes('access denied')) {
    return buildErrorEnvelope(403, errorMessage, 'ACCESS_DENIED', false);
  }

  if (normalizedMessage.includes('completed exams')) {
    return buildErrorEnvelope(400, errorMessage, 'EXAM_NOT_COMPLETED', false);
  }

  if (normalizedMessage.includes('no valid performance')) {
    return buildErrorEnvelope(400, errorMessage, 'NO_PERFORMANCE_DATA', false);
  }

  if (
    normalizedMessage.includes('schema validation failed') ||
    normalizedMessage.includes('invalid_argument')
  ) {
    return buildErrorEnvelope(500, errorMessage, 'GENKIT_SCHEMA_INVALID', false);
  }

  if (normalizedMessage.includes('failed to store exam report in firestore')) {
    return buildErrorEnvelope(
      500,
      errorMessage,
      'REPORT_PERSISTENCE_FAILED',
      true,
    );
  }

  return buildErrorEnvelope(
    500,
    fallbackMessage,
    'REPORT_GENERATION_TRANSIENT',
    true,
    {
      original_error: errorMessage,
    },
  );
};

export const sendExamReportErrorResponse = (
  res: Response,
  envelope: ExamReportErrorEnvelope,
): void => {
  res.status(envelope.status).json({
    success: false,
    error: envelope.error,
    error_code: envelope.error_code,
    retriable: envelope.retriable,
    ...(envelope.details ? { details: envelope.details } : {}),
  });
};
