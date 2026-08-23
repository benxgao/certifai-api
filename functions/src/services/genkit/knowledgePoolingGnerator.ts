import { z } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import type { KnowledgePoolingGeneratorFlow } from '../../types/genkit';

import logger from '../firebase/logger';
import {
  createAiInstancePromise,
  generateWithValidation,
  handleGenerationError,
  logGenerationStart,
  logGenerationComplete,
  DEFAULT_GENERATION_CONFIG,
  // googleAI,
  // DEFAULT_GENAI_MODEL,
} from './utils';

enableFirebaseTelemetry();

const KnowledgeInsightSchema = z.object({
  insight: z
    .string()
    .describe(
      'A key concept, tip, or knowledge point that the user should remember',
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
export const createKnowledgePoolingGeneratorFlow = async (): Promise<KnowledgePoolingGeneratorFlow> => {
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
          exam_guide_url: z.string().nullable(),
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
          exam_guide_url,
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
              return `${idx + 1}; ${
                answer.explanation
                  ? `Explanation: "${answer.explanation.substring(0, 300)}..."`
                  : ''
              };
   ${answer.topic ? `Topic: ${answer.topic}` : ''}`;
            });

          const prompt = `
As an AI learning advisor that specializes in ${certification_name} certification and understands the exam objectives and official exam guide, generate targeted knowledge insights and tips.

${exam_guide_url ? `OFFICIAL EXAM GUIDE: ${exam_guide_url}` : ''}

USER LEARNING DATA:
- Certification: ${certification_name}

QUESTION ANALYSIS:
${questionsAnalysis.join('\n\n')}

GENERATE KNOWLEDGE INSIGHTS:
Based on the question analysis above, provide individual insights that will help the user avoid similar mistakes. Each insight should include:

1. A specific concept or knowledge point which is the key concept to the exam
2. The relevant topic/subject area this insight relates to is encouraged to be expanded
3. The comparison of related concepts is highly encouraged to be included
4. Concise but comprehensive

Requirements:
- Generate 3-8 individual insights
- Include the relevant topic for each insight (e.g., "VPC Networking", "IAM Policies", etc.)
- Keep insights concise but comprehensive
${
  exam_guide_url
    ? `- Reference the official exam guide when applicable: ${exam_guide_url}`
    : ''
}

Generate knowledge insights which should be covered by the official exam guide.
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
              maxOutputTokens: 4096,
              temperature: 0.5,
            },
            // googleAI.model(DEFAULT_GENAI_MODEL),
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

    return knowledgePoolingGeneratorFlow as KnowledgePoolingGeneratorFlow;
  } catch (error) {
    logger.error(
      'Failed to create knowledge pooling generator flow:',
      { error: error instanceof Error ? error.message : String(error) },
    );
    throw error;
  }
};

/**
 * Singleton promise for the knowledge pooling generator flow
 */
let knowledgePoolingGeneratorPromise: Promise<KnowledgePoolingGeneratorFlow> | null = null;

/**
 * Get or create the knowledge pooling generator flow
 */
export const getKnowledgePoolingGeneratorFlow = (): Promise<KnowledgePoolingGeneratorFlow> => {
  if (!knowledgePoolingGeneratorPromise) {
    knowledgePoolingGeneratorPromise = createKnowledgePoolingGeneratorFlow();
  }
  return knowledgePoolingGeneratorPromise;
};

// Initialize the promise for use in handlers
knowledgePoolingGeneratorPromise = createKnowledgePoolingGeneratorFlow();

// Export the promise for use in handlers
export { knowledgePoolingGeneratorPromise };
