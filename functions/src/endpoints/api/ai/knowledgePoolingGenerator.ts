/**
 * Knowledge Pooling Generator API Handler
 *
 * Simplified API handler that delegates all business logic to the KnowledgePoolingService.
 * This handler only focuses on request validation, authentication, and response formatting.
 *
 * Request Body:
 * - exam_id (string, required): ID of the specific exam to analyze
 * - api_user_id (string, required): Internal API user identifier
 * - force_regenerate (boolean, optional): Force regeneration even if recent data exists
 *
 * Response:
 * - success (boolean): Whether the operation was successful
 * - data (object): Generated knowledge pooling content and metadata
 * - message (string): Descriptive message about the operation
 * - metadata (object): Additional information about the operation
 */

import { Response } from 'express';
import logger from '../../../services/firebase/logger';
import { AuthenticatedRequest } from '../../../types/express';
import {
  KnowledgePoolingService,
  type KnowledgePoolingRequest,
} from '../../../services/knowledgePooling/knowledgePoolingService';

export const knowledgePoolingGeneratorHandler = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const startTime = Date.now();

  try {
    const { exam_id, api_user_id, force_regenerate = false } = req.body as {
      exam_id: string;
      api_user_id: string;
      force_regenerate?: boolean;
    };

    // Get Firebase user ID from authenticated token
    const firebaseUserIdFromToken = req.firebase_user_info?.uid;

    logger.info('Knowledge pooling API request received', {
      exam_id,
      api_user_id,
      force_regenerate,
      firebase_user_id: firebaseUserIdFromToken,
      request_timestamp: new Date().toISOString(),
    });

    // Validate required fields with detailed error messages
    if (!exam_id || typeof exam_id !== 'string') {
      const error = 'exam_id is required and must be a string';
      logger.warn('API validation failed', {
        error,
        provided_exam_id: exam_id,
      });
      res.status(400).json({
        success: false,
        error,
        details: 'Please provide a valid exam_id parameter',
      });
      return;
    }

    if (!api_user_id) {
      const error = 'api_user_id is required';
      logger.warn('API validation failed', {
        error,
        provided_api_user_id: api_user_id,
      });
      res.status(400).json({
        success: false,
        error,
        details: 'Please provide a valid api_user_id parameter',
      });
      return;
    }

    // For API calls, we require authentication
    if (!firebaseUserIdFromToken) {
      logger.warn('API authentication failed', { exam_id, api_user_id });
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        details: 'Please provide a valid Firebase authentication token',
      });
      return;
    }

    // Prepare service request (simplified without firebase_user_id verification)
    const serviceRequest: KnowledgePoolingRequest = {
      exam_id,
      api_user_id,
      force_regenerate,
    };

    // Delegate to service layer
    const result = await KnowledgePoolingService.generateKnowledgePooling(
      serviceRequest,
    );

    // Handle service response
    const processingTime = Date.now() - startTime;

    // Add API processing time to metadata if it exists
    if (result.metadata) {
      result.metadata.processing_time_ms = processingTime;
    }

    if (result.success) {
      logger.info('Knowledge pooling API request completed successfully', {
        exam_id,
        api_user_id,
        cached: result.cached,
        analysis_needed: result.analysis_needed,
        processing_time_ms: processingTime,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
        ...(result.cached && { cached: true }),
        ...(result.analysis_needed !== undefined && {
          analysis_needed: result.analysis_needed,
        }),
        metadata: result.metadata,
      });
    } else {
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

      logger.warn('Knowledge pooling API request failed', {
        exam_id,
        api_user_id,
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
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Knowledge pooling API handler error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      exam_id: req.body?.exam_id,
      api_user_id: req.body?.api_user_id,
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
