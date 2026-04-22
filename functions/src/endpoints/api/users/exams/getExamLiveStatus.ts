import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { getRtdbValueWithTimeout } from '../../../../services/firebase/rtdb';
import prismaInstance from '../../../../services/prisma';

/**
 * Get exam live status with real-time progress from Firestore + RTDB
 * This endpoint provides immediate visibility into exam generation status without cache delays.
 * Used by frontend during generation to show progress, bypasses Redis cache for freshness.
 *
 * Progress Calculation:
 * - Source: exam_plans/{exam_id}/questions[] array (counts topics with question_id populated)
 * - NOT sourced from exam_progress (deprecated, being migrated)
 * - Updated in real-time as questions are generated
 *
 * Returns:
 * - Real-time progress percentage calculated from exam_plans structure
 * - Current exam status from database (not cached)
 * - Estimated time remaining based on progress rate
 * - is_complete flag: true when status === 'READY'
 */
const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id, exam_id } = req.params;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required.',
      });
      return;
    }

    if (!exam_id) {
      res.status(400).json({
        success: false,
        error: 'Exam ID is required.',
      });
      return;
    }

    // [LIVE-STATUS] Log checkpoint
    const queryStart = Date.now();
    logger.info(`[LIVE-STATUS] QUERY_INITIATED`, {
      exam_id,
      user_id,
      timestamp_ms: queryStart,
      structuredData: true,
    });

    // Query exam status directly from database (not cached) for freshness
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id },
      select: {
        exam_status: true,
        user_id: true,
        total_questions: true,
        started_at: true,
      },
    });

    if (!exam) {
      res.status(404).json({
        success: false,
        error: 'Exam not found.',
      });
      return;
    }

    // Verify user owns this exam
    if (exam.user_id !== user_id) {
      res.status(403).json({
        success: false,
        error: 'Access denied.',
      });
      return;
    }

    // PROGRESS TRACKING MIGRATION (2026): MIGRATION COMPLETED
    // Previously read from `exam_progress/${exam_id}` RTDB path (deprecated).
    // Now reads from `exam_plans/${exam_id}` as the single source of truth.
    //
    // Why: exam_plans represents the final exam structure and is more reliable.
    // The exam_progress path has been deprecated as of 2026-04-22.
    // All consumers (getUserExam.ts, etc.) have been migrated to exam_plans.
    // Deprecated functions retained until Q3 2026 for rollback capability.
    //
    // const examProgressPath = `exam_progress/${exam_id}`;
    // const rtdbProgress = await getRtdbValue(examProgressPath);

    // Calculate actual progress percentage from exam_plans (current source of truth)
    let progressPercentage = 0;
    let topicsWithQuestions = 0;
    let totalTopics = 0;

    if (exam.exam_status === 'READY') {
      // Exam is complete
      progressPercentage = 100;
      topicsWithQuestions = exam.total_questions || 0;
      totalTopics = exam.total_questions || 0;
    } else if (exam.exam_status === 'QUESTIONS_GENERATING') {
      // Get progress from exam_plans (current state - source of truth for progress)
      // exam_progress RTDB path is deprecated and NOT read here (migration in progress)
      const examPlanPath = `exam_plans/${exam_id}`;
      
      try {
        const examPlan = await getRtdbValueWithTimeout(examPlanPath, 5000);

        if (
          examPlan &&
          examPlan.questions &&
          Array.isArray(examPlan.questions)
        ) {
          totalTopics = examPlan.questions.length;
          topicsWithQuestions = examPlan.questions.filter(
            (topic: any) =>
              topic.question_id !== null && topic.question_id !== undefined,
          ).length;

          progressPercentage =
            totalTopics > 0
              ? Math.round((topicsWithQuestions / totalTopics) * 100)
              : 0;
        } else {
          // Fallback: exam_plans not yet available during initial generation phase
          // Use conservative estimate of 10% to indicate generation has started
          progressPercentage = 10;
          totalTopics = exam.total_questions || 0;
          topicsWithQuestions = Math.max(1, Math.round((exam.total_questions || 0) * 0.1));
          
          logger.warn('Fallback progress calculation: exam_plans missing during QUESTIONS_GENERATING', {
            exam_id,
            total_questions: exam.total_questions,
            fallback_progress: progressPercentage,
          });
        }
      } catch (error) {
        // If exam_plans fetch fails (timeout or error), use conservative fallback
        progressPercentage = 10;
        totalTopics = exam.total_questions || 0;
        topicsWithQuestions = Math.max(1, Math.round((exam.total_questions || 0) * 0.1));
        
        logger.warn('Exam plans fetch error, using fallback calculation', {
          exam_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          fallback_progress: progressPercentage,
        });
      }
    }

    // Calculate estimated time remaining based on progress rate
    let estimatedSecondsRemaining = 0;
    if (
      exam.exam_status === 'QUESTIONS_GENERATING' &&
      progressPercentage > 0 &&
      progressPercentage < 100 &&
      exam.started_at
    ) {
      const elapsedMs = Date.now() - new Date(exam.started_at).getTime();
      const elapsedSeconds = elapsedMs / 1000;
      const progressRate = progressPercentage / elapsedSeconds;
      const remainingPercent = 100 - progressPercentage;
      estimatedSecondsRemaining = Math.round(remainingPercent / progressRate);
    }

    // [LIVE-STATUS] Query complete
    const queryDurationMs = Date.now() - queryStart;
    logger.info(`[LIVE-STATUS] QUERY_COMPLETE`, {
      exam_id,
      user_id,
      exam_status: exam.exam_status,
      progress_percentage: progressPercentage,
      topics_with_questions: topicsWithQuestions,
      total_topics: totalTopics,
      query_duration_ms: queryDurationMs,
      timestamp_ms: Date.now(),
      structuredData: true,
    });

    // Return live status data
    res.status(200).json({
      success: true,
      data: {
        exam_id,
        exam_status: exam.exam_status,
        progress_percentage: progressPercentage,
        topics_with_questions: topicsWithQuestions,
        total_topics: totalTopics,
        total_questions: exam.total_questions,
        estimated_seconds_remaining:
          estimatedSecondsRemaining > 0 ? estimatedSecondsRemaining : 0,
        is_complete: exam.exam_status === 'READY',
        query_duration_ms: queryDurationMs,
        timestamp_ms: Date.now(),
      },
    });
  } catch (error) {
    logger.error(`Error fetching exam live status for exam:`, {
      error: error instanceof Error ? error.message : String(error),
      exam_id: req.params.exam_id,
      user_id: req.params.user_id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch exam live status.',
    });
  }
};

export default handler;
