/**
 * Question and Answer API types
 *
 * Request and response types for question-related endpoints:
 * - POST /api/users/{userId}/exams/{examId}/questions/{questionId}/answer
 * - GET /api/users/{userId}/exams/{examId}/questions (see exams.ts)
 */

import { DataResponse } from './common';
import { DifficultyLevel } from '../enums';

/**
 * POST /api/users/{userId}/exams/{examId}/questions/{questionId}/answer
 *
 * Submits an answer to a single exam question
 *
 * @example
 * POST /api/users/uuid-123/exams/exam-456/questions/q-789/answer
 * Body: { selected_option_id: "opt-111" }
 */
export interface SubmitAnswerRequest {
  /** ID of the option user selected @optional Can be null for skip */
  selected_option_id?: string | null;
}

export type SubmitAnswerResponse = DataResponse<AnswerResult>;

/**
 * Result of submitting a single answer
 */
export interface AnswerResult {
  /** Whether submission was successful @guaranteed */
  success: boolean;
  /** The question that was answered @guaranteed */
  question_id: string;
  /** The option that was selected @optional */
  selected_option_id?: string;
  /** Whether the answer was correct @optional */
  is_correct?: boolean;
  /** Correct option if answer was wrong @optional */
  correct_option_id?: string;
  /** Explanation of the correct answer @optional */
  explanation?: string;
}

/**
 * POST /api/users/{userId}/exams/{examId}/answers
 * (batch answer submission - alternative to single question endpoint)
 *
 * Submits multiple answers at once
 */
export interface SubmitAnswersBatchRequest {
  /** Multiple answers to submit @guaranteed */
  answers: BatchAnswerSubmission[];
}

export interface BatchAnswerSubmission {
  /** Question ID @guaranteed */
  question_id: string;
  /** Option ID selected @optional */
  selected_option_id?: string | null;
}

export type SubmitAnswersBatchResponse = DataResponse<BatchAnswerResult>;

export interface BatchAnswerResult {
  /** Whether all answers were processed @guaranteed */
  success: boolean;
  /** Individual results for each answer @guaranteed */
  results: AnswerResult[];
  /** Number of correct answers @guaranteed */
  correctCount: number;
  /** Total answers submitted @guaranteed */
  totalCount: number;
  /** Current exam score @guaranteed */
  score: number;
}

/**
 * GET /api/users/{userId}/exams/{examId}/questions/{questionId}
 *
 * Retrieves a specific question with its options
 *
 * @example
 * GET /api/users/uuid-123/exams/exam-456/questions/q-789
 */
export type GetQuestionRequest = Record<string, never>; // URL params only

export type GetQuestionResponse = DataResponse<QuestionDetail>;

/**
 * Detailed question information
 */
export interface QuestionDetail {
  /** Question ID @guaranteed */
  question_id: string;
  /** Question text @guaranteed */
  text: string;
  /** Difficulty level @guaranteed */
  difficulty: DifficultyLevel;
  /** Topic/subject @optional */
  topic?: string;
  /** All available answer options @guaranteed */
  options: QuestionOption[];
  /** Explanation of correct answer @optional (only if already submitted) */
  explanation?: string;
  /** User's previous answer to this question @optional */
  userAnswer?: {
    /** Option ID user selected @optional */
    selected_option_id?: string;
    /** Whether it was correct @optional */
    is_correct?: boolean;
  };
}

/**
 * Single answer option for a question
 */
export interface QuestionOption {
  /** Option ID @guaranteed */
  option_id: string;
  /** Option text @guaranteed */
  text: string;
  /** Whether this is the correct answer (only shown after submission) @optional */
  is_correct?: boolean;
}

/**
 * GET /api/users/{userId}/exams/{examId}/questions/{questionId}/hint
 *
 * Retrieves a hint for a question
 *
 * @example
 * GET /api/users/uuid-123/exams/exam-456/questions/q-789/hint
 */
export type GetQuestionHintRequest = Record<string, never>; // URL params only

export type GetQuestionHintResponse = DataResponse<HintData>;

export interface HintData {
  /** The hint text @guaranteed */
  hint: string;
  /** Whether hint reveals answer directly @guaranteed */
  revealsAnswer: boolean;
  /** Topic highlight (which concept is being tested) @optional */
  topicFocus?: string;
}

/**
 * DELETE /api/users/{userId}/exams/{examId}/questions/{questionId}/answer
 *
 * Clears a previously submitted answer, allowing retake
 */
export type ClearAnswerRequest = Record<string, never>; // URL params only

export interface ClearAnswerResponse {
  success: true;
}

/**
 * POST /api/ai/questions/generate
 *
 * Generates exam questions for a certification
 */
export interface GenerateQuestionsRequest {
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Number of questions to generate @guaranteed */
  count: number;
  /** Optional custom prompt for generation @optional */
  customPrompt?: string;
  /** Difficulty levels to generate (if not specified, mix) @optional */
  difficulties?: DifficultyLevel[];
}

export type GenerateQuestionsResponse = DataResponse<GeneratedQuestionSet>;

export interface GeneratedQuestionSet {
  /** Unique generation task ID @guaranteed */
  generation_id: string;
  /** Questions that were generated @guaranteed */
  questions: GeneratedQuestionDetail[];
  /** When generation completed @guaranteed */
  completed_at: string;
  /** Token cost for this generation @guaranteed */
  token_cost: number;
}

export interface GeneratedQuestionDetail {
  /** Question ID @guaranteed */
  question_id: string;
  /** The question text @guaranteed */
  text: string;
  /** Difficulty assigned @guaranteed */
  difficulty: DifficultyLevel;
  /** Topic covered @optional */
  topic?: string;
  /** Answer options @guaranteed */
  options: QuestionOption[];
  /** Explanation of correct answer @guaranteed */
  explanation: string;
}

/**
 * Error for submission failures with context about which question failed
 *
 * Used by submit answer endpoints to provide detailed error information
 */
export interface AnswerSubmissionError extends Error {
  /** Question ID that failed @guaranteed */
  question_id: string;
  /** Error code for programmatic handling @guaranteed */
  code: string;
  /** Human-readable error message @guaranteed */
  message: string;
}
