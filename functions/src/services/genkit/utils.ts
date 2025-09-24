import { genkit, z, Genkit } from 'genkit';
import { googleAI, gemini20Flash } from '@genkit-ai/googleai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

import logger from '../firebase/logger';
import { getSecret } from '../gcp/secretManager';

enableFirebaseTelemetry();

/**
 * Configuration options for AI generation
 */
export interface GenerationConfig {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

/**
 * Default generation configuration
 */
export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  maxOutputTokens: 4096,
  temperature: 0.3,
  topP: 0.8,
  topK: 40,
};

/**
 * Singleton Genkit AI instance - shared across all operations
 */
let genkitInstance: Genkit | null = null;

/**
 * Initialize a Genkit AI instance with Google AI plugin (singleton)
 * @returns Promise<Genkit> - Initialized AI instance
 */
export const initializeAiInstance = async (): Promise<Genkit> => {
  // Return existing instance if already initialized
  if (genkitInstance) {
    logger.info(
      'GenkitAI: instance reused - returning existing singleton instance',
    );
    return genkitInstance;
  }

  try {
    logger.info('GenkitAI: creating new instance - no existing instance found');

    const apiKey = await getSecret('GOOGLE_GENAI_API_KEY');

    genkitInstance = genkit({
      plugins: [googleAI({ apiKey })],
      model: gemini20Flash,
    });

    logger.info('GenkitAI: New instance created and cached successfully');

    return genkitInstance;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`GenkitAI: Failed to initialize instance:`, {
      error: errorMessage,
    });

    logger.error(
      'GenkitAI: All attempts to initialize instance failed. AI services will be unavailable.',
    );

    throw new Error(`Could not initialize AI services: ${errorMessage}`);
  }
};

/**
 * Handle AI stream processing and send chunks to client
 * @param stream - The AI response stream
 * @param sendChunk - Function to send chunks to client
 */
export const processAiStream = async (
  stream: any,
  sendChunk: (chunk: string) => void,
): Promise<void> => {
  for await (const chunk of stream) {
    if (chunk.text) {
      sendChunk(chunk.text);
    }
  }
};

/**
 * Validate and filter array responses from AI generation
 * @param response - AI response array
 * @param validator - Function to validate each item
 * @param itemName - Name of items for logging
 * @returns Filtered valid items
 */
export const validateAndFilterResponse = <T>(
  response: T[] | null,
  validator: (item: T) => boolean,
  itemName: string = 'items',
): T[] => {
  if (!response || response.length === 0) {
    logger.warn(`AI response was null, empty, or not in the expected format.`);
    throw new Error(`No valid ${itemName} generated.`);
  }

  const validItems = response.filter(validator);

  if (validItems.length === 0) {
    logger.error(`No ${itemName} generated with valid data after filtering`);
    throw new Error(`No ${itemName} generated with valid data after filtering`);
  }

  if (validItems.length < response.length) {
    logger.warn(
      `Filtered out ${response.length - validItems.length} invalid ${itemName}`,
    );
  }

  return validItems;
};

/**
 * Generate AI response with streaming and validation
 * @param ai - Genkit AI instance
 * @param prompt - Prompt for generation
 * @param schema - Zod schema for output validation
 * @param sendChunk - Function to send chunks to client
 * @param config - Generation configuration
 * @returns Generated and validated response
 */
export const generateWithValidation = async <T>(
  ai: Genkit,
  prompt: string,
  schema: z.ZodSchema<T>,
  sendChunk: (chunk: string) => void,
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
): Promise<T> => {
  const { response, stream } = ai.generateStream({
    prompt,
    config: {
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
    },
    output: { schema },
  });

  await processAiStream(stream, sendChunk);

  const generateResponse = await response;
  const output = generateResponse.output;

  if (!output) {
    throw new Error('AI response was null or empty');
  }

  return output;
};

/**
 * Singleton AI instance promise - shared across all flows
 */
let aiInstancePromise: Promise<Genkit> | null = null;

/**
 * Create or return the singleton AI instance promise with timeout protection
 */
export const createAiInstancePromise = (): Promise<Genkit> => {
  if (!aiInstancePromise) {
    logger.info('Creating new Genkit AI instance...');

    // Create a timeout wrapper around the initialization
    const timeoutMs = 45000; // 45 seconds timeout
    const initWithTimeout = Promise.race([
      initializeAiInstance(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `AI instance initialization timed out after ${timeoutMs}ms`,
              ),
            ),
          timeoutMs,
        ),
      ),
    ]);

    // Handle failures by resetting both promises so they can be retried later
    aiInstancePromise = initWithTimeout.catch((error) => {
      logger.error(
        'AI instance initialization failed, resetting singletons for retry:',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      aiInstancePromise = null; // Reset so it can be retried
      genkitInstance = null; // Reset genkit instance so it can be retried
      throw error;
    });
  }
  return aiInstancePromise;
};

/**
 * Standard error handler for AI generation flows
 * @param error - The error that occurred
 * @param context - Context information for logging
 * @param operation - Name of the operation that failed
 */
export const handleGenerationError = (
  error: unknown,
  context: Record<string, any>,
  operation: string,
): never => {
  logger.error(`Error in ${operation}:`, { ...context, error: error as any });
  throw new Error(
    `Failed to ${operation}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
};

/**
 * Log generation start with structured data
 * @param operation - Operation name
 * @param params - Parameters for logging
 */
export const logGenerationStart = (
  operation: string,
  params: Record<string, any>,
): void => {
  const logMessage = Object.entries(params)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  logger.info(`Starting ${operation} with ${logMessage}`);
};

/**
 * Log generation completion with structured data
 * @param operation - Operation name
 * @param result - Result object
 * @param metadata - Additional metadata
 */
export const logGenerationComplete = (
  operation: string,
  result: any,
  metadata: Record<string, any> = {},
): void => {
  logger.info(
    `Generated ${operation} result: ${JSON.stringify(result, null, 2)}`,
    {
      structuredData: true,
      ...metadata,
    },
  );
};
