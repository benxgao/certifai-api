import { z, FlowSideChannel, Genkit } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

import logger from '../firebase/logger';
import {
  createAiInstancePromise,
  generateWithValidation,
  validateAndFilterResponse,
  handleGenerationError,
  logGenerationStart,
  logGenerationComplete,
} from './utils';
import { parseStructuredReport } from '../../types/examReport';

enableFirebaseTelemetry();

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
  examTopicList: z
    .array(z.string())
    .min(1)
    .max(100) // Maximum 100 topics to handle larger batches
    .describe(
      'List of exam topics for this batch - one question will be generated for each topic. Duplicate topics are allowed for adaptive learning.',
    ),
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
  lastExamReport: z
    .string()
    .optional()
    .describe(
      'Optional exam report from the last completed exam to inform adaptive difficulty adjustment',
    ),
});
// Using shared AI instance initialization

// Helper function to build adaptive difficulty instructions from structured data
/**
 * Builds adaptive difficulty instructions from structured Firestore exam report data.
 *
 * @param lastExamReport - Structured JSON exam report from Firestore
 * @returns Formatted difficulty instructions for AI quiz generation
 *
 * Example output with structured data:
 * ```
 * ADAPTIVE DIFFICULTY ADJUSTMENT (precise topic-based difficulty mapping):
 * Generate questions with the following difficulty levels for each topic:
 *     - IAM and Security: ADVANCED to EXPERT level (100% accuracy)
 *     - Compute Engine: EASY to INTERMEDIATE level (40% accuracy)
 *     - VPC and Networking: INTERMEDIATE level (67% accuracy)
 *
 * For topics not mentioned above: Generate INTERMEDIATE level questions.
 * Previous exam performance: 75% overall score
 * ```
 */
const buildAdaptiveDifficultyInstructions = (
  lastExamReport: string,
): string => {
  // Parse structured data from Firestore exam report (required)
  const structuredData = parseStructuredReport(lastExamReport);

  if (!structuredData?.topic_performance) {
    throw new Error(
      'Invalid or missing structured exam report data. Cannot generate adaptive quiz without structured performance data.',
    );
  }

  // Use structured data for precise difficulty mapping
  const topicInstructions = structuredData.topic_performance
    .map((topic) => {
      let difficultyLevel: string;
      switch (topic.performance_category) {
        case 'strong':
          difficultyLevel = 'ADVANCED to EXPERT';
          break;
        case 'weak':
          difficultyLevel = 'EASY to INTERMEDIATE';
          break;
        default:
          difficultyLevel = 'INTERMEDIATE';
      }

      return `    - ${topic.topic}: ${difficultyLevel} level (${Math.round(
        topic.accuracy_rate * 100,
      )}% accuracy)`;
    })
    .join('\n');

  return `

    ADAPTIVE DIFFICULTY ADJUSTMENT (precise topic-based difficulty mapping):
    Generate questions with the following difficulty levels for each topic:
${topicInstructions}

    For topics not mentioned above: Generate INTERMEDIATE level questions.
    Previous exam performance: ${structuredData.overall_score}% overall score`;
};

// Helper function to build the quiz generation prompt
const buildQuizPrompt = (
  subject: string,
  examTopicList: string[],
  customPromptText?: string,
  lastExamReport?: string,
): string => {
  const count = examTopicList.length;
  const topicsSection = examTopicList
    .map((topic, index) => `${index + 1}. ${topic}`)
    .join('\n    ');

  const basePrompt = `Generate ${count} realistic ${subject} certification exam questions.
    Each question MUST focus on one of the following specific topics (use the exact topic name as examTopic):
    ${topicsSection}

    NOTE: Some topics may appear multiple times in the list above for adaptive learning. Generate a UNIQUE question for EACH occurrence.

    REQUIREMENTS:
    1. Sophisticated distractors requiring expertise
    2. All 4 choices plausible and technically accurate
    3. Wrong answers: common misconceptions, not obvious fakes
    4. Make questions text simple and clear, avoiding unnecessary complexity
    5. examTopic MUST be the exact topic name from the list above for each question
    6. Each provided exam topic must have a corresponding question (including duplicates)
    7. For duplicate topics, create different questions that test different aspects of the same topic

    CONSTRUCTION:
    - Business scenarios with specific constraints
    - Exact 4 options, can be commands, code snippets, or concepts
    - Each question MUST use one of the provided examTopic values exactly as listed
    - For repeated topics, vary the question content while keeping the same examTopic value
  `;

  const customSection = customPromptText?.trim()
    ? `ADDITIONAL FOCUS (the below rules should be applied with each examTopic):${customPromptText.trim()}`
    : '';

  const adaptiveDifficultySection = lastExamReport?.trim()
    ? buildAdaptiveDifficultyInstructions(lastExamReport)
    : '';

  const formatSection = `
    JSON format:[{
      "question": "string",
      "choices": ["string", "string", "string", "string"],
      "answerIndex": 0,
      "explanation": "string",
      "examTopic": "string (REQUIRED - must be one of the exact topic names from the list above)"
    }]

    Explanation: simple sentences to explain why correct option is correct and why wrong answers are wrong.
    IMPORTANT:
    - Each question MUST have an examTopic value that exactly matches one of the provided topic names.
    - For duplicate topics in the list, create different questions with the same examTopic value.
    - Generate exactly ${count} questions, one for each topic occurrence (including duplicates).
  `;

  return basePrompt + customSection + adaptiveDifficultySection + formatSection;
};

