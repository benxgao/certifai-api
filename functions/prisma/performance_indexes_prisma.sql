-- Performance optimization indexes for CertifAI API
-- These indexes are designed to improve query performance for high-traffic operations
-- Note: CONCURRENTLY removed for Prisma compatibility

-- 1. Index for exam rate limiting queries (most critical)
-- Optimizes queries that check recent exam creation by user
CREATE INDEX IF NOT EXISTS idx_exam_attempt_user_started_recent
ON "ExamAttempt" (user_id, started_at DESC);

-- 2. Index for quiz question selection by certification and topic
-- Optimizes exam question association queries
CREATE INDEX IF NOT EXISTS idx_quiz_question_cert_topic_active
ON "QuizQuestion" (cert_id, exam_topic)
WHERE is_deprecated = false;

-- 3. Composite index for exam user answers
-- Optimizes queries that fetch user answers for specific exams
CREATE INDEX IF NOT EXISTS idx_exam_user_answer_exam_question
ON "ExamUserAnswer" (exam_id, quiz_question_id);

-- 4. Index for user certification status queries
-- Optimizes user dashboard and certification progress queries
CREATE INDEX IF NOT EXISTS idx_user_cert_status_updated
ON "UserCertification" (user_id, status, updated_at DESC);

-- 5. Index for answer options by question (for exam display)
-- Optimizes answer option loading for quiz questions
CREATE INDEX IF NOT EXISTS idx_answer_option_question
ON "AnswerOption" (quiz_question_id);

-- 6. Index for firm-certification relationships (for public API)
-- Optimizes public API queries for certifications by firm
CREATE INDEX IF NOT EXISTS idx_certification_firm
ON "Certification" (firm_id, name);

-- 7. Partial index for active exam attempts
-- Optimizes queries for in-progress exams
CREATE INDEX IF NOT EXISTS idx_exam_attempt_active
ON "ExamAttempt" (user_id, exam_status, started_at DESC)
WHERE exam_status IN ('READY', 'IN_PROGRESS', 'QUESTIONS_GENERATING');

-- 8. Index for quiz questions generated from specific exams
-- Optimizes cleanup and question association queries
CREATE INDEX IF NOT EXISTS idx_quiz_question_generated_from
ON "QuizQuestion" (generated_from)
WHERE generated_from IS NOT NULL;

-- 9. Index for user lookup by Firebase ID (authentication queries)
-- Optimizes user authentication and profile queries
CREATE INDEX IF NOT EXISTS idx_user_firebase_id
ON "User" (firebase_user_id)
WHERE firebase_user_id IS NOT NULL;

-- 10. Composite index for certification counts (public API optimization)
-- Optimizes queries that count certifications per firm for public display
CREATE INDEX IF NOT EXISTS idx_certification_firm_count
ON "Certification" (firm_id);
