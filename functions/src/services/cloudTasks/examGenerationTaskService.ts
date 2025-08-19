import { BaseCloudTaskService } from './baseCloudTaskService';
import logger from '../firebase/logger';

/**
 * Interface for exam generation task payload
 */
export interface ExamGenerationTaskPayload {
  exam_id: string;
  cert_id: number;
  certification_name: string;
  batch_number: number;
  total_batches: number;
  custom_prompt_text?: string;
  questions_per_batch: number;
  last_exam_report?: string;
}

/**
 * Exam Generation Cloud Task Service
 * Handles creating cloud tasks for exam question generation
 */
export class ExamGenerationTaskService extends BaseCloudTaskService {
  private static instance: ExamGenerationTaskService;

  public static getInstance(): ExamGenerationTaskService {
    if (!ExamGenerationTaskService.instance) {
      ExamGenerationTaskService.instance = new ExamGenerationTaskService();
    }
    return ExamGenerationTaskService.instance;
  }

  protected getQueueName(): string {
    return 'exam-questions-queue';
  }

  protected getTaskEndpoint(): string {
    return `${process.env.GCP_TASKS_HOST}/delegators/tasks/take`;
  }

  /**
   * Creates a cloud task for exam generation
   * @param payload - Exam generation task payload
   * @param delaySeconds - Optional delay in seconds (default: 1 to prevent race conditions)
   * @returns Task name if successful, undefined otherwise
   */
  public async createExamGenerationTask(
    payload: ExamGenerationTaskPayload,
    delaySeconds: number = 1,
  ): Promise<string | undefined> {
    if (!this.validateEnvironment()) {
      return undefined;
    }

    logger.info('Creating exam generation task', {
      exam_id: payload.exam_id,
      batch_number: payload.batch_number,
      total_batches: payload.total_batches,
      delay_seconds: delaySeconds,
      structuredData: true,
    });

    return await this.createTask(payload, delaySeconds);
  }

  /**
   * Creates the first batch task for exam generation
   * Includes special handling for RTDB race condition prevention
   */
  public async createFirstBatchTask(
    payload: ExamGenerationTaskPayload,
  ): Promise<string | undefined> {
    logger.info('Creating first batch task with race condition prevention', {
      exam_id: payload.exam_id,
      scheduled_time: new Date(Date.now() + 1000).toISOString(),
      current_time: new Date().toISOString(),
      reason: 'prevent_rtdb_race_condition',
      structuredData: true,
    });

    return await this.createExamGenerationTask(payload, 1);
  }

  /**
   * Creates a next batch task for continuing exam generation
   */
  public async createNextBatchTask(
    payload: ExamGenerationTaskPayload,
  ): Promise<string | undefined> {
    logger.info('Creating next batch task', {
      exam_id: payload.exam_id,
      current_batch: payload.batch_number,
      next_batch: payload.batch_number + 1,
      structuredData: true,
    });

    return await this.createExamGenerationTask(payload, 1);
  }
}
