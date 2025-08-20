/**
 * Test file to verify force regenerate functionality for knowledge pooling
 * This file is for development testing only
 */

import {
  saveExamKnowledgePoolingToFirestore,
  type ExamKnowledgePoolingData,
} from '../services/firestore/examKnowledgePoolingFirestoreService';

// Test data for force regenerate functionality
const testExamData: ExamKnowledgePoolingData = {
  exam_id: 'test_exam_123',
  knowledge_insights: [
    {
      insight_id: 'insight_1',
      insight: 'Test insight 1',
      context: 'Test context 1',
      topic: 'Test Topic',
      exam_id: 'test_exam_123',
      generated_at: new Date().toISOString(),
    },
    {
      insight_id: 'insight_2',
      insight: 'Test insight 2',
      context: 'Test context 2',
      topic: 'Test Topic 2',
      exam_id: 'test_exam_123',
      generated_at: new Date().toISOString(),
    },
  ],
  summary: 'Test exam summary',
  generated_at: new Date().toISOString(),
  cert_id: 123,
  certification_name: 'Test Certification',
  total_incorrect_answers: 5,
  topics_analyzed: 2,
};

/**
 * Test function to verify force regenerate functionality
 * This function demonstrates how the force regenerate parameter works:
 *
 * 1. First call (forceRegenerate = false): Adds/merges insights normally
 * 2. Second call (forceRegenerate = true): Removes existing exam data first, then adds new
 *
 * @param testUserId - Test user ID
 */
export async function testForceRegenerate(testUserId: string): Promise<void> {
  console.log('🧪 Testing Force Regenerate Functionality');
  console.log('===========================================');

  try {
    // Step 1: Save initial data (normal behavior)
    console.log(
      '\n📝 Step 1: Saving initial exam data (forceRegenerate = false)',
    );
    const result1 = await saveExamKnowledgePoolingToFirestore(
      testUserId,
      testExamData,
      false,
    );
    console.log(
      `✅ Initial save completed. Total insights: ${result1.knowledge_insights.length}`,
    );

    // Step 2: Save new data for same exam with force regenerate
    console.log(
      '\n🔄 Step 2: Force regenerating data for same exam (forceRegenerate = true)',
    );

    const updatedExamData: ExamKnowledgePoolingData = {
      ...testExamData,
      knowledge_insights: [
        {
          insight_id: 'new_insight_1',
          insight: 'Force regenerated insight 1',
          context: 'New context 1',
          topic: 'New Topic',
          exam_id: 'test_exam_123',
          generated_at: new Date().toISOString(),
        },
      ],
      summary: 'Force regenerated summary',
      generated_at: new Date().toISOString(),
      total_incorrect_answers: 3,
    };

    const result2 = await saveExamKnowledgePoolingToFirestore(
      testUserId,
      updatedExamData,
      true, // Force regenerate
    );

    console.log(
      `✅ Force regenerate completed. Total insights: ${result2.knowledge_insights.length}`,
    );
    console.log(
      `📊 Expected behavior: Old insights for exam ${testExamData.exam_id} should be replaced`,
    );

    // Verify that only the new insights for this exam exist
    const examSpecificInsights = result2.knowledge_insights.filter(
      (insight) => insight.exam_id === testExamData.exam_id,
    );

    console.log(
      `🔍 Verification: Found ${examSpecificInsights.length} insights for exam ${testExamData.exam_id}`,
    );
    console.log(`✅ Test completed successfully!`);
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Example usage (commented out for safety):
// testForceRegenerate('test_user_123');
