/**
 * Exam Report Generator API Handler
 *
 * Generates personalized performance reports for completed exams by analyzing user performance data.
 * The report identifies topics where the user performed well and areas that need improvement.
 * This handler includes full database integration and can be used both as an API endpoint
 * and as a service function for exam submission processing.
 *
 * Generated Report Format Example:
 * The exam_report field stores both human-readable text and structured JSON data:
 * ```
 * "Your performance analysis shows excellent understanding of IAM and Security with 100% accuracy...
 *
 * --- STRUCTURED_DATA ---
 * {
 *   "exam_id": "exam_abc123",
 *   "overall_score": 75,
 *   "topic_performance": [
 *     {
 *       "topic": "IAM and Security",
 *       "accuracy_rate": 1.0,
 *       "performance_category": "strong"
 *     }
 *   ]
 * }"
 * ```
 *
 * Request Body:
 * - exam_id (string, required): The ID of the completed exam to analyze
 *
 * Response:
 * - success (boolean): Whether the operation was successful
 * - data (object): Contains the generated report and metadata
 *
 * This endpoint will:
 * 1. Validate that the exam is completed and belongs to the authenticated user
 * 2. Analyze user performance by topic from ExamUserAnswer data
 * 3. Generate both structured data and AI-powered text report
 * 4. Update the examAttempt.exam_report field with combined format
 * 5. Return the report for immediate use
 */

import { Request, Response } from 'express';
import logger from '../../../services/firebase/logger';
import prismaInstance from '../../../services/prisma';
import { CustomRequest } from '../../../types';
import {
  StructuredExamReport,
  TopicPerformance,
  getPerformanceCategory,
  getDifficultyLabel,
} from '../../../types/examReport';

/**
 * Helper function to convert difficulty string to number
 */
const getDifficultyLevel = (difficulty: string | null | undefined): number => {
  if (!difficulty) return 1;
  const level = difficulty.toLowerCase();
  if (level.includes('easy') || level.includes('beginner')) return 1;
  if (level.includes('medium') || level.includes('intermediate')) return 2;
  if (
    level.includes('hard') ||
    level.includes('difficult') ||
    level.includes('advanced')
  )
    return 3;
  if (level.includes('expert') || level.includes('master')) return 4;
  return 2; // default to medium
};

/**
 * Core service function for generating exam reports
 * Can be used both by API endpoint and internal service calls
 */
