import { z, FlowSideChannel, Genkit } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

import logger from '../firebase/logger';
import {
  createAiInstancePromise,
  generateWithValidation,
  validateAndFilterResponse,
  handleGenerationError,
  logGenerationStart,
  logGenerationComplete,
  googleAI,
  DEFAULT_GENAI_MODEL,
} from './utils';
import {
  buildQuizPrompt,
  validateQuizItemTopic,
  getAdaptiveQuizMetrics,
} from './adaptiveQuiz';

enableFirebaseTelemetry();

const QuizSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()),
  answerIndex: z.number(),
  explanation: z.string(),
  examTopic: z.string(),
  exam_id: z.string(),
});

type QuizItem = z.infer<typeof QuizSchema>;

const QuizGeneratorInput = z.object({
  subject: z
    .string()
    .describe('Name of IT certification')
    .default('Google Cloud'),
  examTopicList: z
    .array(z.string())
    .min(1)
    .max(100) // Maximum 100 topics to handle larger batches
    .describe(
      'List of exam topics for this batch - one question will be generated for each topic. Duplicate topics are allowed for adaptive learning.',
    ),
  exam_id: z
    .string()
    .describe(
      'Unique exam identifier that will be associated with each quiz item',
    ),
  customPromptText: z
    .string()
    .optional()
    .describe(
      'Optional custom prompt text to focus on specific topics or requirements',
    ),
  lastExamReport: z
    .string()
    .optional()
    .describe(
      'Optional exam report from the last completed exam to inform adaptive difficulty adjustment',
    ),
});
// Using shared AI instance initialization

// Use the shared singleton AI instance
const aiInstancePromise: Promise<Genkit> = createAiInstancePromise();

type QuizGeneratorInputType = z.infer<typeof QuizGeneratorInput>;

// MARKED pass in users prompt text
export const quizGeneratorPromise = aiInstancePromise
  .then((ai) => {
    return ai.defineFlow(
      {
        name: 'quizGenerator',
        inputSchema: QuizGeneratorInput,
        outputSchema: z.array(QuizSchema),
        streamSchema: z.string(),
      },
      async (
        input: QuizGeneratorInputType,
        { sendChunk }: FlowSideChannel<string>,
      ): Promise<QuizItem[]> => {
        try {
          const {
            subject,
            examTopicList,
            exam_id,
            customPromptText,
            lastExamReport,
          } = input;

          // Get adaptive quiz metrics using utility function
          const metrics = getAdaptiveQuizMetrics(examTopicList);

          logGenerationStart('quiz generation', {
            subject,
            count: metrics.totalCount,
            exam_id,
            examTopicList: examTopicList.join(', '),
            uniqueTopicsCount: metrics.uniqueTopicsCount,
            duplicateTopicsCount: metrics.duplicateTopicsCount,
            duplicateTopics: metrics.duplicateTopics,
            customPromptText: customPromptText?.substring(0, 100),
            hasLastExamReport: !!lastExamReport,
            adaptiveDifficultyEnabled: !!lastExamReport,
            adaptiveLearningWithDuplicates:
              !!lastExamReport && metrics.duplicateTopicsCount > 0,
          });

          const prompt = buildQuizPrompt(
            subject,
            examTopicList,
            customPromptText,
            lastExamReport,
          );

          // Generate quiz items using shared utility with custom config
          const actualQuizItems = await generateWithValidation(
            ai,
            prompt,
            z.array(QuizSchema),
            sendChunk,
            {
              maxOutputTokens: 8192,
              temperature: 0.6,
              topP: 0.9,
              topK: 40,
            },
            googleAI.model(DEFAULT_GENAI_MODEL),
          );

          // Validate and filter questions with missing examTopic using shared utility
          const validQuizItems = validateAndFilterResponse(
            actualQuizItems,
            (item: QuizItem) => validateQuizItemTopic(item, examTopicList),
            'quiz items with valid examTopic from the provided list',
          );

          // Associate exam_id with each quiz item
          const quizItemsWithExamId = validQuizItems.map((item) => ({
            ...item,
            exam_id,
          }));

          logGenerationComplete('quiz items', quizItemsWithExamId, {
            count: quizItemsWithExamId.length,
            exam_id,
            examTopicList: examTopicList.join(', '),
          });

          return quizItemsWithExamId;
        } catch (error) {
          return handleGenerationError(
            error,
            {
              subject: input.subject,
              examTopicList: input.examTopicList.join(', '),
              exam_id: input.exam_id,
            },
            'generate quiz items',
          );
        }
      },
    );
  })
  .catch((initError) => {
    logger.error(
      'Failed to initialize quizGenerator due to AI instance failure:',
      {
        error: initError instanceof Error ? initError.message : 'Unknown error',
      },
    );

    // Return a function that throws an error when called to match the expected interface
    return async (): Promise<QuizItem[]> => {
      throw new Error(
        `QuizGenerator is unavailable: AI service initialization failed - ${
          initError instanceof Error ? initError.message : 'Unknown error'
        }`,
      );
    };
  });
