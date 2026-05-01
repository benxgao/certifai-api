/**
 * TypeScript enumerations for fixed-value fields
 *
 * These mirror the Prisma schema enums so that application code
 * can reference named constants instead of raw string literals,
 * preventing typos and improving refactorability.
 *
 * @see functions/prisma/schema.prisma
 */

/**
 * Status of a user's certification progress.
 *
 * @prismaEnum CertificationStatus
 */
export enum CertificationStatus {
  /** User has passed the certification exam */
  PASSED = 'PASSED',
  /** User is actively studying or taking practice exams */
  IN_PROGRESS = 'IN_PROGRESS',
  /** User has expressed interest but not yet started */
  INTERESTED = 'INTERESTED',
  /** Certification record is being removed */
  DELETING = 'DELETING',
  /** User has not yet started preparation */
  NOT_STARTED = 'NOT_STARTED',
  /** Certification has passed its validity period */
  EXPIRED = 'EXPIRED',
  /** Certification has been suspended */
  SUSPENDED = 'SUSPENDED',
}

/**
 * Lifecycle status of a single exam attempt.
 *
 * @prismaEnum ExamStatus
 */
export enum ExamStatus {
  /** Exam created; questions have not started generating yet */
  PENDING_QUESTIONS = 'PENDING_QUESTIONS',
  /** AI question generation is currently in progress */
  QUESTIONS_GENERATING = 'QUESTIONS_GENERATING',
  /** Questions are ready; user can start the exam */
  READY = 'READY',
  /** User has started answering questions */
  IN_PROGRESS = 'IN_PROGRESS',
  /** User has submitted the exam */
  COMPLETED = 'COMPLETED',
  /** AI question generation encountered an error */
  QUESTION_GENERATION_FAILED = 'QUESTION_GENERATION_FAILED',
}

/**
 * Difficulty level of a quiz question.
 *
 * @prismaEnum DifficultyLevel
 */
export enum DifficultyLevel {
  /** Entry-level concepts */
  EASY = 'EASY',
  /** Intermediate, real-world application scenarios */
  ADVANCED = 'ADVANCED',
  /** Deep technical or edge-case scenarios */
  EXPERT = 'EXPERT',
}
