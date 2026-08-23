/**
 * Certification Summary Generator Flow
 * Analyzes multiple exam reports and generates comprehensive certification summaries
 */

import { z } from 'genkit';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import type { CertSummaryGeneratorFlow } from '../../types/genkit';

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

const CertSummarySchema = z.object({
  summary: z
    .string()
    .describe(
      'A comprehensive 200-300 word certification journey summary highlighting progress, mastery, and recommendations',
    ),
  learning_insights: z
    .object({
      mastery_progression: z
        .string()
        .describe(
          'Analysis of how the learner has progressed across multiple exams',
        ),
      consistency_analysis: z
        .string()
        .describe('Assessment of performance consistency and patterns'),
      readiness_assessment: z
        .string()
        .describe('Evaluation of readiness for actual certification exam'),
    })
    .describe(
      'Detailed insights about the learning journey and certification readiness',
    ),
});

/**
 * Certification Summary Generator Flow
 * Analyzes multiple exam performance data and generates comprehensive learning journey summaries
 */
export const createCertSummaryGeneratorFlow = async (): Promise<CertSummaryGeneratorFlow> => {
  try {
    const ai = await createAiInstancePromise();

    const certSummaryGeneratorFlow = ai.defineFlow(
      {
        name: 'certSummaryGenerator',
        inputSchema: z.object({
          user_id: z.string(),
          cert_id: z.string(),
          certification_name: z.string(),
          total_exams_taken: z.number(),
          average_score: z.number(),
          best_score: z.number(),
          worst_score: z.number(),
          performance_trend: z.enum(['improving', 'declining', 'stable']),
          topic_mastery: z.array(
            z.object({
              topic: z.string(),
              exams_covered: z.number(),
              average_accuracy: z.number(),
              mastery_level: z.enum([
                'novice',
                'developing',
                'proficient',
                'advanced',
                'expert',
              ]),
              total_questions: z.number(),
              total_correct: z.number(),
            }),
          ),
          strong_topics: z.array(z.string()),
          weak_topics: z.array(z.string()),
          overall_accuracy_rate: z.number(),
        }),
        outputSchema: CertSummarySchema,
      },
      async (input) => {
        const {
          user_id,
          cert_id,
          certification_name,
          total_exams_taken,
          average_score,
          best_score,
          worst_score,
          performance_trend,
          topic_mastery,
          strong_topics,
          weak_topics,
          overall_accuracy_rate,
        } = input;

        logGenerationStart('certSummaryGenerator', {
          user_id,
          cert_id,
          certification_name,
          total_exams: total_exams_taken,
          average_score: `${average_score}%`,
          performance_trend,
          topics_analyzed: topic_mastery.length,
        });

        try {
          // Analyze mastery levels distribution
          const masteryDistribution = topic_mastery.reduce((acc, topic) => {
            acc[topic.mastery_level] = (acc[topic.mastery_level] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Identify most and least consistent topics
          const mostConsistent = topic_mastery
            .filter((topic) => topic.exams_covered >= 2)
            .sort((a, b) => b.average_accuracy - a.average_accuracy)
            .slice(0, 3);

          const leastConsistent = topic_mastery
            .filter((topic) => topic.exams_covered >= 2)
            .sort((a, b) => a.average_accuracy - b.average_accuracy)
            .slice(0, 3);

          // Calculate overall readiness score
          const expertTopics = masteryDistribution.expert || 0;
          const advancedTopics = masteryDistribution.advanced || 0;
          const proficientTopics = masteryDistribution.proficient || 0;
          const totalMasteredTopics =
            expertTopics + advancedTopics + proficientTopics;
          const readinessScore = Math.round(
            (totalMasteredTopics / topic_mastery.length) * 100,
          );

          const prompt = `
As an AI certification advisor, analyze this comprehensive learning journey for ${certification_name} certification and provide a detailed summary.

CERTIFICATION LEARNING JOURNEY DATA:
- Total Practice Exams Taken: ${total_exams_taken}
- Average Score: ${average_score}% (Best: ${best_score}%, Worst: ${worst_score}%)
- Overall Accuracy Rate: ${Math.round(overall_accuracy_rate * 100)}%
- Performance Trend: ${performance_trend}
- Topics Analyzed: ${topic_mastery.length}

MASTERY LEVEL DISTRIBUTION:
- Expert Level: ${masteryDistribution.expert || 0} topics
- Advanced Level: ${masteryDistribution.advanced || 0} topics
- Proficient Level: ${masteryDistribution.proficient || 0} topics
- Developing Level: ${masteryDistribution.developing || 0} topics
- Novice Level: ${masteryDistribution.novice || 0} topics

STRONGEST AREAS (${strong_topics.length} topics):
${strong_topics
  .slice(0, 5)
  .map((topic) => `- ${topic}`)
  .join('\n')}

AREAS FOR IMPROVEMENT (${weak_topics.length} topics):
${weak_topics
  .slice(0, 5)
  .map((topic) => `- ${topic}`)
  .join('\n')}

MOST CONSISTENT PERFORMANCE:
${mostConsistent
  .map(
    (topic) =>
      `- ${topic.topic} (${Math.round(topic.average_accuracy * 100)}% across ${
        topic.exams_covered
      } exams)`,
  )
  .join('\n')}

LEAST CONSISTENT PERFORMANCE:
${leastConsistent
  .map(
    (topic) =>
      `- ${topic.topic} (${Math.round(topic.average_accuracy * 100)}% across ${
        topic.exams_covered
      } exams)`,
  )
  .join('\n')}

Generate a comprehensive certification summary that:
1. Provides an overview of the learning journey across ${total_exams_taken} practice exams
2. Highlights the performance trend (${performance_trend}) and what it indicates
3. Celebrates mastery achievements and areas of strength
4. Identifies specific areas that need focused attention
5. Assesses overall readiness for the actual certification exam (current readiness: ~${readinessScore}%)
6. Provides actionable next steps and study recommendations
7. Mentions specific topic names and performance patterns
8. Uses an encouraging but realistic tone

Keep the summary between 200-300 words, be specific about topic names and performance patterns, and provide practical guidance for certification success.
`;

          // Simplified chunk handler
          const sendChunk = () => {
            // Stream handling placeholder for future use
          };

          const response = await generateWithValidation(
            ai,
            prompt,
            CertSummarySchema,
            sendChunk,
            {
              ...DEFAULT_GENERATION_CONFIG,
              maxOutputTokens: 600, // Increased for comprehensive summary
              temperature: 0.4, // Balanced creativity and consistency
            },
            // googleAI.model(DEFAULT_GENAI_MODEL),
          );

          const result = {
            summary: response.summary,
            learning_insights: response.learning_insights,
            metadata: {
              user_id,
              cert_id,
              certification_name,
              total_exams_taken,
              average_score,
              performance_trend,
              mastery_distribution: masteryDistribution,
              readiness_score: readinessScore,
              generated_at: new Date().toISOString(),
            },
          };

          logGenerationComplete('certSummaryGenerator', result, {
            user_id,
            cert_id,
            summary_length: response.summary.length,
            topics_analyzed: topic_mastery.length,
            readiness_score: readinessScore,
            expert_topics: expertTopics,
            advanced_topics: advancedTopics,
          });

          return {
            summary: response.summary,
            learning_insights: response.learning_insights,
          };
        } catch (error) {
          handleGenerationError(
            error,
            { user_id, cert_id, certification_name },
            'certification summary generation',
          );
          throw error;
        }
      },
    );

    return certSummaryGeneratorFlow as CertSummaryGeneratorFlow;
  } catch (error) {
    logger.error('Failed to create cert summary generator flow:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Singleton promise for the cert summary generator flow
 */
let certSummaryGeneratorPromise: Promise<CertSummaryGeneratorFlow> | null = null;

/**
 * Get or create the cert summary generator flow
 */
export const getCertSummaryGeneratorFlow = (): Promise<CertSummaryGeneratorFlow> => {
  if (!certSummaryGeneratorPromise) {
    certSummaryGeneratorPromise = createCertSummaryGeneratorFlow();
  }
  return certSummaryGeneratorPromise;
};

// Initialize the promise for use in handlers
certSummaryGeneratorPromise = createCertSummaryGeneratorFlow();

// Export the promise for use in handlers
export { certSummaryGeneratorPromise };
