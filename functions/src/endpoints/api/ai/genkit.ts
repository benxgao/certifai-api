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

const MenuItemSchema = z.object({
  name: z.string().describe('The name of the menu item.'),
  description: z.string().describe('A description of the menu item.'),
  calories: z.number().describe('The estimated number of calories.'),
  allergens: z
    .array(z.string())
    .describe('Any known allergens in the menu item.'),
});

type MenuItem = z.infer<typeof MenuItemSchema>;

// Define the menu suggestion flow using the AI instance promise
// The flow itself is defined once the AI instance is ready.
const menuSuggestionFlowPromise = aiInstancePromise.then((ai) => {
  return ai.defineFlow(
    {
      name: 'menuSuggestionFlow',
      inputSchema: z.string().describe('A restaurant theme').default('seafood'),
      outputSchema: z.array(MenuItemSchema),
      streamSchema: z.string(),
    },
    async (
      subject: string,
      { sendChunk }: FlowSideChannel<string>,
    ): Promise<MenuItem[]> => {
      try {
        const prompt = `Suggest 3 items for the menu of a ${subject} themed restaurant. Ensure the output is a valid JSON array matching the provided schema.`;

        logger.info(`Generating menu suggestion for theme: ${subject}`);
        const { response, stream } = ai.generateStream({
          prompt: prompt,
          config: {
            maxOutputTokens: 1024,
            temperature: 1.0,
            topP: 0.95,
            topK: 40,
          },
          output: { schema: z.array(MenuItemSchema) },
        });

        for await (const chunk of stream) {
          if (chunk.text) {
            sendChunk(chunk.text);
          }
        }

        const generateResponse = await response;
        const actualMenuItems: MenuItem[] | null = generateResponse.output;

        if (!actualMenuItems || actualMenuItems.length === 0) {
          logger.warn(
            'Genkit response was null, empty, or not in the expected format.',
            { subject },
          );
          throw new Error('No valid menu items generated.');
        }

        logger.info(
          `Generated menu items: ${JSON.stringify(actualMenuItems, null, 2)}`,
          { structuredData: true },
        );
        return actualMenuItems;
      } catch (error) {
        logger.error(
          `Error in menuSuggestionFlow for subject '${subject}':`,
          error as any,
        );
        // Re-throw a more specific error or handle as needed
        throw new Error(
          `Failed to generate menu suggestion: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
});

export const genkitHandler = async (req: Request, res: Response) => {
  try {
    // Ensure the AI instance and flow are initialized before proceeding
    const menuSuggestionFlow = await menuSuggestionFlowPromise;

    const theme = req.body.theme || 'seafood';
    logger.info(`Handling /genkit request with theme: ${theme}`);

    const answer = await menuSuggestionFlow(theme);

    logger.info(
      `Genkit handler response for theme '${theme}': ${inspect(answer)}`,
      { structuredData: true },
    );

    res.status(200).json({
      success: true,
      data: answer,
    });
  } catch (error) {
    logger.error('Error in genkitHandler:', error as any);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    // Check if the error is due to AI initialization failure
    if (errorMessage.includes('Could not initialize AI services')) {
      res.status(503).json({
        // Service Unavailable
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
