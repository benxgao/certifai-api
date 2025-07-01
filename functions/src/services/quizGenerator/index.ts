import { genkit, z, FlowSideChannel, Genkit } from 'genkit';
import { googleAI, gemini20Flash } from '@genkit-ai/googleai';
import logger from '../firebase/logger';
import { getSecret } from '../gcp/secretManager';

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
const initializeAiInstance = async (): Promise<Genkit> => {
  try {
    const apiKey = await getSecret('GOOGLE_GENAI_API_KEY');

    const ai = genkit({
      plugins: [googleAI({ apiKey })],
      model: gemini20Flash,
    });

    logger.info('Genkit AI instance initialized successfully.');

    return ai;
  } catch (error) {
    logger.error('Failed to initialize Genkit AI instance:', error as any);
    throw new Error('Could not initialize AI services.'); // Propagate a generic error
  }
};

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

  const formatSection = `JSON format:[{
    "question": "string",
    "choices": ["string", "string", "string", "string"],
    "answerIndex": 0,
    "explanation": "string",
    "examTopic": "string (REQUIRED - concise topic category)"
    }]
    Explanation: why correct answer is best, why others inadequate.
    IMPORTANT: Every question MUST include a meaningful examTopic value.
  `;

  return basePrompt + customSection + formatSection;
};

// Create a singleton promise for the AI instance to ensure it's initialized only once.
const aiInstancePromise: Promise<Genkit> = initializeAiInstance();

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

        const prompt = buildQuizPrompt(subject, count, customPromptText);

        logger.info(
          `Starting quiz generation for subject: ${subject}, count: ${count}, exam_id: ${exam_id}${
            customPromptText
              ? `, custom_prompt: ${customPromptText.substring(0, 100)}...`
              : ''
          }`,
        );

        const { response, stream } = ai.generateStream({
          prompt: prompt,
          config: {
            maxOutputTokens: 4096 * 20,
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
          },
          output: { schema: z.array(QuizSchema) },
        });

        for await (const chunk of stream) {
          if (chunk.text) {
            sendChunk(chunk.text);
          }
        }

        const generateResponse = await response;
        const actualQuizItems: QuizItem[] | null = generateResponse.output;

        if (!actualQuizItems || actualQuizItems.length === 0) {
          logger.warn(
            'Genkit response was null, empty, or not in the expected format.',
            { subject, count, exam_id },
          );
          throw new Error('No valid quiz items generated.');
        }

        // Validate and filter questions with missing examTopic
        const validQuizItems = actualQuizItems.filter((item) => {
          const hasValidTopic = item.examTopic && item.examTopic.trim() !== '';
          if (!hasValidTopic) {
            logger.warn(
              `Question filtered out due to missing examTopic: ${item.question?.substring(
                0,
                50,
              )}...`,
            );
          }
          return hasValidTopic;
        });

        if (validQuizItems.length === 0) {
          logger.error('No questions generated with valid examTopic values');
          throw new Error('No questions generated with valid examTopic values');
        }

        if (validQuizItems.length < actualQuizItems.length) {
          logger.warn(
            `Filtered out ${
              actualQuizItems.length - validQuizItems.length
            } questions with missing examTopic`,
          );
        }

        // Associate exam_id with each quiz item
        const quizItemsWithExamId = validQuizItems.map((item) => ({
          ...item,
          exam_id,
        }));

        logger.info(
          `Generated quiz items: ${JSON.stringify(
            quizItemsWithExamId,
            null,
            2,
          )}`,
          { structuredData: true },
        );
        return quizItemsWithExamId;
      } catch (error) {
        logger.error(
          `Error in quizGenerator for subject '${input.subject}', count '${input.count}', exam_id '${input.exam_id}':`,
          error as any,
        );
        // Re-throw a more specific error or handle as needed
        throw new Error(
          `Failed to generate quiz items: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
});
