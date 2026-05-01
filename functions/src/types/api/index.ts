/**
 * API Request/Response type exports
 *
 * This module aggregates all endpoint request/response types from:
 * - common.ts   (shared types, pagination, error codes)
 * - users.ts    (auth and user endpoints)
 * - exams.ts    (exam attempt endpoints)
 * - certifications.ts (certification endpoints)
 * - questions.ts (question/answer endpoints)
 *
 * @example
 * import {
 *   GetUserExamsResponse,
 *   SubmitExamRequest,
 *   CertificationListItem,
 * } from '@/src/types/api';
 */

// Common types
export * from './common';

// Auth and user endpoints
export * from './users';

// Exam endpoints (includes ExamCertificationDetail for exam context)
export * from './exams';

// Certification endpoints (includes main CertificationDetail for cert context)
export * from './certifications';

// Question/answer endpoints
export * from './questions';
