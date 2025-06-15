/**
 *
 * Get an API key at https://aistudio.google.com/app/apikey
 *
 */

import { inspect } from 'util';
import { Request, Response } from 'express';
import logger from '../../../services/firebase/logger';
import { quizGeneratorPromise } from '../../../services/quizGenerator';

export const quizGeneratorHandler = async (req: Request, res: Response) => {
  try {
    // Ensure the AI instance and flow are initialized before proceeding
    const quizGenerator = await quizGeneratorPromise;

    const cert_name = req.body.cert_name || 'Google Cloud';
    const count = req.body.count || 3; // Default to 3 if not provided
    const exam_id = req.body.exam_id;

    if (!exam_id) {
      res.status(400).json({
        success: false,
        error: 'exam_id is required',
      });
      return;
    }

    logger.info(
      `Handling /genkit request with cert_name: ${cert_name}, count: ${count}, exam_id: ${exam_id}`,
    );

    const quizList = await quizGenerator({
      subject: cert_name,
      count,
      exam_id,
    });

    logger.info(
      `Genkit handler response for cert_name '${cert_name}', count '${count}', exam_id '${exam_id}': ${inspect(
        quizList,
      )}`,
      { structuredData: true },
    );

    res.status(200).json({
      success: true,
      data: quizList,
    });
  } catch (error) {
    logger.error('Error in quizGeneratorHandler:', error as any);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    if (errorMessage.includes('Could not initialize AI services')) {
      res.status(503).json({
        success: false,
        error: 'AI service initialization failed. Please try again later.',
      });
    } else {
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
};
