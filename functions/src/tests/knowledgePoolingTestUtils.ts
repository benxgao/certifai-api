/**
 * Test utilities and examples for Knowledge Pooling Generator
 *
 * This file contains test data and utility functions for testing
 * the knowledge pooling generator functionality.
 */

import { IncorrectAnswerAnalysis } from '../types/knowledgePooling';

/**
 * Sample incorrect answer data for testing
 */
export const sampleIncorrectAnswersData: IncorrectAnswerAnalysis[] = [
  {
    exam_id: 'exam_123',
    question_id: 'q_001',
    topic: 'VPC and Networking',
    question_text:
      'Which AWS service provides a managed NAT solution that automatically handles failover?',
    correct_answer: 'NAT Gateway',
    user_selected_answer: 'NAT Instance',
    explanation:
      'NAT Gateways are fully managed AWS services that provide high availability and automatic failover within an Availability Zone. NAT Instances are EC2 instances that you manage yourself.',
  },
  {
    exam_id: 'exam_123',
    question_id: 'q_002',
    topic: 'IAM',
    question_text:
      'What is the maximum number of IAM groups an IAM user can belong to?',
    correct_answer: '10',
    user_selected_answer: 'Unlimited',
    explanation: 'An IAM user can be a member of up to 10 IAM groups.',
  },
  {
    exam_id: 'exam_124',
    question_id: 'q_003',
    topic: 'S3',
    question_text:
      'Which S3 storage class is most cost-effective for data that is accessed less than once per year?',
    correct_answer: 'S3 Glacier Deep Archive',
    user_selected_answer: 'S3 Standard-IA',
    explanation:
      'S3 Glacier Deep Archive is designed for long-term retention of data that is accessed less than once per year.',
  },
  {
    exam_id: 'exam_124',
    question_id: 'q_004',
    topic: 'VPC and Networking',
    question_text:
      'What is the default maximum transmission unit (MTU) size for traffic between instances in different subnets within the same VPC?',
    correct_answer: '1500 bytes',
    user_selected_answer: '9000 bytes',
    explanation:
      'The default MTU size within a VPC is 1500 bytes. Jumbo frames (9000 bytes) are supported but not the default.',
  },
];

/**
 * Expected knowledge pooling output structure for testing
 */
export const expectedKnowledgePoolingStructure = {
  knowledge_insights: [
    {
      topic: 'VPC and Networking',
      insights: [
        {
          insight:
            'Remember the difference between NAT Gateways and NAT Instances',
        },
        {
          insight: 'Understand default MTU sizes within VPC',
        },
      ],
    },
    {
      topic: 'IAM',
      insights: [
        {
          insight: 'Remember IAM limits and quotas',
        },
      ],
    },
    {
      topic: 'S3',
      insights: [
        {
          insight:
            'Choose appropriate S3 storage classes based on access patterns',
        },
      ],
    },
  ],
  summary:
    'Focus on VPC networking concepts, IAM limits, and S3 storage class selection based on access patterns.',
};

/**
 * Test function to validate knowledge pooling generation
 * This is for development/testing purposes only
 */
export const testKnowledgePoolingGeneration = async () => {
  console.log('Testing Knowledge Pooling Generation...');
  console.log('Sample Input Data:');
  console.log(JSON.stringify(sampleIncorrectAnswersData, null, 2));

  // Group by topic for analysis
  const topicGroups = new Map<string, IncorrectAnswerAnalysis[]>();

  sampleIncorrectAnswersData.forEach((answer) => {
    const topic = answer.topic || 'General Knowledge';
    if (!topicGroups.has(topic)) {
      topicGroups.set(topic, []);
    }
    topicGroups.get(topic)!.push(answer);
  });

  console.log('\nTopic Analysis:');
  topicGroups.forEach((answers, topic) => {
    console.log(`\nTopic: ${topic}`);
    console.log(`- Incorrect answers: ${answers.length}`);
  });

  return {
    total_incorrect: sampleIncorrectAnswersData.length,
    topics_analyzed: topicGroups.size,
    topic_breakdown: Array.from(topicGroups.entries()).map(
      ([topic, answers]) => ({
        topic,
        count: answers.length,
      }),
    ),
  };
};

/**
 * Utility function to validate knowledge pooling response structure
 */
export const validateKnowledgePoolingResponse = (response: any): boolean => {
  try {
    // Check required top-level fields
    const requiredFields = [
      'knowledge_insights',
      'summary',
      'generated_at',
      'cert_id',
      'certification_name',
    ];

    for (const field of requiredFields) {
      if (!(field in response)) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }

    // Validate knowledge_insights structure
    if (!Array.isArray(response.knowledge_insights)) {
      console.error('knowledge_insights must be an array');
      return false;
    }

    for (const insight of response.knowledge_insights) {
      if (!insight.topic || !insight.insights) {
        console.error(
          'Each knowledge insight must have topic and insights fields',
        );
        return false;
      }

      if (!Array.isArray(insight.insights)) {
        console.error('insights must be an array');
        return false;
      }

      for (const item of insight.insights) {
        const requiredInsightFields = ['insight'];
        for (const field of requiredInsightFields) {
          if (!(field in item)) {
            console.error(`Missing required insight field: ${field}`);
            return false;
          }
        }
      }
    }

    console.log('Knowledge pooling response structure is valid');
    return true;
  } catch (error) {
    console.error('Error validating knowledge pooling response:', error);
    return false;
  }
};
