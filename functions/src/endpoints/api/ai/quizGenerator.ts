/**
 * Quiz Generator API Handler
 *
 * Generates quiz questions using AI based on certification topics.
 *
 * Request Body:
 * - cert_name (string, optional): Name of the certification (default: 'Google Cloud')
 * - examTopicList (string[], required): Array of specific topics to generate questions for (batch size limited)
 * - exam_id (string, required): Unique exam identifier
 * - customPromptText (string, optional): Additional prompt text to focus generation
 * - lastExamReport (string, optional): Previous exam report for adaptive difficulty adjustment
 *
 * Response:
 * - success (boolean): Whether the operation was successful
 * - data (array): Array of generated quiz questions with topics
 *
 * Note: The number of questions generated equals the length of examTopicList (typically limited by batch size)
 *
 * Get an API key at https://aistudio.google.com/app/apikey
 */

import { inspect } from 'util';
import { Request, Response } from 'express';
import logger from '../../../services/firebase/logger';
import { quizGeneratorPromise } from '../../../services/genkit/quizGenerator.js';

export const quizGeneratorHandler = async (req: Request, res: Response) => {
  try {
    // Ensure the AI instance and flow are initialized before proceeding
    const quizGenerator = await quizGeneratorPromise;

    const cert_name = req.body.cert_name || 'Google Cloud';
    const examTopicList = req.body.examTopicList;
    const exam_id = req.body.exam_id;
    const customPromptText = req.body.customPromptText;
    const lastExamReport = req.body.lastExamReport;

    if (!exam_id) {
      res.status(400).json({
        success: false,
        error: 'exam_id is required',
      });
      return;
    }

    // Validate examTopicList
    if (
      !examTopicList ||
      !Array.isArray(examTopicList) ||
      examTopicList.length === 0
    ) {
      res.status(400).json({
        success: false,
        error:
          'examTopicList is required and must be a non-empty array of strings',
      });
      return;
    }

    // Validate examTopicList contains only strings
    if (
      !examTopicList.every(
        (topic) => typeof topic === 'string' && topic.trim().length > 0,
      )
    ) {
      res.status(400).json({
        success: false,
        error: 'examTopicList must contain only non-empty strings',
      });
      return;
    }

    // Limit to maximum of 50 topics for performance
    if (examTopicList.length > 50) {
      res.status(400).json({
        success: false,
        error: 'examTopicList cannot contain more than 50 topics',
      });
      return;
    }

    // Clean up topics (trim whitespace)
    const cleanExamTopicList = examTopicList.map((topic) => topic.trim());

    logger.info(
      `Handling /genkit request with cert_name: ${cert_name}, topics: ${cleanExamTopicList.length}, exam_id: ${exam_id}`,
      {
        examTopicList: cleanExamTopicList,
        customPromptText: customPromptText?.substring(0, 100),
        hasLastExamReport: !!lastExamReport,
        adaptiveDifficultyEnabled: !!lastExamReport,
      },
    );

    const quizList = await quizGenerator({
      subject: cert_name,
      examTopicList: cleanExamTopicList,
      exam_id,
      customPromptText,
      lastExamReport,
    });

    logger.info(
      `Genkit handler response for cert_name '${cert_name}', topics: ${
        cleanExamTopicList.length
      }, exam_id '${exam_id}': ${inspect(quizList)}`,
      { structuredData: true },
    );

    res.status(200).json({
      success: true,
      data: quizList,
      meta: {
        topicsRequested: cleanExamTopicList.length,
        questionsGenerated: quizList.length,
      },
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
