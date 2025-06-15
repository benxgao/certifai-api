import { Response } from 'express';
import logger from '../../services/firebase/logger';
import { CustomRequest } from '../../types';
import { quizGeneratorPromise } from '../../services/quizGenerator';
import prismaInstance from '../../services/prisma';
import { createCloudTask } from '../../services/gcp/cloudTasks';

interface TaskPayload {
  exam_id: string;
  cert_id: number;
  certification_name: string;
  questions_to_generate: number;
  batch_number: number;
  total_batches: number;
}

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const payload: TaskPayload = req.body;
    const {
      exam_id,
      cert_id,
      certification_name,
      questions_to_generate,
      batch_number,
      total_batches,
    } = payload;

    logger.info(
      `Processing question generation task for exam ${exam_id}, batch ${batch_number}/${total_batches}, generating ${questions_to_generate} questions`,
    );

    // Verify exam exists and is in the correct state
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id },
    });

    if (!exam) {
      logger.error(`Exam ${exam_id} not found`);
      res.status(404).json({ success: false, error: 'Exam not found' });
      return;
    }

    if (exam.exam_status !== 'QUESTIONS_GENERATING') {
      logger.warn(
        `Exam ${exam_id} is not in QUESTIONS_GENERATING status, current status: ${exam.exam_status}`,
      );
      res.status(400).json({
        success: false,
        error: 'Exam is not in question generation state',
      });
      return;
    }

    try {
      // Generate questions using the quiz generator
      const quizGenerator = await quizGeneratorPromise;
      const generatedQuestions = await quizGenerator({
        subject: certification_name,
        count: questions_to_generate,
        exam_id,
      });

      logger.info(
        `Successfully generated ${generatedQuestions.length} questions for exam ${exam_id}, batch ${batch_number}`,
      );

      // Store questions in database
      for (const question of generatedQuestions) {
        const createdQuestion = await prismaInstance.quizQuestion.create({
          data: {
            cert_id,
            question_text: question.question,
            explanations: question.explanation,
            topic_id: null, // You might want to map this if you have topics
            difficulty: null, // You might want to set this
          },
        });

        // Create answer options
        for (let i = 0; i < question.choices.length; i++) {
          await prismaInstance.answerOption.create({
            data: {
              quiz_question_id: createdQuestion.quiz_question_id,
              option_text: question.choices[i],
              is_correct: i === question.answerIndex,
            },
          });
        }
      }

      // Check if this is the last batch
      if (batch_number >= total_batches) {
        // All batches completed, update exam status to READY
        await prismaInstance.examAttempt.update({
          where: { exam_id },
          data: { exam_status: 'READY' },
        });

        logger.info(
          `Question generation completed for exam ${exam_id}. Status updated to READY.`,
        );
      } else {
        // Create next batch task
        const nextBatchPayload = {
          exam_id,
          cert_id,
          certification_name,
          questions_to_generate: Math.min(
            10, // Questions per batch
            (exam.total_questions || 0) - batch_number * 10,
          ),
          batch_number: batch_number + 1,
          total_batches,
        };

        const nextTaskName = await createCloudTask(
          'exam-questions-queue',
          `${process.env.GCP_TASKS_HOST}/delegators/tasks/take`,
          nextBatchPayload,
        );

        if (!nextTaskName) {
          logger.error(
            `Failed to create next batch task for exam ${exam_id}, batch ${
              batch_number + 1
            }`,
          );
          // Update exam status to failed
          await prismaInstance.examAttempt.update({
            where: { exam_id },
            data: { exam_status: 'QUESTION_GENERATION_FAILED' },
          });
        } else {
          logger.info(
            `Created next batch task for exam ${exam_id}, batch ${
              batch_number + 1
            }/${total_batches}`,
          );
        }
      }

      res.status(200).json({
        success: true,
        message: `Successfully processed batch ${batch_number}/${total_batches}`,
        data: {
          exam_id,
          batch_number,
          total_batches,
          questions_generated: generatedQuestions.length,
          is_final_batch: batch_number >= total_batches,
        },
      });
    } catch (generationError) {
      logger.error(
        `Error generating questions for exam ${exam_id}, batch ${batch_number}:`,
        generationError as any,
      );

      // Update exam status to failed
      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: { exam_status: 'QUESTION_GENERATION_FAILED' },
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate questions',
      });
    }
  } catch (error) {
    logger.error('Error in task handler:', error as any);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
