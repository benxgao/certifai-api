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
});

type QuizItem = z.infer<typeof QuizSchema>;

const quizGeneratorPromise = aiInstancePromise.then((ai) => {
  return ai.defineFlow(
    {
      name: 'quizGenerator',
      inputSchema: z
        .string()
        .describe('Name of IT certification')
        .default('Google Cloud'),
      outputSchema: z.array(QuizSchema),
      streamSchema: z.string(),
    },
    async (
      subject: string,
      { sendChunk }: FlowSideChannel<string>,
    ): Promise<QuizItem[]> => {
      try {
        const prompt = `
        You are an IT certification quiz generator.
        Generate 3 items for the certification subject: ${subject}.
        Each quiz item should include:
        - A question related to the subject
        - An array of choices (at least 4 options)
        - The index of the correct answer (0-based)
        - An optional topic or category for the question
        - An explanation for the correct answer
        Format the output as a JSON array of objects, each matching the following schema:
        {
          "question": "string",
          "choices": ["string", "string", "string", "string"],
          "answerIndex": 0,
          "topic": "string", // optional
          "explanation": "string"
        }
        Ensure the questions are relevant to the subject and suitable for a quiz format.
        `;

        logger.info(`Starting quiz generation for subject: ${subject}`);

        const { response, stream } = ai.generateStream({
          prompt: prompt,
          config: {
            maxOutputTokens: 1024,
            temperature: 1.0,
            topP: 0.95,
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
            { subject },
          );
          throw new Error('No valid quiz items generated.');
        }

        logger.info(
          `Generated quiz items: ${JSON.stringify(actualQuizItems, null, 2)}`,
          { structuredData: true },
        );
        return actualQuizItems;
      } catch (error) {
        logger.error(
          `Error in quizGenerator for subject '${subject}':`,
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
    logger.info(`Handling /genkit request with cert_name: ${cert_name}`);

    const quizList = await quizGenerator(cert_name);

    logger.info(
      `Genkit handler response for cert_name '${cert_name}': ${inspect(
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
