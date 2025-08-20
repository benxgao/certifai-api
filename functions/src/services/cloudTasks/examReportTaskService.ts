import { BaseCloudTaskService } from './baseCloudTaskService';
import logger from '../firebase/logger';

/**
 * Interface for exam report generation task payload
 */
export interface ExamReportTaskPayload {
  exam_id: string;
  user_id: string;
  cert_id: number;
  certification_name: string;
  trigger_source: 'exam_submission' | 'manual_request' | 'retry';
  submitted_at: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Exam Report Generation Cloud Task Service
 * Handles creating cloud tasks for exam report generation after exam submission
 */
export class ExamReportTaskService extends BaseCloudTaskService {
  private static instance: ExamReportTaskService;

  public static getInstance(): ExamReportTaskService {
    if (!ExamReportTaskService.instance) {
      ExamReportTaskService.instance = new ExamReportTaskService();
    }
    return ExamReportTaskService.instance;
  }

  protected getQueueName(): string {
    return 'exam-reports-queue';
  }

  protected getTaskEndpoint(): string {
    return `${process.env.GCP_TASKS_HOST}/delegators/tasks/exam-report`;
  }

  /**
   * Creates a cloud task for exam report generation
   * @param payload - Exam report task payload
   * @param delaySeconds - Optional delay in seconds (default: 2 to prevent race conditions)
   * @returns Task name if successful, undefined otherwise
   */
  public async createExamReportTask(
    payload: ExamReportTaskPayload,
    delaySeconds: number = 2,
  ): Promise<string | undefined> {
    if (!this.validateEnvironment()) {
      return undefined;
    }

    logger.info('Creating exam report generation task', {
      exam_id: payload.exam_id,
      user_id: payload.user_id,
      cert_id: payload.cert_id,
      certification_name: payload.certification_name,
      trigger_source: payload.trigger_source,
      priority: payload.priority || 'normal',
      delay_seconds: delaySeconds,
      structuredData: true,
    });

    return await this.createTask(payload, delaySeconds);
  }

  /**
   * Creates an exam report task triggered by exam submission
   * This runs in the background and does not block the submission workflow
   */
  public async createPostSubmissionReportTask(
    examId: string,
    userId: string,
    certId: number,
    certificationName: string,
  ): Promise<string | undefined> {
    const payload: ExamReportTaskPayload = {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      certification_name: certificationName,
      trigger_source: 'exam_submission',
      submitted_at: new Date().toISOString(),
      priority: 'normal',
    };

    logger.info('Creating post-submission exam report task', {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      certification_name: certificationName,
      trigger_source: 'exam_submission',
      reason: 'background_report_generation',
      structuredData: true,
    });

    // Use a 3-second delay to ensure exam submission has fully completed
    return await this.createExamReportTask(payload, 3);
  }

  /**
   * Creates a high-priority exam report task for manual requests
   */
  public async createManualReportTask(
    examId: string,
    userId: string,
    certId: number,
    certificationName: string,
  ): Promise<string | undefined> {
    const payload: ExamReportTaskPayload = {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      certification_name: certificationName,
      trigger_source: 'manual_request',
      submitted_at: new Date().toISOString(),
      priority: 'high',
    };

    logger.info('Creating manual exam report task', {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      certification_name: certificationName,
      trigger_source: 'manual_request',
      priority: 'high',
      structuredData: true,
    });

    // No delay for manual requests - process immediately
    return await this.createExamReportTask(payload, 0);
  }

  /**
   * Creates a retry exam report task for failed attempts
   */
  public async createRetryReportTask(
    examId: string,
    userId: string,
    certId: number,
    certificationName: string,
    retryDelaySeconds: number = 10,
  ): Promise<string | undefined> {
    const payload: ExamReportTaskPayload = {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      certification_name: certificationName,
      trigger_source: 'retry',
      submitted_at: new Date().toISOString(),
      priority: 'normal',
    };

    logger.info('Creating retry exam report task', {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      certification_name: certificationName,
      trigger_source: 'retry',
      retry_delay_seconds: retryDelaySeconds,
      structuredData: true,
    });

    return await this.createExamReportTask(payload, retryDelaySeconds);
  }
}
