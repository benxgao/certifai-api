import { z } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

import logger from '../firebase/logger';
import {
  createAiInstancePromise,
  generateWithValidation,
  handleGenerationError,
  logGenerationStart,
  logGenerationComplete,
  DEFAULT_GENERATION_CONFIG,
} from './utils';

enableFirebaseTelemetry();

const KnowledgeInsightSchema = z.object({
  insight: z
    .string()
    .describe(
      'A key concept, tip, or knowledge point that the user should remember',
    ),
  context: z
    .string()
    .describe(
      'Additional context or explanation for why this insight is important',
    ),
  topic: z.string().describe('The topic/subject area this insight relates to'),
});

const KnowledgePoolingSchema = z.object({
  knowledge_insights: z
    .array(KnowledgeInsightSchema)
    .describe(
      'Array of knowledge insights for areas where the user had incorrect answers',
    ),
  summary: z
    .string()
    .describe(
      'A brief summary of the main areas where the user needs to focus their learning',
    ),
});

/**
 * Knowledge Pooling Generator Flow
 * Analyzes incorrect answers from all user exams under a certification
 * and generates knowledge insights and tips for better understanding
 */
export const createKnowledgePoolingGeneratorFlow = async (): Promise<any> => {
  try {
    const ai = await createAiInstancePromise();

    const knowledgePoolingGeneratorFlow = ai.defineFlow(
      {
        name: 'knowledgePoolingGenerator',
        inputSchema: z.object({
          user_id: z.string(),
          exam_id: z.string(),
          cert_id: z.number(),
          certification_name: z.string(),
          incorrect_answers_data: z.array(
            z.object({
              exam_id: z.string(),
              question_id: z.string(),
              topic: z.string().nullable(),
              question_text: z.string(),
              correct_answer: z.string(),
              user_selected_answer: z.string(),
              explanation: z.string().nullable(),
            }),
          ),
        }),
        outputSchema: KnowledgePoolingSchema,
      },
      async (input) => {
        const {
          user_id,
          exam_id,
          cert_id,
          certification_name,
          incorrect_answers_data,
        } = input;

        logGenerationStart('knowledgePoolingGenerator', {
          user_id,
          exam_id,
          cert_id,
          certification_name,
          total_incorrect_answers: incorrect_answers_data.length,
        });

        try {
          const questionsAnalysis = incorrect_answers_data
            .slice(0, 10)
            .map((answer, idx) => {
              return `${idx + 1}. Question: "${answer.question_text.substring(
                0,
                150,
              )}..."
   User selected: "${answer.user_selected_answer}"
   Correct answer: "${answer.correct_answer}"
   ${
     answer.explanation
       ? `Explanation: "${answer.explanation.substring(0, 200)}..."`
       : ''
   }
   ${answer.topic ? `Topic: ${answer.topic}` : ''}`;
            });

          const prompt = `
As an AI learning advisor for ${certification_name} certification, analyze the incorrect answers from this specific exam and generate targeted knowledge insights and tips.

USER LEARNING DATA:
- User ID: ${user_id}
- Exam ID: ${exam_id}
- Certification: ${certification_name}
- Total Incorrect Answers: ${incorrect_answers_data.length}

INCORRECT ANSWERS ANALYSIS:
${questionsAnalysis.join('\n\n')}

GENERATE KNOWLEDGE INSIGHTS:
Based on the incorrect answers above, provide individual insights that will help the user avoid similar mistakes. Each insight should include:

1. A specific concept, tip, or knowledge point the user should remember
2. Clear context explaining why this insight matters
3. The relevant topic/subject area this insight relates to
4. Focused on preventing similar mistakes
5. Concise but comprehensive

Requirements:
- Generate 3-8 individual insights (not grouped, but each should include its topic)
- Make each insight standalone and specific
- Provide clear context for why each insight matters
- Include the relevant topic for each insight (e.g., "VPC Networking", "IAM Policies", etc.)
- Keep insights concise but comprehensive
- Focus on areas where the user made mistakes in this specific exam

Generate knowledge insights that will help the user avoid similar mistakes in future exams.
`;

          // Simplified chunk handler
          const sendChunk = () => {
            // Stream handling placeholder for future use
          };

          const response = await generateWithValidation(
            ai,
            prompt,
            KnowledgePoolingSchema,
            sendChunk,
            {
              ...DEFAULT_GENERATION_CONFIG,
              maxOutputTokens: 2048,
              temperature: 0.4,
            },
          );

          const result = {
            knowledge_insights: response.knowledge_insights,
            summary: response.summary,
            metadata: {
              user_id,
              exam_id,
              cert_id,
              certification_name,
              total_incorrect_answers: incorrect_answers_data.length,
              topics_analyzed: 0,
              generated_at: new Date().toISOString(),
            },
          };

          logGenerationComplete('knowledgePoolingGenerator', result, {
            user_id,
            exam_id,
            cert_id,
            total_insights: response.knowledge_insights.length,
          });

          return {
            knowledge_insights: response.knowledge_insights,
            summary: response.summary,
          };
        } catch (error) {
          handleGenerationError(
            error,
            { user_id, exam_id, cert_id },
            'knowledge pooling generation',
          );
          throw error;
        }
      },
    );

    return knowledgePoolingGeneratorFlow;
  } catch (error) {
    logger.error(
      'Failed to create knowledge pooling generator flow:',
      error as any,
    );
    throw error;
  }
};

/**
 * Singleton promise for the knowledge pooling generator flow
 */
let knowledgePoolingGeneratorPromise: Promise<any> | null = null;

/**
 * Get or create the knowledge pooling generator flow
 */
export const getKnowledgePoolingGeneratorFlow = (): Promise<any> => {
  if (!knowledgePoolingGeneratorPromise) {
    knowledgePoolingGeneratorPromise = createKnowledgePoolingGeneratorFlow();
  }
  return knowledgePoolingGeneratorPromise;
};

// Initialize the promise for use in handlers
knowledgePoolingGeneratorPromise = createKnowledgePoolingGeneratorFlow();

// Export the promise for use in handlers
export { knowledgePoolingGeneratorPromise };
