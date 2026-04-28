import logger from './firebase/logger';
import { ExamGenerationLogger } from './exam-generation-logger';
import { ExamGenerationMetrics } from './exam-generation-metrics';
import prismaInstance, { ExamStatus } from './prisma';

/**
 * System health monitoring utilities for exam generation
 * Implements health checks for queue, database, and AI services
 */
export class ExamGenerationHealthCheck {
  /**
   * Perform comprehensive system health check
   */
  static async performHealthCheck(): Promise<{
    timestamp: string;
    overall_status: string;
    queue_status: string;
    database_status: string;
    ai_service_status: string;
    active_generations: number;
    error_rate_percent: number;
    performance_metrics: any;
    alerts: string[];
  }> {
    const timestamp = new Date().toISOString();

    try {
      // Check each component
      const [
        queueStatus,
        databaseStatus,
        aiServiceStatus,
        activeGenerations,
        errorRate,
        performanceMetrics,
      ] = await Promise.all([
        this.checkQueueHealth(),
        this.checkDatabaseHealth(),
        this.checkAIServiceHealth(),
        this.getActiveGenerationsCount(),
        this.calculateErrorRate(),
        ExamGenerationMetrics.calculatePerformanceMetrics(15),
      ]);

      const alerts = ExamGenerationMetrics.getActiveAlerts();
      const overallStatus = this.calculateOverallHealth({
        queue_status: queueStatus,
        database_status: databaseStatus,
        ai_service_status: aiServiceStatus,
        error_rate_percent: errorRate,
      });

      const healthReport = {
        timestamp,
        overall_status: overallStatus,
        queue_status: queueStatus,
        database_status: databaseStatus,
        ai_service_status: aiServiceStatus,
        active_generations: activeGenerations,
        error_rate_percent: errorRate,
        performance_metrics: performanceMetrics,
        alerts,
      };

      // Log the health check results
      ExamGenerationLogger.logSystemHealth({
        queue_status: queueStatus,
        database_status: databaseStatus,
        ai_service_status: aiServiceStatus,
        active_generations: activeGenerations,
        error_rate_percent: errorRate,
      });

      logger.info('SYSTEM_HEALTH_CHECK_COMPLETE', healthReport);

      return healthReport;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('SYSTEM_HEALTH_CHECK_FAILED', {
        timestamp,
        error: errorMessage,
      });

      return {
        timestamp,
        overall_status: 'error',
        queue_status: 'unknown',
        database_status: 'unknown',
        ai_service_status: 'unknown',
        active_generations: 0,
        error_rate_percent: 100,
        performance_metrics: {},
        alerts: [`Health check failed: ${errorMessage}`],
      };
    }
  }

