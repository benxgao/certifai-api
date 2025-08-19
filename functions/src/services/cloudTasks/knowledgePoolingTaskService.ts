import { BaseCloudTaskService } from './baseCloudTaskService';
import logger from '../firebase/logger';

/**
 * Interface for knowledge pooling task payload
 */
export interface KnowledgePoolingTaskPayload {
  exam_id: string;
  user_id: string;
  force_regenerate?: boolean;
  trigger_source: 'exam_submission' | 'manual_request';
  submitted_at: string;
  cert_id: number;
  certification_name: string;
}

/**
 * Knowledge Pooling Cloud Task Service
 * Handles creating cloud tasks for knowledge pooling generation after exam submission
 */
export class KnowledgePoolingTaskService extends BaseCloudTaskService {
  private static instance: KnowledgePoolingTaskService;

  public static getInstance(): KnowledgePoolingTaskService {
    if (!KnowledgePoolingTaskService.instance) {
      KnowledgePoolingTaskService.instance = new KnowledgePoolingTaskService();
    }
    return KnowledgePoolingTaskService.instance;
  }

  protected getQueueName(): string {
    return 'knowledge-pooling-queue';
  }

  protected getTaskEndpoint(): string {
    return `${process.env.GCP_TASKS_HOST}/delegators/tasks/knowledge-pooling`;
  }

  /**
   * Creates a cloud task for knowledge pooling generation
   * @param payload - Knowledge pooling task payload
   * @param delaySeconds - Optional delay in seconds (default: 5 to allow exam submission to complete)
   * @returns Task name if successful, undefined otherwise
   */
  public async createKnowledgePoolingTask(
    payload: KnowledgePoolingTaskPayload,
    delaySeconds: number = 5,
  ): Promise<string | undefined> {
    if (!this.validateEnvironment()) {
      return undefined;
    }

    logger.info('Creating knowledge pooling task', {
      exam_id: payload.exam_id,
      user_id: payload.user_id,
      cert_id: payload.cert_id,
      certification_name: payload.certification_name,
      trigger_source: payload.trigger_source,
      delay_seconds: delaySeconds,
      scheduled_time: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      structuredData: true,
    });

    return await this.createTask(payload, delaySeconds);
  }

  /**
   * Creates a knowledge pooling task triggered by exam submission
   * This runs silently in the background and does not block the submission workflow
   */
  public async createPostSubmissionTask(
    examId: string,
    userId: string,
    certId: number,
    certificationName: string,
  ): Promise<string | undefined> {
    const payload: KnowledgePoolingTaskPayload = {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      certification_name: certificationName,
      trigger_source: 'exam_submission',
      submitted_at: new Date().toISOString(),
      force_regenerate: false, // Use cache if available for post-submission
    };

    logger.info('Creating post-submission knowledge pooling task', {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      trigger_source: 'exam_submission',
      reason: 'silent_background_processing',
      structuredData: true,
    });

    // Use a 5-second delay to ensure exam submission has fully completed
    return await this.createKnowledgePoolingTask(payload, 5);
  }

  /**
   * Creates a knowledge pooling task for manual requests
   * This typically has no delay as it's user-initiated
   */
  public async createManualTask(
    examId: string,
    userId: string,
    certId: number,
    certificationName: string,
    forceRegenerate: boolean = false,
  ): Promise<string | undefined> {
    const payload: KnowledgePoolingTaskPayload = {
      exam_id: examId,
      user_id: userId,
      cert_id: certId,
      certification_name: certificationName,
      trigger_source: 'manual_request',
      submitted_at: new Date().toISOString(),
      force_regenerate: forceRegenerate,
    };

    logger.info('Creating manual knowledge pooling task', {
      exam_id: examId,
      user_id: userId,
      force_regenerate: forceRegenerate,
      trigger_source: 'manual_request',
      structuredData: true,
    });

    // No delay for manual requests
    return await this.createKnowledgePoolingTask(payload, 0);
  }
}
