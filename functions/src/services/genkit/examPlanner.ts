import { z, FlowSideChannel, Genkit } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

import logger from '../firebase/logger';
import { setRtdbValue } from '../firebase/rtdb';
import {
  createAiInstancePromise,
  generateWithValidation,
  validateAndFilterResponse,
  handleGenerationError,
  logGenerationStart,
  logGenerationComplete,
} from './utils';

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
  customPrompt: z
    .string()
    .nullable()
    .optional()
    .describe('Optional custom prompt used to focus exam planning'),
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
  customPrompt: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Optional custom prompt text to focus on specific topics or requirements for exam planning',
    ),
});

// Helper function to build the exam planning prompt
const buildExamPlanPrompt = (
  cert_name: string,
  totalQuestionCounts: number,
  customPrompt?: string,
): string => {
  const basePrompt = `Generate a generic list of exam topics for the ${cert_name} certification.

    REQUIREMENTS:
    1. Create exactly ${totalQuestionCounts} distinct exam topics
    2. Topics should come from the exam guide of the ${cert_name} certification
    3. Each topic should be 1-2 words
    4. Topics should be realistic and aligned with actual certification content
    5. Same topic names are more preferable than using different names for the same topic
    6. Prevent using similar words to describe the same topic
    7. A topic using 2 words is more preferable than that contains 1 word with camelCase or snake_case
    8. Select high level concepts as the topic names rather than detailed subtopics
    9. Avoid using overly technical jargon or abbreviations that are not widely recognized
    10. Ensure topics are relevant to the certification's scope and objectives
    11. Avoid using overly broad or vague terms that do not clearly define a specific area

    TOPIC EXAMPLES:
    - "IAM"
    - "VPC Network"
    - "SQL"
    - "Load Balancing"
    - "Kubernetes"
    - "API Gateway"`;

  const customSection = customPrompt?.trim()
    ? `

    ADDITIONAL FOCUS (the below rules should override any of the above requirements if there are any conflicts):
    ${customPrompt.trim()}`
    : '';

  const formatSection = `

    Return the response as a JSON array of strings, where each string is a topic:
    ["Topic 1", "Topic 2", "Topic 3", ...]

    Generate exactly ${totalQuestionCounts} unique and relevant topics for ${cert_name}.`;

  return basePrompt + customSection + formatSection;
};

// Create a singleton promise for the AI instance
const aiInstancePromise: Promise<Genkit> = createAiInstancePromise();

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
        const {
          cert_name,
          totalQuestionCounts,
          exam_id,
          cert_id,
          user_id,
          customPrompt,
        } = input;

        logGenerationStart('exam plan generation', {
          cert_name,
          totalQuestionCounts,
          exam_id,
          cert_id,
          user_id,
          customPrompt: customPrompt?.substring(0, 100),
        });

        const prompt = buildExamPlanPrompt(
          cert_name,
          totalQuestionCounts,
          customPrompt || undefined,
        );

        // Generate topics using shared utility
        const generatedTopics = await generateWithValidation(
          ai,
          prompt,
          z.array(z.string()),
          sendChunk,
        );

        // Validate and filter topics using shared utility
        const validTopics = validateAndFilterResponse(
          generatedTopics,
          (topic: string) =>
            !!(topic && typeof topic === 'string' && topic.trim() !== ''),
          'exam topics',
        );

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
          customPrompt: customPrompt ?? null,
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

        logGenerationComplete('exam plan', examPlan, {
          exam_id,
          questionsCount: questions.length,
        });

        return examPlan;
      } catch (error) {
        return handleGenerationError(
          error,
          {
            cert_name: input.cert_name,
            totalQuestionCounts: input.totalQuestionCounts,
            exam_id: input.exam_id,
          },
          'generate exam plan',
        );
      }
    },
  );
});
