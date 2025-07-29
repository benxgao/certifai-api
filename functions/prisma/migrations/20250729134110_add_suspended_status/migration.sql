-- Add SUSPENDED status to CertificationStatus enum
ALTER TYPE "CertificationStatus" ADD VALUE 'SUSPENDED';

-- Acknowledge existing performance indexes (already created manually)
-- These indexes were added for performance optimization and exist in the database:
-- 1. idx_answer_option_question on AnswerOption (quiz_question_id)
-- 2. idx_answer_option_question_created on AnswerOption (quiz_question_id, created_at)
-- 3. idx_certification_firm on Certification (firm_id, name)
-- 4. idx_exam_attempt_user_started_recent on ExamAttempt (user_id, started_at)
-- 5. idx_exam_user_answer_exam_question on ExamUserAnswer (exam_id, quiz_question_id)
-- 6. idx_exam_user_answer_exam_id on ExamUserAnswer (exam_id, user_answer_id)
-- 7. idx_user_cert_status_updated on UserCertification (user_id, status, updated_at)
-- 8. idx_user_cert_updated on UserCertification (user_id, cert_id, updated_at)
-- 9. idx_user_composite on User (user_id, updated_at, credit_tokens, energy_tokens)

-- These indexes are already present in the database and do not need to be created again.
-- This migration only adds the new enum value.
