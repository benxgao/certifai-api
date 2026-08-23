import { z, FlowSideChannel, Genkit } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import type { ExamPlan, ExamPlannerInputData } from '../../types/genkit';

import logger from '../firebase/logger';
import { setRtdbValue } from '../firebase/rtdb';
import type { RtdbValue } from '../firebase/rtdb';
import { parseStructuredReport } from '../../types/examReport';
import { buildAdaptiveTopicInstructions } from './adaptiveTopics';
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
  lastExamReport: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Optional exam report from the last completed exam used for adaptive learning',
    ),
});

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
  lastExamReport: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Optional exam report from the last completed exam to inform adaptive topic generation',
    ),
});

// Helper function to build the exam planning prompt
const buildExamPlanPrompt = (
  cert_name: string,
  totalQuestionCounts: number,
  customPrompt?: string,
  lastExamReport?: string,
): string => {
  const basePrompt = `Generate a generic list of exam topics for the ${cert_name} certification.

    REQUIREMENTS:
    1. Create exactly ${totalQuestionCounts} exam topics (topics may be duplicated, especially for weak areas)
    2. Topics should come from the exam guide of the ${cert_name} certification
    3. Each topic should be 1-2 words
    4. Topics should be realistic and aligned with actual certification content
    5. DUPLICATE topics as needed to reinforce weak areas (see adaptive instructions below)
    6. A topic using 2 words is more preferable than that contains 1 word with camelCase or snake_case
    7. Select high level concepts as the topic names rather than detailed subtopics if customPrompt is empty
    8. Avoid using overly technical jargon or abbreviations that are not widely recognized
    9. Avoid using overly broad or vague terms that do not clearly define a specific area

    TOPIC EXAMPLES:
    - "IAM"
    - "VPC Network"
    - "IAM" (duplicated for reinforcement)
    - "Load Balancing"
    - "Kubernetes"
    - "API Gateway"`;

  const customSection = customPrompt?.trim()
    ? `

    ADDITIONAL FOCUS (the below rules should override any of the above requirements if there are any conflicts):
    ${customPrompt.trim()}`
    : '';

  const adaptiveSection = lastExamReport?.trim()
    ? buildAdaptiveTopicInstructions(lastExamReport)
    : '';

  const formatSection = `

    Return the response as a JSON array of strings, where each string is a topic (topics may be duplicated for reinforcement):
    ["Topic 1", "Topic 2", "Topic 3", ...]

    Generate exactly ${totalQuestionCounts} relevant topics for ${cert_name}. DUPLICATE weak topics as needed to reinforce learning.`;

  return basePrompt + customSection + adaptiveSection + formatSection;
};

// Use the shared singleton AI instance
const aiInstancePromise: Promise<Genkit> = createAiInstancePromise();

export const examPlannerPromise = aiInstancePromise
  .then((ai) => {
    return ai.defineFlow(
      {
        name: 'examPlanner',
        inputSchema: ExamPlannerInput,
        outputSchema: ExamPlanSchema,
        streamSchema: z.string(),
      },
      async (
        input: ExamPlannerInputData,
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
            lastExamReport,
          } = input;

          logGenerationStart('exam plan generation', {
            cert_name,
            totalQuestionCounts,
            exam_id,
            cert_id,
            user_id,
            customPrompt: customPrompt?.substring(0, 100),
            hasLastExamReport: !!lastExamReport,
            lastExamReportLength: lastExamReport?.length || 0,
            adaptiveLearningEnabled: !!lastExamReport,
            structuredAdaptiveLearning:
              !!lastExamReport &&
              parseStructuredReport(lastExamReport) !== null,
            enhancedTopicAllocation: !!lastExamReport,
          });

          const prompt = buildExamPlanPrompt(
            cert_name,
            totalQuestionCounts,
            customPrompt || undefined,
            lastExamReport || undefined,
          );

          // Generate topics using shared utility
          const generatedTopics = await generateWithValidation(
            ai,
            prompt,
            z.array(z.string()),
            sendChunk,
            // model uses default configured in genkit instance
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
            lastExamReport: lastExamReport ?? null,
          };

          // Store the exam plan in Firebase Realtime Database
          const rtdbPath = `exam_plans/${exam_id}`;
          await setRtdbValue(rtdbPath, examPlan as unknown as RtdbValue);

          logger.info(
            `Exam plan stored successfully in RTDB at path: ${rtdbPath}`,
            {
              exam_id,
              questionsCount: questions.length,
              cert_id,
              user_id,
              hasCustomPrompt: !!customPrompt,
              hasLastExamReport: !!lastExamReport,
              adaptiveLearningEnabled: !!lastExamReport,
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
  })
  .catch((initError) => {
    logger.error(
      'Failed to initialize examPlanner due to AI instance failure:',
      {
        error: initError instanceof Error ? initError.message : 'Unknown error',
      },
    );

    // Return a function that throws an error when called to match the expected interface
    return async (): Promise<ExamPlan> => {
      throw new Error(
        `ExamPlanner is unavailable: AI service initialization failed - ${
          initError instanceof Error ? initError.message : 'Unknown error'
        }`,
      );
    };
  });
