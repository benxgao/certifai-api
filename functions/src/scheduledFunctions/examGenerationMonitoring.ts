import { onSchedule } from 'firebase-functions/v2/scheduler';
import logger from '../services/firebase/logger';
// import { ExamGenerationMetrics } from '../services/exam-generation-metrics';
import { ExamGenerationHealthCheck } from '../services/exam-generation-health-check';

/**
 * Scheduled function for automated exam generation metrics collection
 * Runs every 15 minutes to collect system metrics and generate alerts
 */
// export const collectExamGenerationMetrics = onSchedule(
//   {
//     schedule: 'every 15 minutes',
//     timeZone: 'UTC',
//   },
//   async () => {
//     const startTime = Date.now();
//     const executionId = `metrics-${Date.now()}-${Math.random()
//       .toString(36)
//       .substr(2, 9)}`;

//     try {
//       logger.info('SCHEDULED_METRICS_COLLECTION_START', {
//         timestamp: new Date().toISOString(),
//         execution_id: executionId,
//       });

//       // Collect metrics
//       ExamGenerationMetrics.collectMetrics();

//       // Perform health check
//       const healthReport = await ExamGenerationHealthCheck.performHealthCheck();

//       // Check for stuck exams
//       const stuckExams = await ExamGenerationHealthCheck.getStuckExams(30);

//       // Generate alerts if needed
//       const alerts = ExamGenerationMetrics.getActiveAlerts();

//       if (alerts.length > 0) {
//         logger.warn('AUTOMATED_ALERTS_GENERATED', {
//           alerts,
//           count: alerts.length,
//           timestamp: new Date().toISOString(),
//         });
//       }

//       // Log critical issues
//       if (
//         healthReport.overall_status === 'unhealthy' ||
//         healthReport.overall_status === 'error'
//       ) {
//         logger.error('CRITICAL_SYSTEM_HEALTH_ALERT', {
//           overall_status: healthReport.overall_status,
//           queue_status: healthReport.queue_status,
//           database_status: healthReport.database_status,
//           ai_service_status: healthReport.ai_service_status,
//           error_rate: healthReport.error_rate_percent,
//           timestamp: new Date().toISOString(),
//         });
//       }

//       // Log stuck exams alert
//       if (stuckExams.length > 0) {
//         logger.warn('STUCK_EXAMS_ALERT', {
//           count: stuckExams.length,
//           exams: stuckExams.map((e) => ({
//             exam_id: e.exam_id,
//             minutes_stuck: e.minutes_stuck,
//           })),
//           timestamp: new Date().toISOString(),
//         });
//       }

//       const duration = Date.now() - startTime;

//       logger.info('SCHEDULED_METRICS_COLLECTION_COMPLETE', {
//         duration_ms: duration,
//         health_status: healthReport.overall_status,
//         active_alerts: alerts.length,
//         stuck_exams: stuckExams.length,
//         timestamp: new Date().toISOString(),
//         execution_id: executionId,
//       });
//     } catch (error) {
//       const duration = Date.now() - startTime;

//       logger.error('SCHEDULED_METRICS_COLLECTION_FAILED', {
//         error: error instanceof Error ? error.message : 'Unknown error',
//         duration_ms: duration,
//         timestamp: new Date().toISOString(),
//         execution_id: executionId,
//       });
//     }
//   },
// );

/**
 * Scheduled function for daily comprehensive metrics report
 * Runs every day at 00:00 UTC to generate detailed reports
 */
// export const dailyExamGenerationReport = onSchedule(
//   {
//     schedule: '0 0 * * *',
//     timeZone: 'UTC',
//   },
//   async () => {
//     const startTime = Date.now();
//     const executionId = `daily-${Date.now()}-${Math.random()
//       .toString(36)
//       .substr(2, 9)}`;

//     try {
//       logger.info('DAILY_METRICS_REPORT_START', {
//         timestamp: new Date().toISOString(),
//         execution_id: executionId,
//       });

//       // Generate comprehensive metrics report for the last 24 hours
//       const dailyReport =
//         await ExamGenerationHealthCheck.generateMetricsReport();

//       if (dailyReport) {
//         // Calculate daily statistics
//         const dailyStats = {
//           ...dailyReport,
//           report_type: 'daily',
//           period: '24_hours',
//         };

//         logger.info('DAILY_METRICS_REPORT_GENERATED', dailyStats);

