import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import { KnowledgePoolingTaskPayload } from '../../services/cloudTasks/knowledgePoolingTaskService';
import { KnowledgePoolingService } from '../../services/knowledgePooling/knowledgePoolingService';

/**
 * Cloud Task handler for knowledge pooling generation
 * This runs silently in the background after exam submission
 */
const handler = async (req: Request, res: Response) => {
  let payload: KnowledgePoolingTaskPayload | null = null;

  try {
    payload = req.body;

    if (!payload || !payload.exam_id || !payload.user_id) {
      logger.error(
        'Invalid or missing payload in knowledge pooling task request',
        {
          payload_exists: !!payload,
          has_exam_id: !!(payload && payload.exam_id),
          has_user_id: !!(payload && payload.user_id),
          structuredData: true,
        },
      );
      res.status(400).json({
        success: false,
        error: 'Invalid or missing payload',
      });
      return;
    }

    const {
      exam_id,
      user_id,
      cert_id,
      certification_name,
      trigger_source,
      force_regenerate = false,
    } = payload;

    logger.info('Starting knowledge pooling task processing', {
      exam_id,
      user_id,
      cert_id,
      certification_name,
      trigger_source,
      force_regenerate,
      processing_start: new Date().toISOString(),
      structuredData: true,
    });

    // Generate knowledge pooling using the existing service (simplified without firebase auth)
    const result = await KnowledgePoolingService.generateKnowledgePooling({
      exam_id,
      api_user_id: user_id, // This is the api_user_id (internal UUID)
      force_regenerate,
    });

    if (result.success) {
      logger.info('Knowledge pooling task completed successfully', {
        exam_id,
        user_id,
        cert_id,
        trigger_source,
        analysis_needed: result.analysis_needed,
        processing_time_ms: result.metadata?.processing_time_ms || 0,
        structuredData: true,
      });

      res.status(200).json({
        success: true,
        message: 'Knowledge pooling generated successfully',
        data: {
          exam_id,
          analysis_needed: result.analysis_needed,
          certification_name: result.metadata?.certification_name,
        },
      });
    } else {
      logger.warn('Knowledge pooling task completed with no analysis needed', {
        exam_id,
        user_id,
        cert_id,
        trigger_source,
        message: result.message,
        error: result.error,
        structuredData: true,
      });

      res.status(200).json({
        success: true,
        message: result.message || 'No knowledge pooling analysis needed',
        data: {
          exam_id,
          analysis_needed: false,
          reason: result.error || 'No incorrect answers found',
        },
      });
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('Error in knowledge pooling task handler', {
      exam_id: payload?.exam_id,
      user_id: payload?.user_id,
      cert_id: payload?.cert_id,
      trigger_source: payload?.trigger_source,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      structuredData: true,
    });

    // For background tasks, we should return success even if processing fails
    // to prevent Cloud Tasks from retrying unnecessarily
    res.status(200).json({
      success: false,
      error: 'Knowledge pooling processing failed',
      message: 'Background task failed but will not retry',
      data: {
        exam_id: payload?.exam_id,
        failed_at: new Date().toISOString(),
        error: errorMessage,
      },
    });
  }
};

export default handler;
