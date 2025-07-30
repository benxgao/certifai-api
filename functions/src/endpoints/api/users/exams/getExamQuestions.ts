import { Response } from 'express';
import logger from '../../../../services/firebase/logger';
import { CustomRequest } from '../../../../types';
import prismaInstance from '../../../../services/prisma';
import {
  associateQuestionsWithExam,
  updateExamAfterQuestionAssociation,
} from '../../../../utils/examQuestionAssociation';
import {
  extractPaginationParams,
  createPaginatedResponse,
} from '../../../../utils/pagination';
import { RedisService, CACHE_CONFIG } from '../../../../services/redis';
import { CacheHierarchyService } from '../../../../services/cache/cacheHierarchy';

// Define a type for the question response structure for clarity
type AnswerOptionResponse = {
  option_id: string;
  option_text: string;
  is_correct?: boolean;
};

type QuestionResponse = {
  quiz_question_id: string;
  question_text: string;
  difficulty: string | null;
  generated_from: string | null;
  cert_id: number;
  user_answer_id: string; // ID of the ExamUserAnswers record
  selected_option_id: string | null;
  explanations?: string | null;
  exam_topic?: string | null;
  user_answer_is_correct?: boolean | null;
  answerOptions: AnswerOptionResponse[];
};

const handler = async (req: any | CustomRequest, res: Response) => {
  try {
    const { user_id, exam_id } = req.params;

    if (!user_id) {
      res.status(400).json({
        success: false,
        error: 'User ID is required.',
      });
      return;
    }

    if (!exam_id) {
      res.status(400).json({
        success: false,
        error: 'Exam ID is required.',
      });
      return;
    }

    // Extract pagination parameters using our utility
    const paginationParams = extractPaginationParams(req, {
      defaultPageSize: 10,
      maxPageSize: 100,
    });

    // Verify exam exists and belongs to the user (optimized with field selection)
    const exam = await prismaInstance.examAttempt.findUnique({
      where: { exam_id: exam_id },
      select: {
        exam_id: true,
        user_id: true,
        exam_status: true,
        score: true,
        submitted_at: true,
        total_questions: true,
        certification: {
          select: {
            cert_id: true,
            name: true,
            min_quiz_counts: true,
            max_quiz_counts: true,
          },
        },
      },
    });

    if (!exam) {
      res.status(404).json({ success: false, error: 'Exam not found.' });
      return;
    }

    // Authorization: Check if the exam belongs to the user_id specified in the path
    // Further checks might be needed to ensure the authenticated user (from req.firebase_user_info)
    // matches req.params.user_id or has admin rights.
    if (exam.user_id !== user_id) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Exam does not belong to this user.',
      });
      return;
    }

    // Check if exam questions are ready - block access if questions are still generating
    if (exam.exam_status === 'QUESTIONS_GENERATING') {
      res.status(423).json({
        success: false,
        error:
          'Exam questions are still being generated. Please wait and try again.',
        exam_status: exam.exam_status,
      });
      return;
    }

    if (exam.exam_status === 'QUESTION_GENERATION_FAILED') {
      res.status(500).json({
        success: false,
        error:
          'Question generation failed for this exam. Please contact support or create a new exam.',
        exam_status: exam.exam_status,
      });
      return;
    }

    logger.info(
      `Fetching questions for exam_id: ${exam_id}, user_id: ${user_id}, page: ${paginationParams.page}, pageSize: ${paginationParams.pageSize}`,
    );

    // First, check if exam has any associated questions
    const totalQuestions = await prismaInstance.examUserAnswer.count({
      where: { exam_id: exam_id },
    });

    // If no questions are associated, automatically associate them using the same logic as updateExam
    if (totalQuestions === 0) {
      logger.info(
        `No questions associated with exam ${exam_id}. Automatically associating questions...`,
      );

      try {
        // Get exam with certification details
        const examWithCert = await prismaInstance.examAttempt.findUnique({
          where: { exam_id },
          include: {
            certification: {
              select: {
                cert_id: true,
                name: true,
                min_quiz_counts: true,
                max_quiz_counts: true,
              },
            },
          },
        });

        if (!examWithCert) {
          res.status(404).json({ success: false, error: 'Exam not found.' });
          return;
        }

        const { cert_id } = examWithCert.certification;

        // Use the reusable question association utility
        const associationResult = await associateQuestionsWithExam({
          exam_id,
          cert_id,
          targetQuestionCount: examWithCert.total_questions || undefined,
          existingQuestionIds: new Set(), // No existing questions since totalQuestions === 0
        });

        if (!associationResult.success) {
          logger.warn(
            `No questions available for exam ${exam_id} (certification: ${examWithCert.certification.name})`,
          );

          res.status(200).json({
            success: true,
            message: 'No questions available for this certification yet.',
            data: {
              questions: [],
            },
            pagination: {
              currentPage: paginationParams.page,
              pageSize: paginationParams.pageSize,
              totalItems: 0,
              totalPages: 0,
            },
          });
          return;
        }

        // Update exam with successful association results
        await updateExamAfterQuestionAssociation(exam_id, associationResult);

        logger.info(
          `Successfully associated ${associationResult.associatedQuestionCount} questions with exam ${exam_id}`,
        );
      } catch (associationError) {
        logger.error(
          `Error associating questions with exam ${exam_id}:`,
          associationError as any,
        );
        // Continue with the original flow even if association fails
      }
    }

    // Optimized query with field selection to reduce data transfer
    // Add caching for exam questions to improve performance
    const cacheKey = RedisService.generateUserCacheKey(
      CACHE_CONFIG.KEYS.USER_EXAM_QUESTIONS,
      user_id,
      {
        exam_id,
        page: paginationParams.page,
        pageSize: paginationParams.pageSize,
      },
    );

    const examUserAnswers = await CacheHierarchyService.getOrSet(
      cacheKey,
      async () => {
        logger.info(
          `Cache miss - fetching exam questions from database for exam ${exam_id}`,
        );

        return await prismaInstance.examUserAnswer.findMany({
          where: { exam_id: exam_id },
          select: {
            user_answer_id: true,
            selected_option_id: true,
            is_correct: true,
            quizQuestion: {
              select: {
                quiz_question_id: true,
                question_text: true,
                explanations: true,
                difficulty: true,
                generated_from: true,
                cert_id: true,
                exam_topic: true,
                answerOptions: {
                  select: {
                    option_id: true,
                    option_text: true,
                    is_correct: true,
                  },
                },
              },
            },
          },
          skip: paginationParams.skip,
          take: paginationParams.take,
          // Ensuring consistent question order for pagination and user experience.
          orderBy: { quizQuestion: { created_at: 'asc' } },
        });
      },
      CACHE_CONFIG.USER_EXAM_QUESTIONS_TTL,
      { forceMemoryCache: false }, // Don't use memory cache for large question data
    );

    // Get updated total count after potential question association
    const finalTotalQuestions = await prismaInstance.examUserAnswer.count({
      where: { exam_id: exam_id },
    });

    const questions = examUserAnswers.map((eau) => {
      const { quizQuestion } = eau;

      // Debug log to check exam_topic values
      if (!quizQuestion.exam_topic) {
        logger.warn(
          `Question ${quizQuestion.quiz_question_id} has null exam_topic`,
        );
      }

      // Show explanations and correct answers if exam is submitted (regardless of score)
      const isExamSubmitted = exam.submitted_at !== null;

      // Debug log to check exam state for explanations
      logger.info(
        `EXPLANATIONS_DEBUG: exam_id=${exam_id}, submitted_at=${exam.submitted_at}, score=${exam.score}, isExamSubmitted=${isExamSubmitted}`,
      );

      const questionResponse: QuestionResponse = {
        quiz_question_id: quizQuestion.quiz_question_id,
        question_text: quizQuestion.question_text,
        difficulty: quizQuestion.difficulty,
        generated_from: quizQuestion.generated_from,
        cert_id: quizQuestion.cert_id,
        exam_topic: quizQuestion.exam_topic || null, // Include exam topic if available
        user_answer_id: eau.user_answer_id,
        selected_option_id: eau.selected_option_id, // Always include user's selection

        answerOptions: quizQuestion.answerOptions.map((ao) => {
          const option: AnswerOptionResponse = {
            option_id: ao.option_id,
            option_text: ao.option_text,
          };
          if (isExamSubmitted) {
            option.is_correct = ao.is_correct;
          }
          return option;
        }),
      };

      if (isExamSubmitted) {
        questionResponse.explanations = quizQuestion.explanations;
        questionResponse.user_answer_is_correct = eau.is_correct;

        // Debug log for explanations
        logger.info(
          `EXPLANATIONS_DEBUG: Adding explanations for question ${
            quizQuestion.quiz_question_id
          }, explanations_present=${!!quizQuestion.explanations}, explanations_length=${
            quizQuestion.explanations?.length || 0
          }`,
        );
      }

      return questionResponse;
    });

    // Debug log to check all exam_topic values being returned
    const examTopics = questions.map((q) => ({
      id: q.quiz_question_id,
      topic: q.exam_topic,
    }));
    logger.info(
      `Returning questions with exam_topics: ${JSON.stringify(examTopics)}`,
      { exam_id },
    );

    // Create paginated response using our utility
    const response = createPaginatedResponse(
      { questions: questions },
      finalTotalQuestions,
      paginationParams,
    );

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error in get_questions handler:', error as any);
    res
      .status(
        error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
      )
      .json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
  }
};

export default handler;
