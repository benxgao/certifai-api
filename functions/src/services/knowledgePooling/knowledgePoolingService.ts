/**
 * Knowledge Pooling Service
 *
 * This service handles all the business logic for knowledge pooling generation,
 * including data fetching, validation, caching, AI generation orchestration, and storage.
 *
 * The API layer only needs to call this service with the required parameters.
 */

import logger from '../firebase/logger';
import { knowledgePoolingGeneratorPromise } from '../genkit/knowledgePoolingGnerator';
import { getIncorrectAnswersForExam } from '../data/examKnowledgePoolingDataService';
import {
  saveExamKnowledgePoolingToFirestore,
  hasRecentExamKnowledgePooling,
  getConsolidatedKnowledgePoolingFromFirestore,
  type ExamKnowledgePoolingData,
  type ConsolidatedKnowledgePoolingData,
} from '../firestore/examKnowledgePoolingFirestoreService';

export interface KnowledgePoolingRequest {
  exam_id: string;
  api_user_id: string;
  force_regenerate?: boolean;
}

export interface KnowledgePoolingResult {
  success: boolean;
  data?: ConsolidatedKnowledgePoolingData | null;
  message: string;
  cached?: boolean;
  analysis_needed?: boolean;
  metadata?: {
    exam_id: string;
    certification_name: string;
    total_incorrect_answers: number;
    topics_analyzed: number;
    total_exams_analyzed: number;
    generated_at: string;
    processing_time_ms: number;
  };
  error?: string;
  details?: string;
}

