/**
 * Knowledge Pooling REST API Endpoints
 *
 * GET /users/:user_id/certifications/:cert_id/knowledge-pooling - Get existing knowledge pooling data
 */

import { Request, Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import { getConsolidatedKnowledgePoolingFromFirestore } from '../../../../services/firestore/examKnowledgePoolingFirestoreService';

/**
 * GET /users/:user_id/certifications/:cert_id/knowledge-pooling
 *
 * Retrieve existing knowledge pooling data for a certification.
 * Returns consolidated insights from all exams under this certification.
 */
export const getKnowledgePooling = async (
  req: Request | CustomRequest,
  res: Response,
): Promise<void> => {
  try {
    const { user_id, cert_id } = req.params as { user_id: string; cert_id: string };
    const firebaseUserIdFromToken = (req as CustomRequest).firebase_user_info
      ?.uid;

    if (!user_id || !cert_id) {
      res.status(400).json({
        success: false,
        error: 'user_id and cert_id are required',
      });
      return;
    }

    if (!firebaseUserIdFromToken) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const certIdNum = parseInt(cert_id, 10);
    if (isNaN(certIdNum)) {
      res.status(400).json({
        success: false,
        error: 'cert_id must be a valid number',
      });
      return;
    }

    logger.info(
      `GET_KNOWLEDGE_POOLING_REQUEST: user_id=${user_id}, cert_id=${cert_id}`,
    );

    // Get existing knowledge pooling data from Firestore
    const knowledgePoolingData =
      await getConsolidatedKnowledgePoolingFromFirestore(user_id, certIdNum);

    if (!knowledgePoolingData) {
      logger.info(
        `GET_KNOWLEDGE_POOLING_NOT_FOUND: user_id=${user_id}, cert_id=${cert_id}`,
      );

      res.status(404).json({
        success: false,
        error: 'Knowledge pooling data not found',
        message:
          'No knowledge pooling data exists for this certification. Complete some exams and generate knowledge insights first.',
      });
      return;
    }

    logger.info(
      `GET_KNOWLEDGE_POOLING_SUCCESS: user_id=${user_id}, cert_id=${cert_id}`,
      {
        user_id,
        cert_id,
        certification: knowledgePoolingData.certification_name,
        total_insights: knowledgePoolingData.knowledge_insights.length,
        last_updated: knowledgePoolingData.last_updated,
      },
    );

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
      message: 'Knowledge pooling data retrieved successfully',
    });
  } catch (error) {
    logger.error(
      `GET_KNOWLEDGE_POOLING_ERROR: user_id=${req.params.user_id}, cert_id=${req.params.cert_id}`,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    );

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve knowledge pooling data',
    });
  }
};
