import logger from '../../../services/firebase/logger';

/**
 * Error classification for exam generation failures
 * Helps identify the root cause of generation failures
 */

export type ErrorClassification =
  | 'AI_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'DB_PERSISTENCE_FAILURE'
  | 'TIMEOUT_FAILURE'
  | 'STATE_VALIDATION_FAILURE'
  | 'TOPIC_PREPARATION_FAILURE'
  | 'UNKNOWN_FAILURE';

export interface ClassifiedError {
  classification: ErrorClassification;
  errorMessage: string;
  stackTrace?: string;
  recoveryHint: string;
  errorData: {
    exam_id: string;
    batch_number: number;
    timestamp: string;
    lastSuccessfulStep?: string;
  };
}

/**
 * Classifies errors based on patterns and context
 */
export const classifyExamGenerationError = (
  error: unknown,
  context: {
    exam_id: string;
    batch_number: number;
    lastSuccessfulStep?: string;
  }
): ClassifiedError => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stackTrace = error instanceof Error ? error.stack : undefined;

  // Classify by error message patterns
  let classification: ErrorClassification = 'UNKNOWN_FAILURE';
  let recoveryHint = 'Check Cloud Logging for detailed error trace';

  if (errorMessage.includes('AI') || errorMessage.includes('Gemini')) {
    classification = 'AI_FAILURE';
    recoveryHint = 'Check Gemini API quota, rate limits, and authentication. May need to retry after cooldown.';
  } else if (
    errorMessage.includes('validation') ||
    errorMessage.includes('valid') ||
    errorMessage.includes('Invalid')
  ) {
    classification = 'VALIDATION_FAILURE';
    recoveryHint = 'Generated questions failed validation constraints. Check question generation prompt and validation rules.';
  } else if (
    errorMessage.includes('database') ||
    errorMessage.includes('prisma') ||
    errorMessage.includes('uniqueness') ||
    errorMessage.includes('constraint')
  ) {
    classification = 'DB_PERSISTENCE_FAILURE';
    recoveryHint = 'Database write failed due to constraint or connection issue. Check PostgreSQL connection and table constraints.';
  } else if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('exceeded') ||
    errorMessage.includes('deadline')
  ) {
    classification = 'TIMEOUT_FAILURE';
    recoveryHint = 'Cloud Task execution exceeded time limit. Optimize question generation or batch size.';
  } else if (
    errorMessage.includes('state') ||
    errorMessage.includes('status') ||
    errorMessage.includes('exam not found')
  ) {
    classification = 'STATE_VALIDATION_FAILURE';
    recoveryHint = 'Exam state is invalid for generation. Check if exam was deleted or moved to another state.';
  } else if (
    errorMessage.includes('topic') ||
    errorMessage.includes('preparation')
  ) {
    classification = 'TOPIC_PREPARATION_FAILURE';
    recoveryHint = 'Failed to prepare topics for generation. Validate topic data in RTDB.';
  }

  const now = new Date().toISOString();
  const classifiedError: ClassifiedError = {
    classification,
    errorMessage,
    stackTrace,
    recoveryHint,
    errorData: {
      exam_id: context.exam_id,
      batch_number: context.batch_number,
      timestamp: now,
      lastSuccessfulStep: context.lastSuccessfulStep,
    },
  };

  return classifiedError;
};

/**
 * Logs classified error with all context for debugging
 */
export const logClassifiedExamError = (
  classifiedError: ClassifiedError
): void => {
  logger.error('EXAM_GENERATION_ERROR_CLASSIFIED', {
    classification: classifiedError.classification,
    error_message: classifiedError.errorMessage,
    stack_trace: classifiedError.stackTrace,
    recovery_hint: classifiedError.recoveryHint,
    exam_id: classifiedError.errorData.exam_id,
    batch_number: classifiedError.errorData.batch_number,
    last_successful_step: classifiedError.errorData.lastSuccessfulStep,
    timestamp: classifiedError.errorData.timestamp,
    structuredData: true,
  });
};

/**
 * Extract diagnostic info from error and context
 */
export const getDiagnosticInfo = (
  error: unknown,
  stepName: string
): {
  stepName: string;
  errorName?: string;
  errorMessage: string;
  fullContext: string;
} => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : typeof error;

  return {
    stepName,
    errorName,
    errorMessage,
    fullContext: `${stepName}: ${errorMessage}`,
  };
};
