import { Response } from 'express';
import logger from '../../services/firebase/logger';
import { CustomRequest } from '../../types';
import { quizGeneratorPromise } from '../../services/quizGenerator';
import prismaInstance, { ExamStatus } from '../../services/prisma';
import { createCloudTask } from '../../services/gcp/cloudTasks';
import {
  associateQuestionsWithExam,
  updateExamAfterQuestionAssociation,
} from '../../utils/examQuestionAssociation';

interface TaskPayload {
  exam_id: string;
  cert_id: number;
  certification_name: string;
  questions_to_generate: number;
  batch_number: number;
  total_batches: number;
  custom_prompt_text?: string;
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
      custom_prompt_text,
    } = payload;

    logger.info(
      `EXAM_BATCH_PROCESS: exam_id=${exam_id}, batch=${batch_number}/${total_batches}, questions=${questions_to_generate}`,
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

    if (exam.exam_status !== ExamStatus.QUESTIONS_GENERATING) {
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
        // MARKED collect topics in a batch and pass to the next batch, to get better topic distribution
        subject: certification_name,
        count: questions_to_generate,
        exam_id,
        customPromptText: custom_prompt_text,
      });

      logger.info(
        `EXAM_BATCH_SUCCESS: exam_id=${exam_id}, batch=${batch_number}, generated=${generatedQuestions.length}`,
      );

      // Store questions in database
      for (const question of generatedQuestions) {
        const createdQuestion = await prismaInstance.quizQuestion.create({
          data: {
            cert_id,
            question_text: question.question,
            explanations: question.explanation,
            generated_from: exam_id,
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
      let associationResult = null;
      if (batch_number >= total_batches) {
        logger.info(
          `All batches completed for exam ${exam_id}, batch ${batch_number}`,
        );

        // Get existing exam user answers to avoid duplicates
        const existingAnswers = await prismaInstance.examUserAnswer.findMany({
          where: { exam_id },
          select: { quiz_question_id: true },
        });

        const existingQuestionIds = new Set(
          existingAnswers.map((answer) => answer.quiz_question_id),
        );

        // Use the reusable question association utility
        associationResult = await associateQuestionsWithExam({
          exam_id,
          cert_id,
          targetQuestionCount: exam.total_questions || undefined,
          existingQuestionIds,
        });

        if (!associationResult.success) {
          logger.error(
            `Failed to associate questions with exam ${exam_id}: ${associationResult.error}`,
          );

          // Update exam status to failed
          await updateExamAfterQuestionAssociation(exam_id, associationResult);
          throw new Error(
            associationResult.error || 'Failed to associate questions',
          );
        }

        // Update exam with successful association results
        await updateExamAfterQuestionAssociation(exam_id, associationResult);

        logger.info(`EXAM_READY: exam_id=${exam_id}, status=READY`);
      } else {
        // Create next batch task
        // MARKED
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
          custom_prompt_text,
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
            data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
          });

          logger.info(
            `EXAM_GENERATION_FAILED: exam_id=${exam_id}, reason=task_creation_failed`,
          );
        } else {
          logger.info(
            `EXAM_BATCH_NEXT: exam_id=${exam_id}, next_batch=${
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
          questions_associated: associationResult?.associatedQuestionCount || 0,
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
        data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
      });

      logger.info(
        `EXAM_GENERATION_FAILED: exam_id=${exam_id}, reason=question_generation_error`,
      );

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