export class KnowledgePoolingService {
  /**
   * Checks if cached knowledge pooling data exists and is recent
   */
  private static async checkCachedData(
    api_user_id: string,
    cert_id: number,
    exam_id: string,
    cacheDays: number = 7,
  ): Promise<ConsolidatedKnowledgePoolingData | null> {
    try {
      const hasRecentData = await hasRecentExamKnowledgePooling(
        api_user_id,
        cert_id,
        exam_id,
        cacheDays,
      );

      if (hasRecentData) {
        const existingData = await getConsolidatedKnowledgePoolingFromFirestore(
          api_user_id,
          cert_id,
        );

        if (existingData) {
          logger.info('Returning cached knowledge pooling data', {
            api_user_id,
            exam_id,
            cert_id,
          });
          return existingData;
        }
      }

      return null;
    } catch (error) {
      logger.warn('Error checking cached data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        api_user_id,
        exam_id,
        cert_id,
      });
      return null;
    }
  }

  /**
   * Generates knowledge pooling insights using AI
   */
  private static async generateKnowledgeInsights(
    api_user_id: string,
    exam_id: string,
    cert_id: number,
    certification_name: string,
    incorrectAnswers: any[],
  ): Promise<any> {
    try {
      logger.info('Generating knowledge pooling with AI', {
        api_user_id,
        exam_id,
        cert_id,
        incorrect_answers_count: incorrectAnswers.length,
      });

      const knowledgePoolingGenerator = await knowledgePoolingGeneratorPromise;
      const result = await knowledgePoolingGenerator({
        user_id: api_user_id,
        exam_id,
        cert_id,
        certification_name,
        incorrect_answers_data: incorrectAnswers,
      });

      if (!result || !result.knowledge_insights) {
        throw new Error('AI generation returned invalid results');
      }

      return result;
    } catch (error) {
      logger.error('Knowledge pooling AI generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        api_user_id,
        exam_id,
        cert_id,
      });
      throw new Error('Failed to generate knowledge pooling insights');
    }
  }

  /**
   * Saves generated knowledge pooling data to storage
   */
  private static async saveKnowledgePoolingData(
    api_user_id: string,
    examKnowledgeData: ExamKnowledgePoolingData,
  ): Promise<ConsolidatedKnowledgePoolingData> {
    try {
      const consolidatedData = await saveExamKnowledgePoolingToFirestore(
        api_user_id,
        examKnowledgeData,
      );

      logger.info('Knowledge pooling data saved successfully', {
        api_user_id,
        exam_id: examKnowledgeData.exam_id,
        topics_analyzed: examKnowledgeData.topics_analyzed,
        total_exams_analyzed: consolidatedData.total_exams_analyzed,
      });

      return consolidatedData;
    } catch (error) {
      logger.error('Failed to save knowledge pooling data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        api_user_id,
        exam_id: examKnowledgeData.exam_id,
      });
      throw new Error('Failed to save knowledge pooling data');
    }
  }

  /**
   * Main service method to generate knowledge pooling
   * This handles the complete workflow from validation to storage
   */
  public static async generateKnowledgePooling(
    request: KnowledgePoolingRequest,
  ): Promise<KnowledgePoolingResult> {
    const startTime = Date.now();
    const { exam_id, api_user_id, force_regenerate = false } = request;

    try {
      logger.info('Knowledge pooling service request started', {
        exam_id,
        api_user_id,
        force_regenerate,
        request_timestamp: new Date().toISOString(),
      });

      // Step 1: Get exam data and validate access
      const examData = await getIncorrectAnswersForExam(exam_id, api_user_id);

      if (!examData.examInfo) {
        return {
          success: false,
          message: 'Exam not found',
          error: 'Exam not found or not accessible for this user',
        };
      }

      const { examInfo, incorrectAnswers } = examData;
      const cert_id = examInfo.cert_id;

      // Step 2: Check for cached data (unless force regeneration)
      if (!force_regenerate) {
        const cachedData = await this.checkCachedData(
          api_user_id,
          cert_id,
          exam_id,
          7, // 7 days cache
        );

        if (cachedData) {
          const processingTime = Date.now() - startTime;
          return {
            success: true,
            data: cachedData,
            message: 'Knowledge pooling retrieved from cache',
            cached: true,
            metadata: {
              exam_id,
              certification_name: examInfo.certification_name,
              total_incorrect_answers: incorrectAnswers.length,
              topics_analyzed: cachedData.total_topics_analyzed,
              total_exams_analyzed: cachedData.total_exams_analyzed,
              generated_at: cachedData.last_updated,
              processing_time_ms: processingTime,
            },
          };
        }
      }

      // Step 3: Handle case with no incorrect answers
      if (incorrectAnswers.length === 0) {
        const processingTime = Date.now() - startTime;
        return {
          success: true,
          data: null,
          message:
            'No incorrect answers found for this exam. Great job on the perfect score!',
          analysis_needed: false,
          metadata: {
            exam_id,
            certification_name: examInfo.certification_name,
            total_incorrect_answers: 0,
            topics_analyzed: 0,
            total_exams_analyzed: 0,
            generated_at: new Date().toISOString(),
            processing_time_ms: processingTime,
          },
        };
      }

      // Step 5: Generate AI insights
      const aiResult = await this.generateKnowledgeInsights(
        api_user_id,
        exam_id,
        cert_id,
        examInfo.certification_name,
        incorrectAnswers,
      );

      // Step 6: Prepare data for storage
      const examKnowledgeData: ExamKnowledgePoolingData = {
        exam_id,
        knowledge_insights: aiResult.knowledge_insights,
        summary: aiResult.summary,
        generated_at: new Date().toISOString(),
        cert_id,
        certification_name: examInfo.certification_name,
        total_incorrect_answers: incorrectAnswers.length,
        topics_analyzed: aiResult.knowledge_insights.length,
      };

      // Step 7: Save to storage
      const consolidatedData = await this.saveKnowledgePoolingData(
        api_user_id,
        examKnowledgeData,
      );

      // Step 8: Return successful result
      const processingTime = Date.now() - startTime;

      logger.info('Knowledge pooling service completed successfully', {
        exam_id,
        api_user_id,
        topics_analyzed: examKnowledgeData.topics_analyzed,
        total_incorrect_answers: examKnowledgeData.total_incorrect_answers,
        total_exams_analyzed: consolidatedData.total_exams_analyzed,
        processing_time_ms: processingTime,
      });

      return {
        success: true,
        data: consolidatedData,
        message: 'Knowledge pooling generated successfully',
        metadata: {
          exam_id,
          certification_name: examInfo.certification_name,
          total_incorrect_answers: incorrectAnswers.length,
          topics_analyzed: examKnowledgeData.topics_analyzed,
          total_exams_analyzed: consolidatedData.total_exams_analyzed,
          generated_at: examKnowledgeData.generated_at,
          processing_time_ms: processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error('Knowledge pooling service error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        exam_id,
        api_user_id,
        processing_time_ms: processingTime,
      });

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        success: false,
        message: 'Knowledge pooling generation failed',
        error: 'Failed to generate knowledge pooling',
        details: errorMessage,
        metadata: {
          exam_id,
          certification_name: 'Unknown',
          total_incorrect_answers: 0,
          topics_analyzed: 0,
          total_exams_analyzed: 0,
          generated_at: new Date().toISOString(),
          processing_time_ms: processingTime,
        },
      };
    }
  }
}
