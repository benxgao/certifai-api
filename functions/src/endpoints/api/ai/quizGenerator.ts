/**
 *
 * Get an API key at https://aistudio.google.com/app/apikey
 *
 */

import { inspect } from 'util';
import { genkit, z, FlowSideChannel, Genkit } from 'genkit';
import { Request, Response } from 'express';
import { googleAI, gemini20Flash } from '@genkit-ai/googleai';
import logger from '../../../services/firebase/logger';
import { getSecret } from '../../../services/gcp/secret_manager';

const initializeAiInstance = async (): Promise<Genkit> => {
  try {
    const apiKey = await getSecret('GOOGLE_GENAI_API_KEY');
    logger.info('Successfully fetched GOOGLE_GENAI_API_KEY.');

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

// Create a singleton promise for the AI instance to ensure it's initialized only once.
const aiInstancePromise: Promise<Genkit> = initializeAiInstance();

const QuizSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()),
  answerIndex: z.number(),
  topic: z.string().optional(),
  explanation: z.string(),
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
});

type QuizGeneratorInputType = z.infer<typeof QuizGeneratorInput>;

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
        const { subject, count, exam_id } = input;
        const prompt = `Generate ${count} realistic ${subject} certification exam questions.
REQUIREMENTS:
1. Scenario-based workplace situations
2. All 4 choices plausible and technically accurate
3. Wrong answers: common misconceptions, not obvious fakes
4. Use real service names and proper terminology
5. Test understanding, not memorization
6. Sophisticated distractors requiring expertise

CONSTRUCTION:
- Business scenarios with specific constraints
- Company context (size, budget, compliance)
- Decision-making focus
- Best practices and architecture
- Exact 4 options, consistent grammar
- Similar detail length across choices

JSON format:
[{
  "question": "string",
  "choices": ["string", "string", "string", "string"],
  "answerIndex": 0,
  "topic": "string",
  "explanation": "string"
}]

Explanation: why correct answer is best, why others inadequate.`;

        logger.info(
          `Starting quiz generation for subject: ${subject}, count: ${count}, exam_id: ${exam_id}`,
        );

        const { response, stream } = ai.generateStream({
          prompt: prompt,
          config: {
            maxOutputTokens: 2048,
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

        // Associate exam_id with each quiz item
        const quizItemsWithExamId = actualQuizItems.map((item) => ({
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
