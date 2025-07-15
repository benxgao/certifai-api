import { z, FlowSideChannel, Genkit } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

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
  count: z
    .number()
    .min(1)
    .max(50) // Increased from 20 to 50 to handle larger batches
    .describe('Number of quiz items to generate')
    .default(3),
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
  count: number,
  customPromptText?: string,
): string => {
  const basePrompt = `Generate ${count} realistic ${subject} certification exam questions.
    REQUIREMENTS:
    1. Sophisticated distractors requiring expertise
    2. All 4 choices plausible and technically accurate
    3. Wrong answers: common misconceptions, not obvious fakes
    4. Make questions text simple and clear, avoiding unnecessary complexity
    5. examTopic MUST be a concise keyword or phrase (2-4 words) representing the main topic area (e.g., "IAM Policies", "VPC Networking", "Database Security", "Load Balancing")

    CONSTRUCTION:
    - Business scenarios with specific constraints
    - Exact 4 options, can be commands, code snippets, or concepts
    - Each question MUST have a relevant examTopic that categorizes the question's subject area
  `;

  const customSection = customPromptText?.trim()
    ? `ADDITIONAL FOCUS:${customPromptText.trim()}`
    : '';

  const formatSection = `
    JSON format:[{
      "question": "string",
      "choices": ["string", "string", "string", "string"],
      "answerIndex": 0,
      "explanation": "string",
      "examTopic": "string (REQUIRED - concise topic category)"
    }]

    Explanation: simple sentences to exlain why correct option is correct and why wrong answers are wrong.
    IMPORTANT: Each question MUST have a unique examTopic value that is relevant to the question's content.
  `;

  return basePrompt + customSection + formatSection;
};

// Create a singleton promise for the AI instance to ensure it's initialized only once.
const aiInstancePromise: Promise<Genkit> = createAiInstancePromise();

type QuizGeneratorInputType = z.infer<typeof QuizGeneratorInput>;

// MARKED pass in users prompt text
export const quizGeneratorPromise = aiInstancePromise.then((ai) => {
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
        const { subject, count, exam_id, customPromptText } = input;

        logGenerationStart('quiz generation', {
          subject,
          count,
          exam_id,
          customPromptText: customPromptText?.substring(0, 100),
        });

        const prompt = buildQuizPrompt(subject, count, customPromptText);

        // Generate quiz items using shared utility with custom config
        const actualQuizItems = await generateWithValidation(
          ai,
          prompt,
          z.array(QuizSchema),
          sendChunk,
          {
            maxOutputTokens: 4096 * 100,
            temperature: 0.4,
            topP: 0.9,
            topK: 40,
          },
        );

        // Validate and filter questions with missing examTopic using shared utility
        const validQuizItems = validateAndFilterResponse(
          actualQuizItems,
          (item: QuizItem) =>
            !!(item.examTopic && item.examTopic.trim() !== ''),
          'quiz items with valid examTopic',
        );

        // Associate exam_id with each quiz item
        const quizItemsWithExamId = validQuizItems.map((item) => ({
          ...item,
          exam_id,
        }));

        logGenerationComplete('quiz items', quizItemsWithExamId, {
          count: quizItemsWithExamId.length,
          exam_id,
        });

        return quizItemsWithExamId;
      } catch (error) {
        return handleGenerationError(
          error,
          {
            subject: input.subject,
            count: input.count,
            exam_id: input.exam_id,
          },
          'generate quiz items',
        );
      }
    },
  );
});
