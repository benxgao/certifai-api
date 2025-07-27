import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { getRtdbValue } from '../../../../services/firebase/rtdb';

/**
 * Get exam generation progress by counting topics with question_id in RTDB
 * This provides a simple, accurate way to track progress percentage
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

    logger.info(`Fetching exam progress for exam ${exam_id}, user: ${user_id}`);

    // Get exam plan from RTDB
    const examPlanPath = `exam_plans/${exam_id}`;
    const examPlan = await getRtdbValue(examPlanPath);

    if (!examPlan || !examPlan.questions || !Array.isArray(examPlan.questions)) {
      res.status(404).json({
        success: false,
        error: 'Exam plan not found or exam generation not started.',
      });
      return;
    }

    // Count topics with and without question_id
    const totalTopics = examPlan.questions.length;
    const topicsWithQuestions = examPlan.questions.filter(
      (topic: any) => topic.question_id !== null && topic.question_id !== undefined
    ).length;
    const topicsRemaining = totalTopics - topicsWithQuestions;

    // Calculate progress percentage
    const progressPercentage = totalTopics > 0 
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
      estimatedTimeRemainingSeconds = Math.round(avgTimePerTopic * topicsRemaining);
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

    logger.info(`Exam progress calculated for ${exam_id}:`, {
      exam_id,
      progress_percentage: progressPercentage,
      topics_with_questions: topicsWithQuestions,
      total_topics: totalTopics,
      status,
      structuredData: true,
    });

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
