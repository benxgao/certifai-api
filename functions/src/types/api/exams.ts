/**
 * Exam API types
 *
 * Request and response types for exam-related endpoints:
 * - GET /api/users/{userId}/exams/{examId}
 * - GET /api/users/{userId}/exams/{examId}/questions
 * - POST /api/users/{userId}/exams/{examId}/submit
 * - GET /api/users/{userId}/exams/{examId}/report
 * - GET /api/users/{userId}/exams/{examId}/status
 */

import { DataResponse, ListResponse } from './common';
import { ExamStatus, DifficultyLevel } from '../enums';

/**
 * GET /api/users/{userId}/exams/{examId}
 *
 * Retrieves detailed information about a specific exam attempt
 *
 * @example
 * GET /api/users/uuid-123/exams/exam-456
 */
export type GetExamRequest = Record<string, never>; // URL params only

export type GetExamResponse = DataResponse<ExamDetailData>;

/**
 * Complete exam details including questions and answers
 */
export interface ExamDetailData {
  /** Exam attempt ID @guaranteed */
  exam_id: string;
  /** API user ID @guaranteed */
  api_user_id: string;
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Current exam status @guaranteed */
  exam_status: ExamStatus;
  /** Exam was started (ISO datetime) @guaranteed */
  started_at: string;
  /** Exam was submitted (null if not completed) @optional */
  submitted_at?: string;
  /** User's final score @optional */
  score?: number;
  /** Total questions in exam @optional */
  total_questions?: number;
  /** Token cost for generating this exam @guaranteed */
  token_cost: number;
  /** Custom prompt used for generation @optional */
  custom_prompt_text?: string;
  /** Certification metadata @guaranteed */
  certification: ExamCertificationDetail;
  /** User's answers to exam questions @guaranteed */
  answers: ExamAnswer[];
  /** Generated questions for this exam @guaranteed */
  generatedQuestions: GeneratedQuestion[];
}

export interface ExamCertificationDetail {
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Certification name @guaranteed */
  name: string;
  /** URL to exam guide @optional */
  exam_guide_url?: string;
  /** Passing score percentage @guaranteed */
  pass_score: number;
  /** Minimum questions @guaranteed */
  min_quiz_counts: number;
  /** Maximum questions @guaranteed */
  max_quiz_counts: number;
}

/**
 * User's answer to an exam question
 */
export interface ExamAnswer {
  /** User answer record ID @guaranteed */
  user_answer_id: string;
  /** The question being answered @guaranteed */
  quiz_question_id: string;
  /** Option the user selected @optional */
  selected_option_id?: string;
  /** Whether the answer was correct @optional */
  is_correct?: boolean;
  /** Text of the question @guaranteed */
  question_text: string;
  /** Options available for this question @guaranteed */
  answerOptions: AnswerOption[];
  /** Explanation for correct answer @optional */
  explanations?: string;
}

/**
 * Single answer option for a question
 */
export interface AnswerOption {
  /** Option ID @guaranteed */
  option_id: string;
  /** Text of the option @guaranteed */
  option_text: string;
  /** Whether this is the correct answer @guaranteed */
  is_correct: boolean;
}

/**
 * Question generated for this exam attempt
 */
export interface GeneratedQuestion {
  /** Question ID @guaranteed */
  quiz_question_id: string;
  /** The question text @guaranteed */
  question_text: string;
  /** Difficulty level @guaranteed */
  difficulty: DifficultyLevel;
  /** Exam topic covered @optional */
  exam_topic?: string;
  /** Answer options @guaranteed */
  answerOptions: AnswerOption[];
  /** Explanation of correct answer @optional */
  explanations?: string;
}

/**
 * GET /api/users/{userId}/exams/{examId}/questions
 *
 * Retrieves questions for an exam attempt
 */
export type GetExamQuestionsRequest = Record<string, never>; // URL params only

export type GetExamQuestionsResponse = ListResponse<ExamQuestion>;

/**
 * Single question in an exam
 */
