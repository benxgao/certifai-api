import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { getRtdbValue } from '../../../../services/firebase/rtdb';
import prismaInstance, { ExamStatus } from '../../../../services/prisma';

/**
 * DEPRECATED: Use `/api/users/{user_id}/exams/{exam_id}/live-status` instead
 *
 * This endpoint is deprecated as of 2026-04-22.
 * Migrate to getExamLiveStatus.ts which provides real-time status without Redis cache.
 *
 * Get exam generation progress by counting topics with question_id in RTDB
 * This provides a simple, accurate way to track progress percentage
 * Works for exams in QUESTIONS_GENERATING state, and returns completed progress for ready exams
 *
 * @deprecated Use /api/users/{user_id}/exams/{exam_id}/live-status instead
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

    logger.info(
      `Fetching exam progress for exam ${exam_id}, user: ${user_id} (checking exam status first)`,
    );

    // First, check the exam status to ensure it's currently generating
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id },
      select: {
        exam_status: true,
        user_id: true,
      },
    });

    if (!exam) {
      res.status(404).json({
        success: false,
        error: 'Exam not found.',
      });
      return;
    }

    // Verify the exam belongs to the requesting user
    if (exam.user_id !== user_id) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Exam does not belong to this user.',
      });
      return;
    }

    // Handle different exam statuses appropriately
    if (exam.exam_status === ExamStatus.READY) {
      // Exam is ready - return completed progress
      logger.info(
        `EXAM_PROGRESS_READY: Returning completed progress for exam ${exam_id} with status ${exam.exam_status}`,
        {
          exam_id,
          user_id,
          exam_status: exam.exam_status,
          timestamp: new Date().toISOString(),
          structuredData: true,
        },
      );

      const progressData = {
        exam_id,
        total_topics: 0,
        topics_with_questions: 0,
        topics_remaining: 0,
        progress_percentage: 100,
        status: 'complete',
        estimated_time_remaining_seconds: 0,
        created_at: Math.floor(Date.now() / 1000),
        last_updated: Math.floor(Date.now() / 1000),
      };

      res.status(200).json({
        success: true,
        data: progressData,
      });
      return;
    } else if (exam.exam_status !== ExamStatus.QUESTIONS_GENERATING) {
      logger.warn(
        `EXAM_PROGRESS_INVALID_STATUS: Rejected progress request for exam ${exam_id} with status ${exam.exam_status}`,
        {
          exam_id,
          user_id,
          exam_status: exam.exam_status,
          timestamp: new Date().toISOString(),
          structuredData: true,
        },
      );

      res.status(400).json({
        success: false,
        error: `Cannot get progress for exam with status: ${exam.exam_status}. Progress is only available for exams in QUESTIONS_GENERATING state.`,
        exam_status: exam.exam_status,
      });
      return;
    }

    // Get exam plan from RTDB
    const examPlanPath = `exam_plans/${exam_id}`;
    const examPlan = await getRtdbValue(examPlanPath);

    if (
      !examPlan ||
      !examPlan.questions ||
      !Array.isArray(examPlan.questions)
    ) {
      res.status(404).json({
        success: false,
        error: 'Exam plan not found or exam generation not started.',
      });
      return;
    }

    // Count topics with and without question_id
    const totalTopics = examPlan.questions.length;
    const topicsWithQuestions = examPlan.questions.filter(
      (topic: any) =>
        topic.question_id !== null && topic.question_id !== undefined,
    ).length;
    const topicsRemaining = totalTopics - topicsWithQuestions;

    // Calculate progress percentage
    const progressPercentage =
      totalTopics > 0
        ? Math.round((topicsWithQuestions / totalTopics) * 100)
        : 0;

    // Determine status
    let status = 'generating';
    if (progressPercentage >= 100) {
      status = 'complete';
    } else if (progressPercentage === 0) {
      status = 'starting';
    }

    // Calculate estimated time remaining (simple heuristic)
    const createdAt = examPlan.created_at;
    const currentTime = Math.floor(Date.now() / 1000);
    const elapsedSeconds = createdAt ? currentTime - createdAt : 0;

    let estimatedTimeRemainingSeconds = 0;
    if (topicsWithQuestions > 0 && topicsRemaining > 0 && elapsedSeconds > 0) {
      // Estimate based on average time per topic so far
      const avgTimePerTopic = elapsedSeconds / topicsWithQuestions;
      estimatedTimeRemainingSeconds = Math.round(
        avgTimePerTopic * topicsRemaining,
      );
    }

    const progressData = {
      exam_id,
      total_topics: totalTopics,
      topics_with_questions: topicsWithQuestions,
      topics_remaining: topicsRemaining,
      progress_percentage: progressPercentage,
      status,
      estimated_time_remaining_seconds: estimatedTimeRemainingSeconds,
      created_at: createdAt,
      last_updated: currentTime,
    };

    logger.info(
      `EXAM_PROGRESS_SUCCESS: Valid progress request for exam ${exam_id} (status: ${exam.exam_status}):`,
      {
        exam_id,
        exam_status: exam.exam_status,
        progress_percentage: progressPercentage,
        topics_with_questions: topicsWithQuestions,
        total_topics: totalTopics,
        status,
        structuredData: true,
      },
    );

    res.status(200).json({
      success: true,
      data: progressData,
    });
  } catch (error) {
    logger.error('Error in getExamProgress handler:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
