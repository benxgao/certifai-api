import { genkit, z, Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { GenerationConfig } from '../../types/genkit';

import logger from '../firebase/logger';
import { getSecret } from '../gcp/secretManager';

enableFirebaseTelemetry();

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
 * Default Genkit AI model for text generation
 */
export const DEFAULT_GENAI_MODEL = 'gemini-2.5-flash';

/**
 * Singleton Genkit AI instance - shared across all operations
 */
let genkitInstance: Genkit | null = null;

/**
 * Tracks cumulative initialization attempts across the function instance lifetime.
 * Helps correlate retry bursts in logs.
 */
let initAttemptCount = 0;

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

  logger.info('GenkitAI: creating new instance - no existing instance found', {
    gcpProjectNumberPresent: !!process.env.GCP_PROJECT_NUMBER,
    nodeEnv: process.env.NODE_ENV,
  });

  let secretElapsedMs: number | undefined;

  try {
    const secretStart = Date.now();
    const apiKey = await getSecret('GOOGLE_GENAI_API_KEY');
    secretElapsedMs = Date.now() - secretStart;

    logger.info('GenkitAI: secret fetched successfully', {
      elapsedMs: secretElapsedMs,
      apiKeyPresent: apiKey.length > 0,
    });

    const genkitStart = Date.now();
    genkitInstance = genkit({
      plugins: [googleAI({ apiKey })],
    });

    logger.info('GenkitAI: New instance created and cached successfully', {
      genkitInitElapsedMs: Date.now() - genkitStart,
      secretElapsedMs,
    });

    return genkitInstance;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error(`GenkitAI: Failed to initialize instance:`, {
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorStack: error instanceof Error ? error.stack : undefined,
      gcpProjectNumberPresent: !!process.env.GCP_PROJECT_NUMBER,
      secretElapsedMs,
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
  stream: AsyncIterable<{ text?: string }>,
  sendChunk: (chunk: string) => void,
): Promise<void> => {
  try {
    for await (const chunk of stream) {
      if (chunk.text) {
        sendChunk(chunk.text);
      }
    }
  } catch (streamError) {
    const errorMessage =
      streamError instanceof Error ? streamError.message : String(streamError);
    logger.error('Error processing AI response stream:', {
      error: errorMessage,
      streamErrorType: streamError?.constructor?.name,
    });
    throw streamError;
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
 * @param model - AI model to use (e.g., googleAI.model('gemini-2.5-flash'))
 * @returns Generated and validated response
 */
export const generateWithValidation = async <T>(
  ai: Genkit,
  prompt: string,
  schema: z.ZodSchema<T>,
  sendChunk: (chunk: string) => void,
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
  model?: ReturnType<typeof googleAI.model>,
): Promise<T> => {
  type GenerateStreamParams = {
    prompt: string;
    config: {
      maxOutputTokens?: number;
      temperature?: number;
      topP?: number;
      topK?: number;
    };
    output: { schema: z.ZodSchema<T> };
    model?: ReturnType<typeof googleAI.model>;
  };
  const generateParams: GenerateStreamParams = {
    prompt,
    config: {
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
    },
    output: { schema },
  };

  // Add model if provided (required when no default model in genkit config)
  if (model) {
    generateParams.model = model;
  }

  try {
    const { response, stream } = ai.generateStream(generateParams);

    await processAiStream(stream, sendChunk);

    const generateResponse = await response;
    const output = generateResponse.output;

    if (!output) {
      logger.warn('AI response output was null or empty', {
        hasOutput: !!generateResponse?.output,
      });
      throw new Error('AI response was null or empty');
    }

    return output;
  } catch (validationError) {
    logger.error('Error in generateWithValidation:', {
      error:
        validationError instanceof Error
          ? validationError.message
          : String(validationError),
      configUsed: {
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
      },
      modelUsed: model ? 'custom' : 'default',
    });
    throw validationError;
  }
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
    initAttemptCount += 1;
    const attemptNumber = initAttemptCount;
    const startTime = Date.now();

    logger.info('GenkitAI: initiating singleton promise', {
      attemptNumber,
      gcpProjectNumberPresent: !!process.env.GCP_PROJECT_NUMBER,
    });

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
      const elapsedMs = Date.now() - startTime;
      const isTimeout =
        error instanceof Error && error.message.includes('timed out');

      logger.error(
        'AI instance initialization failed, resetting singletons for retry:',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
          errorStack: error instanceof Error ? error.stack : undefined,
          isTimeout,
          elapsedMs,
          attemptNumber,
          gcpProjectNumberPresent: !!process.env.GCP_PROJECT_NUMBER,
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
  context: Record<string, unknown>,
  operation: string,
): never => {
  logger.error(`Error in ${operation}:`, { ...context, error: error instanceof Error ? error.message : String(error) });
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
  params: Record<string, unknown>,
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
  result: unknown,
  metadata: Record<string, unknown> = {},
): void => {
  logger.info(
    `Generated ${operation} result: ${JSON.stringify(result, null, 2)}`,
    {
      structuredData: true,
      ...metadata,
    },
  );
};

/**
 * Export googleAI instance for model creation in service flows
 * Use: googleAI.model('gemini-2.5-flash') to create model references
 */
export { googleAI };
