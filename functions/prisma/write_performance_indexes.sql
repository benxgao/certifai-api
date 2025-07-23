-- Additional write performance optimization indexes
-- These indexes specifically target write-heavy operations and concurrent access patterns

-- 1. Index for concurrent quiz question writes by exam and certification
-- Helps prevent deadlocks during question generation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_question_exam_cert_write_opt
ON "QuizQuestion" (generated_from, cert_id, created_at DESC)
WHERE generated_from IS NOT NULL;

-- 2. Index for answer option writes grouped by question
-- Optimizes batch answer option creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_answer_option_write_batch
ON "AnswerOption" (quiz_question_id, created_at DESC);

-- 3. Partial index for active exam writes
-- Reduces contention for exam status updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_attempt_write_active
ON "ExamAttempt" (exam_id, exam_status, updated_at DESC)
WHERE exam_status IN ('PENDING_QUESTIONS', 'QUESTIONS_GENERATING', 'READY', 'IN_PROGRESS');

-- 4. Index for user token operations (credit/energy updates)
-- Optimizes concurrent user token updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_tokens_concurrent_update
ON "User" (user_id, updated_at DESC)
INCLUDE (credit_tokens, energy_tokens);

-- 5. Index for exam user answer batch writes
-- Optimizes batch creation of exam answers (using user_answer_id since no created_at field exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exam_user_answer_batch_write
ON "ExamUserAnswer" (exam_id, user_answer_id);

-- 6. Index for user certification status updates
-- Optimizes concurrent certification status changes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_cert_status_write_opt
ON "UserCertification" (user_id, cert_id, updated_at DESC);

-- 7. Composite index for question topic assignments
-- Optimizes exam topic list updates during question generation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_question_topic_assignment
ON "QuizQuestion" (exam_topic, cert_id, generated_from)
WHERE is_deprecated = false AND generated_from IS NOT NULL;

-- Write performance monitoring queries
-- Use these to verify write performance improvements

-- Check concurrent question creation performance
-- EXPLAIN (ANALYZE, BUFFERS)
-- INSERT INTO "QuizQuestion" (cert_id, question_text, exam_topic, generated_from, created_at)
-- VALUES (1, 'Sample question', 'sample-topic', 'exam-123', NOW());

-- Check batch answer option creation performance
-- EXPLAIN (ANALYZE, BUFFERS)
-- INSERT INTO "AnswerOption" (quiz_question_id, option_text, is_correct, created_at)
-- SELECT 'question-123', 'Option ' || generate_series(1,4), false, NOW();

-- Check user token update performance
-- EXPLAIN (ANALYZE, BUFFERS)
-- UPDATE "User" SET credit_tokens = credit_tokens - 60, energy_tokens = energy_tokens + 10, updated_at = NOW()
-- WHERE user_id = 'sample-user-id';

-- Verify index usage for write operations
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE indexname LIKE '%write%' OR indexname LIKE '%batch%' OR indexname LIKE '%concurrent%'
-- ORDER BY idx_scan DESC;