export const generateExamReport = async (
  exam_id: string,
  firebaseUserIdFromToken?: string,
  skipAuthCheck: boolean = false,
) => {
  try {
    logger.info(
      `EXAM_REPORT_INIT: Starting report generation for exam_id=${exam_id}`,
    );

    // 1. Fetch and validate the exam
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id },
      include: {
        user: {
          select: {
            user_id: true,
            firebase_user_id: true,
          },
        },
        certification: {
          select: {
            cert_id: true,
            name: true,
          },
        },
        answers: {
          include: {
            quizQuestion: {
              select: {
                exam_topic: true,
                difficulty: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new Error('Exam not found');
    }

    // 2. Verify user ownership (skip if internal service call)
    if (
      !skipAuthCheck &&
      exam.user.firebase_user_id !== firebaseUserIdFromToken
    ) {
      throw new Error(
        'Access denied: You can only generate reports for your own exams',
      );
    }

    // 3. Validate exam is completed
    if (!exam.submitted_at || exam.score === null) {
      throw new Error('Report can only be generated for completed exams');
    }

    // 4. Check if report already exists
    if (exam.exam_report) {
      logger.info(
        `EXAM_REPORT_EXISTS: Report already exists for exam_id=${exam_id}`,
      );
      return {
        exam_id,
        report: exam.exam_report,
        already_existed: true,
        generated_at: exam.submitted_at,
        performance_summary: {
          overall_score: exam.score,
          total_questions: exam.answers.length,
          correct_answers: exam.answers.filter(
            (answer) => answer.is_correct === true,
          ).length,
        },
      };
    }

    // 5. Analyze performance data by topic with difficulty levels
    const topicPerformanceMap = new Map<
      string,
      { correct: number; total: number; difficulties: number[] }
    >();

    exam.answers.forEach((answer) => {
      const topic = answer.quizQuestion.exam_topic || 'Uncategorized';
      const difficulty = getDifficultyLevel(answer.quizQuestion.difficulty);

      if (!topicPerformanceMap.has(topic)) {
        topicPerformanceMap.set(topic, {
          correct: 0,
          total: 0,
          difficulties: [],
        });
      }

      const topicData = topicPerformanceMap.get(topic)!;
      topicData.total += 1;
      topicData.difficulties.push(difficulty);

      if (answer.is_correct === true) {
        topicData.correct += 1;
      }
    });

    // Convert to array format for AI processing with difficulty analysis
    const performanceData = Array.from(topicPerformanceMap.entries()).map(
      ([topic, data]) => {
        const averageDifficulty =
          data.difficulties.length > 0
            ? data.difficulties.reduce((sum, d) => sum + d, 0) /
              data.difficulties.length
            : 1;

        return {
          topic,
          correct_answers: data.correct,
          total_attempts: data.total,
          accuracy_rate: data.total > 0 ? data.correct / data.total : 0,
          current_difficulty_level: Math.round(averageDifficulty),
          average_difficulty_attempted: averageDifficulty,
        };
      },
    );

    // Filter out topics with no attempts (shouldn't happen but safety check)
    const validPerformanceData = performanceData.filter(
      (topic) => topic.total_attempts > 0,
    );

    if (validPerformanceData.length === 0) {
      throw new Error('No valid performance data found for report generation');
    }

    // 6. Calculate overall metrics
    const totalQuestions = exam.answers.length;
    const correctAnswers = exam.answers.filter(
      (answer) => answer.is_correct === true,
    ).length;
    const overallScore = exam.score; // Use the stored score

    logger.info(
      `EXAM_REPORT_ANALYSIS: exam_id=${exam_id}, topics=${validPerformanceData.length}, score=${overallScore}%`,
    );

    // 7. Create structured performance data
    const structuredTopicPerformance: TopicPerformance[] =
      validPerformanceData.map((topic) => ({
        topic: topic.topic,
        correct_answers: topic.correct_answers,
        total_attempts: topic.total_attempts,
        accuracy_rate: topic.accuracy_rate,
        difficulty_level: getDifficultyLabel(topic.current_difficulty_level),
        performance_category: getPerformanceCategory(topic.accuracy_rate),
      }));

    // 8. Generate the AI report
    const { getExamReportGeneratorFlow } = await import(
      '../../../services/genkit/examReportGenerator.js'
    );
    const examReportGenerator = await getExamReportGeneratorFlow();

    const reportInput = {
      user_id: exam.user.user_id,
      exam_id,
      certification_name: exam.certification.name,
      performance_data: validPerformanceData,
      overall_score: overallScore,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
    };

    const reportResult = await examReportGenerator(reportInput);
    const generatedReport = reportResult.report;

    // 9. Create structured exam report
    const structuredReport: StructuredExamReport = {
      exam_id,
      overall_score: overallScore,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
      topic_performance: structuredTopicPerformance,
      generated_at: new Date().toISOString(),
      text_summary: generatedReport,
    };

    // 10. Store combined report (structured data + text for backward compatibility)
    const combinedReport = `${generatedReport}\n\n--- STRUCTURED_DATA ---\n${JSON.stringify(
      structuredReport,
      null,
      2,
    )}`;

    // 11. Update the exam with the combined report
    await prismaInstance.examAttempt.update({
      where: { exam_id },
      data: {
        exam_report: combinedReport,
      },
    });

    logger.info(
      `EXAM_REPORT_SUCCESS: Generated and saved report for exam_id=${exam_id}`,
      {
        exam_id,
        user_id: exam.user.user_id,
        certification: exam.certification.name,
        report_length: combinedReport.length,
        topics_analyzed: validPerformanceData.length,
        overall_score: overallScore,
        structuredData: true,
        hasStructuredFormat: true,
      },
    );

    // 12. Return the generated report data
    return {
      exam_id,
      report: combinedReport,
      structured_data: structuredReport,
      performance_summary: {
        overall_score: overallScore,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        topics_analyzed: validPerformanceData.length,
        topic_breakdown: validPerformanceData.map((topic) => ({
          topic: topic.topic,
          accuracy: Math.round(topic.accuracy_rate * 100),
          questions: topic.total_attempts,
        })),
      },
      generated_at: new Date().toISOString(),
      difficulty_adjustments: reportResult.difficulty_adjustments,
    };
  } catch (error) {
    logger.error(
      `EXAM_REPORT_SERVICE_ERROR: Error in exam report generation for exam_id=${exam_id}:`,
      error as any,
    );
    throw error;
  }
};

/**
 * Express.js API handler that wraps the core service function
 */
export const examReportGeneratorHandler = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { exam_id } = req.body;

    // Get Firebase user ID if available (for authenticated requests)
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    // Validate required fields
    if (!exam_id) {
      res.status(400).json({
        success: false,
        error: 'exam_id is required',
      });
      return;
    }

    // For API calls, we require authentication
    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Generate the report using the core service
    const reportData = await generateExamReport(
      exam_id,
      firebaseUserIdFromToken,
    );

    // Return success response
    res.status(200).json({
      success: true,
      data: reportData,
      message: reportData.already_existed
        ? 'Report already exists for this exam'
        : 'Exam report generated successfully',
    });
  } catch (error) {
    logger.error(
      'EXAM_REPORT_API_ERROR: Error in exam report API handler:',
      error as any,
    );

    const errorMessage = (error as Error).message;

    if (errorMessage.includes('not found')) {
      res.status(404).json({
        success: false,
        error: errorMessage,
      });
      return;
    }

    if (errorMessage.includes('Access denied')) {
      res.status(403).json({
        success: false,
        error: errorMessage,
      });
      return;
    }

    if (
      errorMessage.includes('completed exams') ||
      errorMessage.includes('No valid performance')
    ) {
      res.status(400).json({
        success: false,
        error: errorMessage,
      });
      return;
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Internal server error during report generation',
    });
  }
};
