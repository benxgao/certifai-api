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
} from './utils';

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
      'List of exam topics for this batch - one question will be generated for each topic (batch size limited)',
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
});
// Using shared AI instance initialization

// Helper function to build the quiz generation prompt
const buildQuizPrompt = (
  subject: string,
  examTopicList: string[],
  customPromptText?: string,
): string => {
  const count = examTopicList.length;
  const topicsSection = examTopicList
    .map((topic, index) => `${index + 1}. ${topic}`)
    .join('\n    ');

  const basePrompt = `Generate ${count} realistic ${subject} certification exam questions.
    Each question MUST focus on one of the following specific topics (use the exact topic name as examTopic):
    ${topicsSection}

    REQUIREMENTS:
    1. Sophisticated distractors requiring expertise
    2. All 4 choices plausible and technically accurate
    3. Wrong answers: common misconceptions, not obvious fakes
    4. Make questions text simple and clear, avoiding unnecessary complexity
    5. examTopic MUST be the exact topic name from the list above for each question
    6. Each provided exam topic must have a corresponding question

    CONSTRUCTION:
    - Business scenarios with specific constraints
    - Exact 4 options, can be commands, code snippets, or concepts
    - Each question MUST use one of the provided examTopic values exactly as listed
  `;

  const customSection = customPromptText?.trim()
    ? `ADDITIONAL FOCUS (the below rules should override any of the above requirements if there are any conflicts):${customPromptText.trim()}`
    : '';

  const formatSection = `
    JSON format:[{
      "question": "string",
      "choices": ["string", "string", "string", "string"],
      "answerIndex": 0,
      "explanation": "string",
      "examTopic": "string (REQUIRED - must be one of the exact topic names from the list above)"
    }]

    Explanation: simple sentences to exlain why correct option is correct and why wrong answers are wrong.
    IMPORTANT: Each question MUST have an examTopic value that exactly matches one of the provided topic names.
  `;

  return basePrompt + customSection + formatSection;
};

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
          const { subject, examTopicList, exam_id, customPromptText } = input;
          const count = examTopicList.length;

          logGenerationStart('quiz generation', {
            subject,
            count,
            exam_id,
            examTopicList: examTopicList.join(', '),
            customPromptText: customPromptText?.substring(0, 100),
          });

          const prompt = buildQuizPrompt(
            subject,
            examTopicList,
            customPromptText,
          );

          // Generate quiz items using shared utility with custom config
          const actualQuizItems = await generateWithValidation(
            ai,
            prompt,
            z.array(QuizSchema),
            sendChunk,
            {
              maxOutputTokens: 4096 * 100,
              temperature: 0.6,
              topP: 0.9,
              topK: 40,
            },
          );

          // Validate and filter questions with missing examTopic using shared utility
          const validQuizItems = validateAndFilterResponse(
            actualQuizItems,
            (item: QuizItem) =>
              !!(
                item.examTopic &&
                item.examTopic.trim() !== '' &&
                examTopicList.includes(item.examTopic)
              ),
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
