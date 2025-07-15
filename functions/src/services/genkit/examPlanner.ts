import { genkit, z, FlowSideChannel, Genkit } from 'genkit';
import { googleAI, gemini20Flash } from '@genkit-ai/googleai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

import logger from '../firebase/logger';
import { getSecret } from '../gcp/secretManager';
import { setRtdbValue } from '../firebase/rtdb';

enableFirebaseTelemetry();

const QuestionSchema = z.object({
  exam_topic: z.string().describe('The exam topic for this question'),
  question_id: z.string().nullable().describe('Question ID, initially null'),
});

const ExamPlanSchema = z.object({
  questions: z
    .array(QuestionSchema)
    .describe('Array of questions with topics and null question IDs'),
  cert_id: z.string().describe('Certification ID'),
  user_id: z.string().describe('User ID who created the exam plan'),
  created_at: z.number().describe('Unix timestamp when the plan was created'),
});

type ExamPlan = z.infer<typeof ExamPlanSchema>;

const ExamPlannerInput = z.object({
  cert_name: z
    .string()
    .describe('Name of IT certification')
    .default('Google Cloud'),
  totalQuestionCounts: z
    .number()
    .min(1)
    .max(200)
    .describe('Total number of questions for the exam plan')
    .default(50),
  exam_id: z.string().describe('Unique exam identifier for storing the plan'),
  cert_id: z.string().describe('Certification ID associated with the exam'),
  user_id: z.string().describe('User ID who is creating the exam plan'),
});

const initializeAiInstance = async (): Promise<Genkit> => {
  try {
    const apiKey = await getSecret('GOOGLE_GENAI_API_KEY');

    const ai = genkit({
      plugins: [googleAI({ apiKey })],
      model: gemini20Flash,
    });

    logger.info('ExamPlanner Genkit AI instance initialized successfully.');

    return ai;
  } catch (error) {
    logger.error(
      'Failed to initialize ExamPlanner Genkit AI instance:',
      error as any,
    );
    throw new Error('Could not initialize AI services.');
  }
};

// Helper function to build the exam planning prompt
const buildExamPlanPrompt = (
  cert_name: string,
  totalQuestionCounts: number,
): string => {
  return `Generate a generic list of exam topics for the ${cert_name} certification.

    REQUIREMENTS:
    1. Create exactly ${totalQuestionCounts} distinct exam topics
    2. Topics should cover all major areas of the ${cert_name} certification
    3. Each topic should be 1-2 words
    4. Topics should be realistic and aligned with actual certification content
    5. Duplicate topics are allowed
    6. Prevent using similar words to describe the same topic
    6. topic using 2 words is more preferable than 1 word with camelCase or snake_case

    TOPIC EXAMPLES:
    - "IAM"
    - "VPC Network"
    - "Database"
    - "Load Balancing"
    - "Container"
    - "API Gateway"

    Return the response as a JSON array of strings, where each string is a topic:
    ["Topic 1", "Topic 2", "Topic 3", ...]

    Generate exactly ${totalQuestionCounts} unique and relevant topics for ${cert_name}.`;
};

// Create a singleton promise for the AI instance
const aiInstancePromise: Promise<Genkit> = initializeAiInstance();

type ExamPlannerInputType = z.infer<typeof ExamPlannerInput>;

export const examPlannerPromise = aiInstancePromise.then((ai) => {
  return ai.defineFlow(
    {
      name: 'examPlanner',
      inputSchema: ExamPlannerInput,
      outputSchema: ExamPlanSchema,
      streamSchema: z.string(),
    },
    async (
      input: ExamPlannerInputType,
      { sendChunk }: FlowSideChannel<string>,
    ): Promise<ExamPlan> => {
      try {
        const { cert_name, totalQuestionCounts, exam_id, cert_id, user_id } =
          input;

        const prompt = buildExamPlanPrompt(cert_name, totalQuestionCounts);

        logger.info(
          `Starting exam plan generation for cert_name: ${cert_name}, totalQuestionCounts: ${totalQuestionCounts}, exam_id: ${exam_id}`,
        );

        const { response, stream } = ai.generateStream({
          prompt: prompt,
          config: {
            maxOutputTokens: 4096,
            temperature: 0.3,
            topP: 0.8,
            topK: 40,
          },
          output: { schema: z.array(z.string()) },
        });

        for await (const chunk of stream) {
          if (chunk.text) {
            sendChunk(chunk.text);
          }
        }

        const generateResponse = await response;
        const generatedTopics: string[] | null = generateResponse.output;

        if (!generatedTopics || generatedTopics.length === 0) {
          logger.warn(
            'Genkit response was null, empty, or not in the expected format.',
            { cert_name, totalQuestionCounts, exam_id },
          );
          throw new Error('No valid exam topics generated.');
        }

        // Filter out empty or invalid topics
        const validTopics = generatedTopics.filter(
          (topic) => topic && typeof topic === 'string' && topic.trim() !== '',
        );

        if (validTopics.length === 0) {
          logger.error('No valid topics generated after filtering');
          throw new Error('No valid topics generated after filtering');
        }

        if (validTopics.length < generatedTopics.length) {
          logger.warn(
            `Filtered out ${
              generatedTopics.length - validTopics.length
            } invalid topics`,
          );
        }

        // Transform generated topics into questions structure
        const questions = validTopics.map((topic) => ({
          exam_topic: topic,
          question_id: null,
        }));

        // Create exam plan object
        const examPlan: ExamPlan = {
          questions,
          cert_id,
          user_id,
          created_at: Math.floor(Date.now() / 1000),
        };

        // Store the exam plan in Firebase Realtime Database
        const rtdbPath = `exam_plans/${exam_id}`;
        await setRtdbValue(rtdbPath, examPlan);

        logger.info(
          `Exam plan stored successfully in RTDB at path: ${rtdbPath}`,
          {
            exam_id,
            questionsCount: questions.length,
            cert_id,
            user_id,
            structuredData: true,
          },
        );

        logger.info(
          `Generated exam plan: ${JSON.stringify(examPlan, null, 2)}`,
          { structuredData: true },
        );

        return examPlan;
      } catch (error) {
        logger.error(
          `Error in examPlanner for cert_name '${input.cert_name}', totalQuestionCounts '${input.totalQuestionCounts}', exam_id '${input.exam_id}':`,
          error as any,
        );
        throw new Error(
          `Failed to generate exam plan: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );
});
