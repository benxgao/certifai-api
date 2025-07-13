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
import { PerformanceMonitor } from '../../services/performance';
import { ExamGenerationLogger } from '../../services/exam-generation-logger';
import { ExamGenerationMetrics } from '../../services/exam-generation-metrics';

interface TaskPayload {
  exam_id: string;
  cert_id: number;
  certification_name: string;
  questions_to_generate: number;
  batch_number: number;
  total_batches: number;
  custom_prompt_text?: string;
  questions_per_batch: number;
}

const handler = async (req: any | CustomRequest, res: Response) => {
  let batchMetrics: {
    start_time: number;
    initial_memory: NodeJS.MemoryUsage;
  } | null = null;

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
      questions_per_batch,
    } = payload;

    // Start structured logging for this batch
    batchMetrics = ExamGenerationLogger.logBatchStart({
      exam_id,
      batch_number,
      total_batches,
      questions_to_generate,
      cert_id,
    });

    logger.info(
      `EXAM_BATCH_PROCESS: exam_id=${exam_id}, batch=${batch_number}/${total_batches}, questions=${questions_to_generate}`,
    );

    // Validate that questions_to_generate is not negative
    if (questions_to_generate < 0) {
      logger.error(
        `Invalid questions_to_generate value: ${questions_to_generate} for exam ${exam_id}, batch ${batch_number}`,
      );
      res.status(400).json({
        success: false,
        error: `Invalid questions count: ${questions_to_generate}. Count must be >= 0.`,
      });
      return;
    }

    // Skip processing if no questions to generate
    if (questions_to_generate === 0) {
      logger.info(
        `No questions to generate for exam ${exam_id}, batch ${batch_number}. Marking as complete.`,
      );

      res.status(200).json({
        success: true,
        message: `Batch ${batch_number} completed with 0 questions`,
        data: {
          exam_id,
          batch_number,
          total_batches,
          questions_generated: 0,
          questions_associated: 0,
          is_final_batch: batch_number >= total_batches,
        },
      });
      return;
    }

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
      // Log AI request start
      ExamGenerationLogger.logAIRequest({
        exam_id,
        batch_number,
        ai_service: 'gemini20Flash',
        certification_name,
        questions_requested: questions_to_generate,
      });

      const aiStartTime = Date.now();

      // Generate questions using the quiz generator
      const quizGenerator = await quizGeneratorPromise;
      const generatedQuestions = await quizGenerator({
        // MARKED collect topics in a batch and pass to the next batch, to get better topic distribution
        subject: certification_name,
        count: questions_to_generate,
        exam_id,
        customPromptText: custom_prompt_text,
      });

      const aiDuration = Date.now() - aiStartTime;

      // Log AI response
      ExamGenerationLogger.logAIResponse({
        exam_id,
        batch_number,
        ai_service: 'gemini20Flash',
        questions_generated: generatedQuestions.length,
        duration_ms: aiDuration,
        success: true,
      });

      logger.info(
        `EXAM_BATCH_SUCCESS: exam_id=${exam_id}, batch=${batch_number}, generated=${generatedQuestions.length}`,
      );

      // Log examTopic values for debugging
      const examTopics = generatedQuestions
        .map((q) => q.examTopic)
        .filter((t) => t);
      logger.info(`Generated examTopics: ${JSON.stringify(examTopics)}`, {
        exam_id,
        batch_number,
      });

      // Store questions in database using batch operations for better performance
      const validQuestions = generatedQuestions.filter((question) => {
        if (!question.examTopic || question.examTopic.trim() === '') {
          logger.warn(
            `Skipping question with missing examTopic: ${question.question?.substring(
              0,
              50,
            )}...`,
          );
          return false;
        }
        return true;
      });

      if (validQuestions.length === 0) {
        logger.warn(
          `No valid questions to store for exam ${exam_id}, batch ${batch_number}`,
        );
      } else {
        // Use a transaction to ensure data consistency and improve performance
        const batchStartTime = Date.now();

        await prismaInstance.$transaction(async (prisma) => {
          // Batch create questions
          const questionsData = validQuestions.map((question) => ({
            cert_id,
            question_text: question.question,
            explanations: question.explanation,
            exam_topic: question.examTopic.trim().toLowerCase(),
            generated_from: exam_id,
            difficulty: null,
          }));

          const createdQuestions =
            await prisma.quizQuestion.createManyAndReturn({
              data: questionsData,
            });

          // Prepare answer options data for batch creation
          const optionsData: Array<{
            quiz_question_id: string;
            option_text: string;
            is_correct: boolean;
          }> = [];

          createdQuestions.forEach((createdQuestion, questionIndex) => {
            const question = validQuestions[questionIndex];
            for (let i = 0; i < question.choices.length; i++) {
              optionsData.push({
                quiz_question_id: createdQuestion.quiz_question_id,
                option_text: question.choices[i],
                is_correct: i === question.answerIndex,
              });
            }
          });

          // Batch create answer options
          if (optionsData.length > 0) {
            await prisma.answerOption.createMany({
              data: optionsData,
              skipDuplicates: true,
            });
          }

          const batchDuration = Date.now() - batchStartTime;

          // Log database storage with structured logging
          ExamGenerationLogger.logDatabaseStore({
            exam_id,
            batch_number,
            questions_stored: createdQuestions.length,
            answer_options_stored: optionsData.length,
            duration_ms: batchDuration,
            success: true,
          });

          // Track batch operation performance
          PerformanceMonitor.trackBatchOperation(
            'quiz_questions_batch_create',
            createdQuestions.length,
            batchDuration,
            {
              exam_id,
              batch_number,
              total_options: optionsData.length,
            },
          );

          logger.info(
            `BATCH_CREATE_SUCCESS: exam_id=${exam_id}, batch=${batch_number}, ` +
              `questions=${createdQuestions.length}, options=${optionsData.length}, duration=${batchDuration}ms`,
          );
        });
      }

      // Check if this is the last batch
      let associationResult = null;

      // Calculate questions generated so far for logging and next batch calculation
      const questionsGenerated = batch_number * questions_per_batch;

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

        // Log exam completion
        ExamGenerationLogger.logExamComplete({
          exam_id,
          total_questions_generated: questionsGenerated,
          total_questions_associated: associationResult.associatedQuestionCount,
          total_batches,
          status: 'READY',
        });

        logger.info(`EXAM_READY: exam_id=${exam_id}, status=READY`);
      } else {
        // Create next batch task
        // Calculate remaining questions needed, ensuring we never go negative
        const remainingQuestions = Math.max(
          0,
          (exam.total_questions || 0) - questionsGenerated,
        );
        // Use total number of remaining questions if it's less than questions_per_batch
        const questionsForNextBatch =
          remainingQuestions < questions_per_batch
            ? remainingQuestions
            : questions_per_batch;

        // Only create next batch if there are questions remaining
        if (questionsForNextBatch <= 0) {
          logger.warn(
            `No more questions needed for exam ${exam_id}. Total: ${exam.total_questions}, Generated: ${questionsGenerated}`,
          );
          // Mark exam as ready since we've generated enough questions
          await updateExamAfterQuestionAssociation(exam_id, {
            success: true,
            associatedQuestionCount: questionsGenerated,
            selectedQuestionIds: [],
            certification: null,
          });

          res.status(200).json({
            success: true,
            message: `Exam generation completed. Total questions generated: ${questionsGenerated}`,
            data: {
              exam_id,
              batch_number,
              total_batches,
              questions_generated: generatedQuestions.length,
              is_final_batch: true,
            },
          });
          return;
        }

        const nextBatchPayload = {
          exam_id,
          cert_id,
          certification_name,
          questions_to_generate: questionsForNextBatch,
          batch_number: batch_number + 1,
          total_batches,
          custom_prompt_text,
          questions_per_batch,
        };

        const nextTaskName = await createCloudTask(
          'exam-questions-queue',
          `${process.env.GCP_TASKS_HOST}/delegators/tasks/take`,
          nextBatchPayload,
        );

        // Log task creation
        ExamGenerationLogger.logTaskCreation({
          exam_id,
          current_batch: batch_number,
          next_batch: batch_number + 1,
          total_batches,
          questions_for_next_batch: questionsForNextBatch,
          task_name: nextTaskName || undefined,
          success: !!nextTaskName,
          error: nextTaskName ? undefined : 'Failed to create cloud task',
        });

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

          // Log exam failure
          ExamGenerationLogger.logExamFailure({
            exam_id,
            batch_number,
            total_batches,
            reason: 'task_creation_failed',
            error: 'Failed to create next batch cloud task',
            questions_generated_so_far: questionsGenerated,
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

      // Log successful batch completion with metrics
      if (batchMetrics) {
        ExamGenerationLogger.logBatchComplete({
          exam_id,
          batch_number,
          total_batches,
          questions_generated: generatedQuestions.length,
          questions_stored: validQuestions.length,
          start_time: batchMetrics.start_time,
          initial_memory: batchMetrics.initial_memory,
          success: true,
        });

        // Record metrics for monitoring
        const finalMemory = process.memoryUsage();
        ExamGenerationMetrics.recordBatchOperation({
          exam_id,
          batch_number,
          success: true,
          duration_ms: Date.now() - batchMetrics.start_time,
          memory_used_mb: finalMemory.heapUsed / 1024 / 1024,
        });
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
      // Log AI service failure if it was during AI generation
      ExamGenerationLogger.logAIResponse({
        exam_id,
        batch_number,
        ai_service: 'gemini20Flash',
        questions_generated: 0,
        duration_ms: 0,
        success: false,
        error:
          generationError instanceof Error
            ? generationError.message
            : 'Unknown AI error',
      });

      // Log batch failure with metrics
      if (batchMetrics) {
        ExamGenerationLogger.logBatchComplete({
          exam_id,
          batch_number,
          total_batches,
          questions_generated: 0,
          questions_stored: 0,
          start_time: batchMetrics.start_time,
          initial_memory: batchMetrics.initial_memory,
          success: false,
          error:
            generationError instanceof Error
              ? generationError.message
              : 'Unknown error',
        });

        // Record failed batch metrics
        const finalMemory = process.memoryUsage();
        ExamGenerationMetrics.recordBatchOperation({
          exam_id,
          batch_number,
          success: false,
          duration_ms: Date.now() - batchMetrics.start_time,
          memory_used_mb: finalMemory.heapUsed / 1024 / 1024,
        });
      }

      logger.error(
        `Error generating questions for exam ${exam_id}, batch ${batch_number}:`,
        generationError as any,
      );

      // Update exam status to failed
      await prismaInstance.examAttempt.update({
        where: { exam_id },
        data: { exam_status: ExamStatus.QUESTION_GENERATION_FAILED },
      });

      // Log exam failure
      ExamGenerationLogger.logExamFailure({
        exam_id,
        batch_number,
        total_batches,
        reason: 'question_generation_error',
        error:
          generationError instanceof Error
            ? generationError.message
            : 'Unknown error',
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
