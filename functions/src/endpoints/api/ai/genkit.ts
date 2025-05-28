import { inspect } from 'util';
import { genkit, z, FlowSideChannel } from 'genkit';
import { Request, Response } from 'express';

// Import models from the Vertex AI plugin. The Vertex AI API provides access to
// several generative models. Here, we import Gemini 1.5 Flash.
import { vertexAI, gemini20Flash } from '@genkit-ai/vertexai';

// Cloud Functions for Firebase supports Genkit natively. The onCallGenkit function creates a callable
// function from a Genkit action. It automatically implements streaming if your flow does.
// The https library also has other utility methods such as hasClaim, which verifies that
// a caller's token has a specific claim (optionally matching a specific value)
// import { onCallGenkit } from 'firebase-functions/https';

// Genkit models generally depend on an API key. APIs should be stored in Cloud Secret Manager so that
// access to these sensitive values can be controlled. defineSecret does this for you automatically.
// If you are using Google generative AI you can get an API key at https://aistudio.google.com/app/apikey
import { defineSecret } from 'firebase-functions/params';

import logger from '../../../services/firebase/logger';

const apiKey = defineSecret('GOOGLE_GENAI_API_KEY');

logger.info(`Genkit API key: ${inspect(apiKey)}`);

const ai = genkit({
  plugins: [
    // Load the Vertex AI plugin. You can optionally specify your project ID
    // by passing in a config object; if you don't, the Vertex AI plugin uses
    // the value from the GCLOUD_PROJECT environment variable.
    vertexAI({ location: 'us-central1' }),
  ],
  model: gemini20Flash,
});

const MenuItemSchema = z.object({
  name: z.string().describe('The name of the menu item.'),
  description: z.string().describe('A description of the menu item.'),
  calories: z.number().describe('The estimated number of calories.'),
  allergens: z
    .array(z.string())
    .describe('Any known allergens in the menu item.'),
});

// Infer the TypeScript type from the Zod schema
type MenuItem = z.infer<typeof MenuItemSchema>;

// Define a simple flow that prompts an LLM to generate menu suggestions.
export const menuSuggestionFlow = ai.defineFlow(
  {
    name: 'menuSuggestionFlow',
    inputSchema: z.string().describe('A restaurant theme').default('seafood'),
    outputSchema: z.array(MenuItemSchema), // Output schema remains the Zod schema
    streamSchema: z.string(),
  },
  async (
    subject: string,
    { sendChunk }: FlowSideChannel<string>,
  ): Promise<MenuItem[]> => {
    // Corrected return type to MenuItem[]
    try {
      const prompt = `Suggest 3 items for the menu of a ${subject} themed restaurant. Ensure the output is a valid JSON array matching the provided schema.`;
      const { response, stream } = ai.generateStream({
        prompt: prompt,
        config: {
          maxOutputTokens: 1024,
          temperature: 1.0,
          topP: 0.95,
          topK: 40,
        },
        output: { schema: z.array(MenuItemSchema) }, // Ensure this matches the flow's outputSchema for consistency
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          sendChunk(chunk.text);
        }
      }

      const generateResponse = await response;
      // Access .output as a property. It can be MenuItem[] | null.
      const actualMenuItems: MenuItem[] | null = generateResponse.output;

      logger.info(
        `Genkit awaited response: ${JSON.stringify(actualMenuItems, null, 2)}`,
        {
          structuredData: true,
        },
      );

      if (!actualMenuItems || actualMenuItems.length === 0) {
        logger.warn(
          'Genkit response was null, empty, or not in the expected format.',
          { subject },
        );
        // Throw an error if no valid menu items are returned
        throw new Error('No valid menu items generated.');
      }

      return actualMenuItems; // Now, this is guaranteed to be MenuItem[]
    } catch (error) {
      logger.error(
        `Error generating menu suggestion for subject '${subject}':`,
        error as any,
      );
      throw new Error(
        `Failed to generate menu suggestion: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
);

export const genkitHandler = async (req: Request, res: Response) => {
  try {
    // Verify Firebase ID token
    // const authHeader = req.headers.authorization;
    // if (!authHeader?.startsWith('Bearer ')) {
    //   res.status(401).json({ error: 'Unauthorized' });
    //   return;
    // }

    // const idToken = authHeader.split('Bearer ')[1];
    // await firebaseAuth.verifyIdToken(idToken);

    const theme = req.body.theme || 'seafood'; // Use default if not provided
    const answer = await menuSuggestionFlow(theme);

    logger.info(`Genkit answer: ${inspect(answer)}`, { structuredData: true });

    if (!answer) {
      throw new Error('No response from menuSuggestion');
    }

    res.status(200).json({
      success: true,
      data: answer,
    });
  } catch (error) {
    logger.error('Error in /genkit:', error as any);
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