//         // Check if any immediate action is needed
//         if (dailyStats.system_health.overall_status === 'unhealthy') {
//           logger.error('DAILY_CRITICAL_ALERT', {
//             message: 'System has been unhealthy in the last 24 hours',
//             health_report: dailyStats.system_health,
//             recommendations: dailyStats.recommendations,
//             timestamp: new Date().toISOString(),
//           });
//         }
//       }

//       const duration = Date.now() - startTime;

//       logger.info('DAILY_METRICS_REPORT_COMPLETE', {
//         duration_ms: duration,
//         timestamp: new Date().toISOString(),
//         execution_id: executionId,
//       });
//     } catch (error) {
//       const duration = Date.now() - startTime;

//       logger.error('DAILY_METRICS_REPORT_FAILED', {
//         error: error instanceof Error ? error.message : 'Unknown error',
//         duration_ms: duration,
//         timestamp: new Date().toISOString(),
//         execution_id: executionId,
//       });
//     }
//   },
// );

/**
 * Scheduled function for automated stuck exam cleanup
 * Runs every hour to check for exams stuck for more than 2 hours
 */
export const automatedStuckExamCleanup = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'UTC',
  },
  async () => {
    const startTime = Date.now();
    const executionId = `cleanup-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      logger.info('AUTOMATED_CLEANUP_START', {
        timestamp: new Date().toISOString(),
        execution_id: executionId,
      });

      // Check for exams stuck for more than 2 hours
      const stuckExams = await ExamGenerationHealthCheck.getStuckExams(120);

      if (stuckExams.length > 0) {
        logger.warn('AUTOMATED_CLEANUP_FOUND_STUCK_EXAMS', {
          count: stuckExams.length,
          exams: stuckExams.map((e) => ({
            exam_id: e.exam_id,
            minutes_stuck: e.minutes_stuck,
          })),
          timestamp: new Date().toISOString(),
        });

        // For now, just log the stuck exams for manual review
        // In the future, you might want to automatically force complete them
        for (const exam of stuckExams) {
          if (exam.minutes_stuck > 180) {
            // 3 hours
            logger.error('CRITICAL_STUCK_EXAM', {
              exam_id: exam.exam_id,
              minutes_stuck: exam.minutes_stuck,
              user_id: exam.user_id,
              cert_id: exam.cert_id,
              message:
                'Exam has been stuck for over 3 hours - manual intervention required',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      const duration = Date.now() - startTime;

      logger.info('AUTOMATED_CLEANUP_COMPLETE', {
        duration_ms: duration,
        stuck_exams_found: stuckExams.length,
        timestamp: new Date().toISOString(),
        execution_id: executionId,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('AUTOMATED_CLEANUP_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        execution_id: executionId,
      });
    }
  },
);

/**
 * Scheduled function for graceful handling of stuck exam generation
 * Runs every 5 minutes to auto-fail exams stuck for more than 10 minutes
 * This enables users to delete failed exams and improves user experience
 */
export const autoFailStuckExams = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
  },
  async () => {
    const startTime = Date.now();
    const executionId = `auto-fail-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    try {
      logger.info('AUTO_FAIL_STUCK_EXAMS_SCHEDULED_START', {
        timestamp: new Date().toISOString(),
        execution_id: executionId,
        threshold_minutes: 10,
      });

      // Auto-fail exams that have been stuck for more than 10 minutes
      const result = await ExamGenerationHealthCheck.autoFailStuckExams(10);

      if (result.failedCount > 0) {
        logger.warn('AUTO_FAIL_STUCK_EXAMS_PROCESSED', {
          successfully_failed: result.failedCount,
          failed_exams: result.failedExams,
          errors_count: result.errors.length,
          errors: result.errors,
          timestamp: new Date().toISOString(),
          execution_id: executionId,
        });
      } else {
        logger.info('AUTO_FAIL_STUCK_EXAMS_NO_ACTION_NEEDED', {
          message: 'No stuck exams found requiring auto-failure',
          timestamp: new Date().toISOString(),
          execution_id: executionId,
        });
      }

      const duration = Date.now() - startTime;

      logger.info('AUTO_FAIL_STUCK_EXAMS_SCHEDULED_COMPLETE', {
        duration_ms: duration,
        success: result.success,
        auto_failed_count: result.failedCount,
        errors_count: result.errors.length,
        timestamp: new Date().toISOString(),
        execution_id: executionId,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('AUTO_FAIL_STUCK_EXAMS_SCHEDULED_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        execution_id: executionId,
      });
    }
  },
);