export interface ExamQuestion {
  /** Question ID @guaranteed */
  quiz_question_id: string;
  /** Question text @guaranteed */
  question_text: string;
  /** Difficulty level @guaranteed */
  difficulty: DifficultyLevel;
  /** Topic this question covers @optional */
  exam_topic?: string;
  /** Answer options @guaranteed */
  answerOptions: AnswerOption[];
  /** Explanation for correct answer @optional */
  explanations?: string;
  /** User's selected answer (if submitted) @optional */
  userAnswer?: {
    selected_option_id?: string;
    is_correct?: boolean;
  };
}

/**
 * POST /api/users/{userId}/exams/{examId}/submit
 *
 * Submits a completed exam with all answers
 */
export interface SubmitExamRequest {
  answers: AnswerSubmission[];
  timeSpent?: number; // milliseconds
}

export interface AnswerSubmission {
  /** Question ID being answered @guaranteed */
  quiz_question_id: string;
  /** Option ID selected, null if skip @optional */
  selected_option_id?: string;
}

export type SubmitExamResponse = DataResponse<ExamSubmitResult>;

export interface ExamSubmitResult {
  /** Whether submission was successful @guaranteed */
  success: boolean;
  /** Final exam score @guaranteed */
  score: number;
  /** Whether user passed @guaranteed */
  passed: boolean;
  /** Passing threshold @guaranteed */
  pass_score: number;
  /** Exam attempt ID @guaranteed */
  exam_id: string;
  /** Submission timestamp @guaranteed */
  submitted_at: string;
  /** Questions answered correctly @guaranteed */
  correctCount: number;
  /** Total questions on exam @guaranteed */
  totalCount: number;
}

/**
 * GET /api/users/{userId}/exams/{examId}/report
 *
 * Retrieves a detailed exam report with analysis
 */
export type GetExamReportRequest = Record<string, never>; // URL params only

export type GetExamReportResponse = DataResponse<ExamReport>;

export interface ExamReport {
  /** Exam ID @guaranteed */
  exam_id: string;
  /** User's score @guaranteed */
  score: number;
  /** Whether user passed @guaranteed */
  passed: boolean;
  /** Passing threshold @guaranteed */
  pass_score: number;
  /** When exam started @guaranteed */
  started_at: string;
  /** When exam was submitted @optional */
  submitted_at?: string;
  /** Time spent on exam (ms) @optional */
  timeSpent?: number;
  /** Performance breakdown by topic @optional */
  byTopic?: TopicPerformance[];
  /** Performance breakdown by difficulty @optional */
  byDifficulty?: DifficultyPerformance[];
}

export interface TopicPerformance {
  /** Topic name @guaranteed */
  topic: string;
  /** Percentage correct @guaranteed */
  percentage: number;
  /** Questions in this topic @guaranteed */
  questionCount: number;
}

export interface DifficultyPerformance {
  /** Difficulty level @guaranteed */
  difficulty: DifficultyLevel;
  /** Percentage correct @guaranteed */
  percentage: number;
  /** Question count at this difficulty @guaranteed */
  questionCount: number;
}

/**
 * GET /api/users/{userId}/exams/{examId}/status
 * or
 * GET /api/users/{userId}/exams/{examId}/live-status
 *
 * Retrieves real-time status of an exam attempt
 */
export type GetExamStatusRequest = Record<string, never>; // URL params only

export type GetExamStatusResponse = DataResponse<ExamStatus>;

/**
 * POST /api/users/{userId}/exams
 *
 * Creates a new exam attempt for a certification
 */
export interface CreateExamRequest {
  /** Certification ID to create exam for @guaranteed */
  cert_id: number;
  /** Custom prompt for question generation @optional */
  customPrompt?: string;
  /** Number of questions to generate @optional */
  questionCount?: number;
}

export type CreateExamResponse = DataResponse<NewExamData>;

export interface NewExamData {
  /** ID of created exam @guaranteed */
  exam_id: string;
  /** Certification ID @guaranteed */
  cert_id: number;
  /** Initial exam status (usually PENDING_QUESTIONS) @guaranteed */
  exam_status: ExamStatus;
  /** When exam was created @guaranteed */
  created_at: string;
  /** Token cost for generation @guaranteed */
  token_cost: number;
}