  /**
   * Check Cloud Tasks queue health
   */
  static async checkQueueHealth(): Promise<string> {
    try {
      // In a real implementation, you would check:
      // 1. Queue connectivity
      // 2. Queue depth
      // 3. Processing rate
      // 4. Failed task count

      const successRate = ExamGenerationMetrics.calculateSuccessRate(
        15,
        'batch',
      );

      // Log queue metrics
      ExamGenerationLogger.logQueueHealth({
        queue_name: 'exam-questions-queue',
        pending_tasks: 0, // Would get from actual queue
        rate_limit: '10/s',
        max_concurrent: 10,
      });

      if (successRate.rate >= 95) {
        return 'healthy';
      } else if (successRate.rate >= 80) {
        return 'degraded';
      } else {
        return 'unhealthy';
      }
    } catch (error) {
      logger.error('QUEUE_HEALTH_CHECK_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 'error';
    }
  }

  /**
   * Check database health
   */
  static async checkDatabaseHealth(): Promise<string> {
    try {
      const startTime = Date.now();

      // Perform a simple database query to check connectivity and performance
      await prismaInstance.examAttempt.findFirst({
        where: {
          exam_status: ExamStatus.QUESTIONS_GENERATING,
        },
        select: {
          exam_id: true,
        },
      });

      const queryDuration = Date.now() - startTime;

      // Log database performance
      logger.info('DATABASE_HEALTH_CHECK', {
        query_duration_ms: queryDuration,
        status: queryDuration < 1000 ? 'healthy' : 'slow',
      });

      if (queryDuration < 500) {
        return 'healthy';
      } else if (queryDuration < 2000) {
        return 'degraded';
      } else {
        return 'unhealthy';
      }
    } catch (error) {
      logger.error('DATABASE_HEALTH_CHECK_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 'error';
    }
  }

  /**
   * Check AI service health
   */
  static async checkAIServiceHealth(): Promise<string> {
    try {
      const aiSuccessRate = ExamGenerationMetrics.calculateSuccessRate(
        15,
        'ai',
      );
      const performanceMetrics =
        ExamGenerationMetrics.calculatePerformanceMetrics(15);

      logger.info('AI_SERVICE_HEALTH_CHECK', {
        success_rate: aiSuccessRate.rate,
        avg_response_time_ms: performanceMetrics.avgBatchDuration,
        total_calls: aiSuccessRate.total,
      });

      if (
        aiSuccessRate.rate >= 98 &&
        performanceMetrics.avgBatchDuration < 30000
      ) {
        return 'healthy';
      } else if (
        aiSuccessRate.rate >= 90 &&
        performanceMetrics.avgBatchDuration < 60000
      ) {
        return 'degraded';
      } else {
        return 'unhealthy';
      }
    } catch (error) {
      logger.error('AI_SERVICE_HEALTH_CHECK_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 'error';
    }
  }

  /**
   * Get count of active exam generations
   */
  static async getActiveGenerationsCount(): Promise<number> {
    try {
      const activeExams = await prismaInstance.examAttempt.count({
        where: {
          exam_status: ExamStatus.QUESTIONS_GENERATING,
        },
      });

      logger.info('ACTIVE_GENERATIONS_COUNT', {
        count: activeExams,
      });

      return activeExams;
    } catch (error) {
      logger.error('ACTIVE_GENERATIONS_COUNT_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Calculate overall error rate
   */
  static calculateErrorRate(): number {
    const batchMetrics = ExamGenerationMetrics.calculateSuccessRate(
      15,
      'batch',
    );
    return 100 - batchMetrics.rate;
  }

  /**
   * Calculate overall system health
   */
  private static calculateOverallHealth(data: {
    queue_status: string;
    database_status: string;
    ai_service_status: string;
    error_rate_percent: number;
  }): string {
    const services = [
      data.queue_status,
      data.database_status,
      data.ai_service_status,
    ];
    const healthyServices = services.filter(
      (status) => status === 'healthy',
    ).length;
    const errorServices = services.filter(
      (status) => status === 'error',
    ).length;

    if (errorServices > 0) {
      return 'error';
    } else if (healthyServices === 3 && data.error_rate_percent < 5) {
      return 'healthy';
    } else if (healthyServices >= 2 && data.error_rate_percent < 20) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * Force complete a stuck exam (emergency procedure)
   */
  static async forceCompleteExam(
    examId: string,
    reason: string,
    adminUserId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    exam_id: string;
    previous_status: string;
    questions_count: number;
  }> {
    try {
      // Log the force completion start
      logger.warn('FORCE_COMPLETE_EXAM_START', {
        exam_id: examId,
        reason,
        admin_user: adminUserId || 'system',
        timestamp: new Date().toISOString(),
      });

      // Get current exam status
      const exam = await prismaInstance.examAttempt.findUnique({
        where: { exam_id: examId },
        select: {
          exam_status: true,
          total_questions: true,
        },
      });

      if (!exam) {
        return {
          success: false,
          message: 'Exam not found',
          exam_id: examId,
          previous_status: 'unknown',
          questions_count: 0,
        };
      }

      // Count existing questions
      const questionCount = await prismaInstance.quizQuestion.count({
        where: { generated_from: examId },
      });

      // Update exam status to ready with force completion flag
      await prismaInstance.examAttempt.update({
        where: { exam_id: examId },
        data: {
          exam_status: ExamStatus.READY,
          // Note: You may need to add these fields to your schema
          // force_completed: true,
          // force_complete_reason: reason,
          // force_complete_timestamp: new Date(),
        },
      });

      // Log the completion
      ExamGenerationLogger.logExamComplete({
        exam_id: examId,
        total_questions_generated: questionCount,
        total_questions_associated: questionCount,
        total_batches: Math.ceil(questionCount / 10), // Estimate
        status: 'FORCE_COMPLETED',
      });

      logger.info('FORCE_COMPLETE_EXAM_SUCCESS', {
        exam_id: examId,
        previous_status: exam.exam_status,
        questions_found: questionCount,
        reason,
        admin_user: adminUserId || 'system',
      });

      return {
        success: true,
        message: `Exam ${examId} force completed with ${questionCount} questions`,
        exam_id: examId,
        previous_status: exam.exam_status,
        questions_count: questionCount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('FORCE_COMPLETE_EXAM_FAILED', {
        exam_id: examId,
        error: errorMessage,
        reason,
        admin_user: adminUserId || 'system',
      });

      return {
        success: false,
        message: `Failed to force complete exam: ${errorMessage}`,
        exam_id: examId,
        previous_status: 'unknown',
        questions_count: 0,
      };
    }
  }

  /**
   * Get stuck exams (exams that have been generating for too long)
   */
  static async getStuckExams(thresholdMinutes: number = 30): Promise<
    Array<{
      exam_id: string;
      user_id: string;
      cert_id: number;
      started_at: Date;
      minutes_stuck: number;
    }>
  > {
    try {
      const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      const stuckExams = await prismaInstance.examAttempt.findMany({
        where: {
          exam_status: ExamStatus.QUESTIONS_GENERATING,
          started_at: {
            lt: thresholdTime,
          },
        },
        select: {
          exam_id: true,
          user_id: true,
          cert_id: true,
          started_at: true,
        },
      });

      const result = stuckExams.map((exam) => ({
        ...exam,
        minutes_stuck: Math.round(
          (Date.now() - exam.started_at.getTime()) / (1000 * 60),
        ),
      }));

      if (result.length > 0) {
        logger.warn('STUCK_EXAMS_DETECTED', {
          count: result.length,
          threshold_minutes: thresholdMinutes,
          exams: result.map((e) => ({
            exam_id: e.exam_id,
            minutes_stuck: e.minutes_stuck,
          })),
        });
      }

      return result;
    } catch (error) {
      logger.error('GET_STUCK_EXAMS_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Auto-fail stuck exams that have been generating for more than the threshold
   * This enables graceful handling and allows users to delete failed exams
   */
  static async autoFailStuckExams(thresholdMinutes: number = 10): Promise<{
    success: boolean;
    failedCount: number;
    failedExams: Array<{
      exam_id: string;
      user_id: string;
      cert_id: number;
      minutes_stuck: number;
    }>;
    errors: string[];
  }> {
    try {
      logger.info('AUTO_FAIL_STUCK_EXAMS_START', {
        threshold_minutes: thresholdMinutes,
        timestamp: new Date().toISOString(),
      });

      // Get stuck exams using our existing method
      const stuckExams = await this.getStuckExams(thresholdMinutes);

      if (stuckExams.length === 0) {
        logger.info('AUTO_FAIL_STUCK_EXAMS_COMPLETE', {
          message: 'No stuck exams found',
          threshold_minutes: thresholdMinutes,
        });

        return {
          success: true,
          failedCount: 0,
          failedExams: [],
          errors: [],
        };
      }

      const failedExams: Array<{
        exam_id: string;
        user_id: string;
        cert_id: number;
        minutes_stuck: number;
      }> = [];
      const errors: string[] = [];

      // Process each stuck exam
      for (const exam of stuckExams) {
        try {
          // Update exam status to QUESTION_GENERATION_FAILED
          await prismaInstance.examAttempt.update({
            where: { exam_id: exam.exam_id },
            data: {
              exam_status: ExamStatus.QUESTION_GENERATION_FAILED,
            },
          });

          failedExams.push({
            exam_id: exam.exam_id,
            user_id: exam.user_id,
            cert_id: exam.cert_id,
            minutes_stuck: exam.minutes_stuck,
          });

          logger.warn('EXAM_AUTO_FAILED', {
            exam_id: exam.exam_id,
            user_id: exam.user_id,
            cert_id: exam.cert_id,
            minutes_stuck: exam.minutes_stuck,
            reason: 'Stuck in QUESTIONS_GENERATING state',
            threshold_minutes: thresholdMinutes,
          });

          // Log the failure for exam generation tracking
          ExamGenerationLogger.logExamFailure({
            exam_id: exam.exam_id,
            reason: 'Auto-failed due to stuck generation',
            error: `Exam was stuck in ${ExamStatus.QUESTIONS_GENERATING} state for ${exam.minutes_stuck} minutes, exceeding ${thresholdMinutes} minute threshold`,
            batch_number: 0, // Unknown batch since it was stuck
            questions_generated_so_far: 0, // No questions generated for stuck exam
          });
        } catch (examError) {
          const errorMessage =
            examError instanceof Error ? examError.message : 'Unknown error';
          const error = `Failed to auto-fail exam ${exam.exam_id}: ${errorMessage}`;
          errors.push(error);

          logger.error('EXAM_AUTO_FAIL_ERROR', {
            exam_id: exam.exam_id,
            error: errorMessage,
            minutes_stuck: exam.minutes_stuck,
          });
        }
      }

      const result = {
        success: errors.length === 0,
        failedCount: failedExams.length,
        failedExams,
        errors,
      };

      logger.info('AUTO_FAIL_STUCK_EXAMS_COMPLETE', {
        total_stuck_found: stuckExams.length,
        successfully_failed: failedExams.length,
        errors_count: errors.length,
        threshold_minutes: thresholdMinutes,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('AUTO_FAIL_STUCK_EXAMS_FAILED', {
        error: errorMessage,
        threshold_minutes: thresholdMinutes,
      });

      return {
        success: false,
        failedCount: 0,
        failedExams: [],
        errors: [`System error during auto-fail process: ${errorMessage}`],
      };
    }
  }

  /**
   * Generate comprehensive metrics report
   */
  static async generateMetricsReport(): Promise<any> {
    try {
      const metricsReport = ExamGenerationMetrics.generateMetricsReport(60);
      const healthReport = await this.performHealthCheck();
      const stuckExams = await this.getStuckExams(30);

      const report = {
        timestamp: new Date().toISOString(),
        system_health: healthReport,
        metrics: metricsReport,
        stuck_exams: stuckExams,
        recommendations: this.generateRecommendations(
          healthReport,
          metricsReport,
          stuckExams,
        ),
      };

      logger.info('COMPREHENSIVE_METRICS_REPORT', report);
      return report;
    } catch (error) {
      logger.error('METRICS_REPORT_GENERATION_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate recommendations based on current system state
   */
  private static generateRecommendations(
    healthReport: any,
    metricsReport: any,
    stuckExams: any[],
  ): string[] {
    const recommendations: string[] = [];

    // Health-based recommendations
    if (healthReport.overall_status === 'unhealthy') {
      recommendations.push(
        'URGENT: System is unhealthy. Investigate immediately.',
      );
    }

    if (healthReport.error_rate_percent > 20) {
      recommendations.push(
        'High error rate detected. Check AI service and database connectivity.',
      );
    }

    // Performance recommendations
    if (metricsReport.performanceMetrics.avgBatchDuration > 60000) {
      recommendations.push(
        'Slow batch processing detected. Consider scaling resources.',
      );
    }

    if (metricsReport.performanceMetrics.avgMemoryUsage > 100) {
      recommendations.push(
        'High memory usage detected. Check for memory leaks.',
      );
    }

    // Stuck exams recommendations
    if (stuckExams.length > 0) {
      recommendations.push(
        `${stuckExams.length} stuck exams detected. Consider force completion.`,
      );
    }

    // Cost recommendations
    if (metricsReport.performanceMetrics.avgCostPerBatch > 2.0) {
      recommendations.push(
        'High cost per batch detected. Review AI usage optimization.',
      );
    }

    return recommendations;
  }
}

export default ExamGenerationHealthCheck;
