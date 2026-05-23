import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import { ExamReportTaskPayload } from '../../services/cloudTasks/examReportTaskService';
import { generateExamReport } from '../../endpoints/api/ai/examReportGenerator';

const isPermanentGenerationError = (errorMessage: string): boolean => {
  const lowerMessage = errorMessage.toLowerCase();

  return (
    lowerMessage.includes('exam not found') ||
    lowerMessage.includes('access denied') ||
    lowerMessage.includes('completed exams') ||
    lowerMessage.includes('no valid performance data')
  );
};

/**
 * Cloud Task Handler for Exam Report Generation
 * Processes exam report generation tasks in the background
 */
const handler = async (req: Request, res: Response) => {
  const taskStartTime = Date.now();
  let taskPayload: ExamReportTaskPayload | undefined;

  try {
    // Parse task payload
    taskPayload = req.body as ExamReportTaskPayload;

    if (!taskPayload || !taskPayload.exam_id) {
      logger.error('EXAM_REPORT_TASK_ERROR: Invalid task payload', {
        payload: taskPayload,
        structuredData: true,
      });
      res.status(400).json({
        success: false,
        error: 'Invalid task payload',
      });
      return;
    }

    const {
      exam_id,
      user_id,
      cert_id,
      certification_name,
      trigger_source,
      priority,
    } = taskPayload;

    logger.info(
      'EXAM_REPORT_TASK_START: Processing exam report generation task',
      {
        exam_id,
        user_id,
        cert_id,
        certification_name,
        trigger_source,
        priority: priority || 'normal',
        task_start_time: new Date(taskStartTime).toISOString(),
        structuredData: true,
      },
    );

    // Generate the exam report
    try {
      const reportResult = await generateExamReport(exam_id, undefined, true);

      if (reportResult && reportResult.report) {
        logger.info(
          'EXAM_REPORT_TASK_SUCCESS: Exam report generated successfully',
          {
            exam_id,
            user_id,
            cert_id,
            certification_name,
            trigger_source,
            priority: priority || 'normal',
            duration_ms: Date.now() - taskStartTime,
            report_length: reportResult.report.length,
            already_existed: reportResult.already_existed || false,
            generated_at: reportResult.generated_at,
            structuredData: true,
          },
        );

        res.status(200).json({
          success: true,
          data: {
            exam_id,
            report_generated: true,
            already_existed: reportResult.already_existed || false,
            duration_ms: Date.now() - taskStartTime,
          },
        });
      } else {
        logger.warn('EXAM_REPORT_TASK_WARNING: No report generated', {
          exam_id,
          user_id,
          cert_id,
          certification_name,
          trigger_source,
          duration_ms: Date.now() - taskStartTime,
          reason: 'no_report_returned',
          structuredData: true,
        });

        res.status(200).json({
          success: true,
          data: {
            exam_id,
            report_generated: false,
            reason: 'no_report_returned',
            duration_ms: Date.now() - taskStartTime,
          },
        });
      }
    } catch (reportError) {
      // Handle exam report generation errors
      const errorMessage =
        reportError instanceof Error ? reportError.message : 'Unknown error';
      const permanentFailure = isPermanentGenerationError(errorMessage);
      const responseStatus = permanentFailure ? 400 : 500;

      logger.error(
        'EXAM_REPORT_TASK_GENERATION_FAILED: Report generation failed',
        {
          exam_id,
          user_id,
          cert_id,
          certification_name,
          trigger_source,
          duration_ms: Date.now() - taskStartTime,
          error: errorMessage,
          error_type:
            reportError instanceof Error
              ? reportError.constructor.name
              : 'Unknown',
          permanent_failure: permanentFailure,
          response_status: responseStatus,
          structuredData: true,
        },
      );

      res.status(responseStatus).json({
        success: false,
        error: {
          exam_id,
          report_generated: false,
          reason: 'generation_failed',
          error_message: errorMessage,
          permanent_failure: permanentFailure,
          retriable: !permanentFailure,
          duration_ms: Date.now() - taskStartTime,
        },
      });
    }
  } catch (error) {
    // Handle general task processing errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const examId = taskPayload?.exam_id || 'unknown';

    logger.error('EXAM_REPORT_TASK_ERROR: Task processing failed', {
      exam_id: examId,
      duration_ms: Date.now() - taskStartTime,
      error: errorMessage,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      payload: taskPayload,
      structuredData: true,
    });

    res.status(500).json({
      success: false,
      error: 'Task processing failed',
      details: {
        exam_id: examId,
        error_message: errorMessage,
        duration_ms: Date.now() - taskStartTime,
      },
    });
  }
};

export default handler;