// Use the shared singleton AI instance
const aiInstancePromise: Promise<Genkit> = createAiInstancePromise();

type QuizGeneratorInputType = z.infer<typeof QuizGeneratorInput>;

// MARKED pass in users prompt text
export const quizGeneratorPromise = aiInstancePromise
  .then((ai) => {
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
          const {
            subject,
            examTopicList,
            exam_id,
            customPromptText,
            lastExamReport,
          } = input;
          const count = examTopicList.length;
          const uniqueTopics = [...new Set(examTopicList)];
          const duplicateTopics = examTopicList.filter(
            (topic, index) => examTopicList.indexOf(topic) !== index,
          );

          logGenerationStart('quiz generation', {
            subject,
            count,
            exam_id,
            examTopicList: examTopicList.join(', '),
            uniqueTopicsCount: uniqueTopics.length,
            duplicateTopicsCount: duplicateTopics.length,
            duplicateTopics:
              duplicateTopics.length > 0 ? [...new Set(duplicateTopics)] : [],
            customPromptText: customPromptText?.substring(0, 100),
            hasLastExamReport: !!lastExamReport,
            adaptiveDifficultyEnabled: !!lastExamReport,
            adaptiveLearningWithDuplicates:
              !!lastExamReport && duplicateTopics.length > 0,
          });

          const prompt = buildQuizPrompt(
            subject,
            examTopicList,
            customPromptText,
            lastExamReport,
          );

          // Generate quiz items using shared utility with custom config
          const actualQuizItems = await generateWithValidation(
            ai,
            prompt,
            z.array(QuizSchema),
            sendChunk,
            {
              maxOutputTokens: 4096 * 100,
              temperature: 0.6,
              topP: 0.9,
              topK: 40,
            },
          );

          // Validate and filter questions with missing examTopic using shared utility
          // Use normalized comparison to handle case differences and whitespace
          const validQuizItems = validateAndFilterResponse(
            actualQuizItems,
            (item: QuizItem) => {
              if (!item.examTopic || item.examTopic.trim() === '') {
                return false;
              }

              // Normalize the generated topic for comparison
              const normalizedGenerated = item.examTopic
                .trim()
                .toLowerCase()
                .replace(/\s+/g, ' ');

              // Check if any of the expected topics match (normalized)
              return examTopicList.some((expectedTopic) => {
                const normalizedExpected = expectedTopic
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, ' ');
                return normalizedExpected === normalizedGenerated;
              });
            },
            'quiz items with valid examTopic from the provided list',
          );

          // Associate exam_id with each quiz item
          const quizItemsWithExamId = validQuizItems.map((item) => ({
            ...item,
            exam_id,
          }));

          logGenerationComplete('quiz items', quizItemsWithExamId, {
            count: quizItemsWithExamId.length,
            exam_id,
            examTopicList: examTopicList.join(', '),
          });

          return quizItemsWithExamId;
        } catch (error) {
          return handleGenerationError(
            error,
            {
              subject: input.subject,
              examTopicList: input.examTopicList.join(', '),
              exam_id: input.exam_id,
            },
            'generate quiz items',
          );
        }
      },
    );
  })
  .catch((initError) => {
    logger.error(
      'Failed to initialize quizGenerator due to AI instance failure:',
      {
        error: initError instanceof Error ? initError.message : 'Unknown error',
      },
    );

    // Return a function that throws an error when called to match the expected interface
    return async (): Promise<QuizItem[]> => {
      throw new Error(
        `QuizGenerator is unavailable: AI service initialization failed - ${
          initError instanceof Error ? initError.message : 'Unknown error'
        }`,
      );
    };
  });
