/**
 * Generate Knowledge Pooling API Endpoint
 *
 * POST /users/:user_id/certifications/:cert_id/knowledge-pooling
 *
 * This endpoint provides frontend consumers with the ability to generate
 * knowledge pooling insights for a specific exam. It works exactly like the
 * /api/ai/knowledge-pooling endpoint but provides a user-friendly REST API
 * interface that matches other user endpoints.
 *
 * Features:
 * - Accepts exam_id and forceGenerate in request body
 * - Uses the same KnowledgePoolingService as the internal API
 * - Follows the same authentication and validation patterns as other user endpoints
 * - Provides comprehensive error handling and logging
 * - Returns consolidated knowledge pooling data
 */

import { Request, Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import {
  KnowledgePoolingService,
  type KnowledgePoolingRequest,
} from '../../../../services/knowledgePooling/knowledgePoolingService';
import { getConsolidatedKnowledgePoolingFromFirestore } from '../../../../services/firestore/examKnowledgePoolingFirestoreService';

/**
 * POST /users/:user_id/certifications/:cert_id/knowledge-pooling
 *
 * Generates knowledge pooling insights for a specific exam. This endpoint works
 * exactly like /api/ai/knowledge-pooling but provides a user-friendly REST interface.
 *
 * Request body should include:
 * - exam_id (string, required): ID of the exam to analyze
 * - forceGenerate (boolean, optional): Force regeneration even if recent data exists
 */
export const forceGenerateKnowledgePooling = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  const startTime = Date.now();

  try {
    const { user_id, cert_id } = req.params as { user_id: string; cert_id: string };
    const { exam_id, forceGenerate = true } = req.body;
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    // Validate required parameters
    if (!user_id || !cert_id) {
      res.status(400).json({
        success: false,
        error: 'user_id and cert_id are required',
      });
      return;
    }

    // Validate required request body fields
    if (!exam_id || typeof exam_id !== 'string') {
      res.status(400).json({
        success: false,
        error: 'exam_id is required and must be a string',
        details: 'Please provide a valid exam_id in the request body',
      });
      return;
    }

    // Validate authentication
    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Validate cert_id is a valid number
    const certIdNum = parseInt(cert_id, 10);
    if (isNaN(certIdNum)) {
      res.status(400).json({
        success: false,
        error: 'cert_id must be a valid number',
      });
      return;
    }

    logger.info('Knowledge pooling generation request received', {
      user_id,
      cert_id: certIdNum,
      exam_id,
      forceGenerate,
      firebase_user_id: firebaseUserIdFromToken,
      request_timestamp: new Date().toISOString(),
    });

    // Prepare service request - same as /api/ai/knowledge-pooling
    const serviceRequest: KnowledgePoolingRequest = {
      exam_id,
      api_user_id: user_id,
      force_regenerate: forceGenerate,
    };

    // Delegate to the knowledge pooling service
    // This uses the same service as /api/ai/knowledge-pooling
    const result = await KnowledgePoolingService.generateKnowledgePooling(
      serviceRequest,
    );

    const processingTime = Date.now() - startTime;

    if (!result.success) {
      // Map service errors to appropriate HTTP status codes
      let statusCode = 500;
      if (result.error === 'User not found') {
        statusCode = 404;
      } else if (result.error === 'Forbidden') {
        statusCode = 403;
      } else if (
        result.error === 'Exam not found or not accessible for this user'
      ) {
        statusCode = 404;
      }

      logger.warn('Knowledge pooling generation failed', {
        user_id,
        cert_id: certIdNum,
        exam_id,
        error: result.error,
        details: result.details,
        status_code: statusCode,
        processing_time_ms: processingTime,
      });

      res.status(statusCode).json({
        success: false,
        error: result.error,
        details: result.details,
        metadata: {
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // After successful generation, retrieve the consolidated knowledge pooling data
    // This provides the same response format as the GET knowledge pooling endpoint
    const knowledgePoolingData =
      await getConsolidatedKnowledgePoolingFromFirestore(user_id, certIdNum);

    if (!knowledgePoolingData) {
      logger.error(
        'Generated knowledge pooling but failed to retrieve consolidated data',
        {
          user_id,
          cert_id: certIdNum,
          exam_id,
          processing_time_ms: processingTime,
        },
      );

      res.status(500).json({
        success: false,
        error: 'Generation completed but failed to retrieve data',
        message:
          'Knowledge pooling was generated successfully but there was an error retrieving the consolidated data.',
        metadata: {
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    logger.info('Knowledge pooling generation completed successfully', {
      user_id,
      cert_id: certIdNum,
      exam_id,
      total_insights: knowledgePoolingData.knowledge_insights.length,
      certification_name: knowledgePoolingData.certification_name,
      processing_time_ms: processingTime,
      analysis_needed: result.analysis_needed,
    });

    // Return the consolidated data in the same format as GET knowledge pooling endpoint
    res.status(200).json({
      success: true,
      data: {
        cert_id: certIdNum,
        user_id,
        knowledge_insights: knowledgePoolingData.knowledge_insights,
        certification_name: knowledgePoolingData.certification_name,
        last_updated: knowledgePoolingData.last_updated,
        stats: {
          total_insights: knowledgePoolingData.knowledge_insights.length,
          unique_exams: [
            ...new Set(
              knowledgePoolingData.knowledge_insights.map(
                (insight) => insight.exam_id,
              ),
            ),
          ].length,
          unique_topics: [
            ...new Set(
              knowledgePoolingData.knowledge_insights.map(
                (insight) => insight.topic,
              ),
            ),
          ].length,
        },
      },
      message: 'Knowledge pooling generated successfully',
      generated: true,
      metadata: {
        exam_id_used: exam_id,
        force_regenerate: forceGenerate,
        processing_time_ms: processingTime,
        analysis_needed: result.analysis_needed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Knowledge pooling generation handler error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      user_id: req.params?.user_id,
      cert_id: req.params?.cert_id,
      exam_id: req.body?.exam_id,
      processing_time_ms: processingTime,
    });

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    res.status(500).json({
      success: false,
      error: 'Failed to generate knowledge pooling',
      details: errorMessage,
      metadata: {
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
      },
    });
  }
};
