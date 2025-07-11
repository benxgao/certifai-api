-- Test query to verify index usage for rate limiting
-- This should use the idx_exam_attempt_user_started_recent index
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM "ExamAttempt"
WHERE user_id = 'test-user-id'
AND started_at >= NOW() - INTERVAL '24 hours';
