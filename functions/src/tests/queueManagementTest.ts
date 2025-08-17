/**
 * Test script for queue management functionality
 * This script can be used to verify that the queue creation/validation works correctly
 */
import { CloudTasksClient } from '@google-cloud/tasks';
import {
  checkQueueExists,
  createCloudTasksQueue,
} from '../services/gcp/cloudTasks';
import {
  ensureExamQueuesExist,
  checkExamQueueHealth,
  validateExamQueueReadiness,
  EXAM_QUEUE_NAMES,
} from '../utils/examQueueManager';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const GCP_REGION = process.env.GCP_REGION || '';

/**
 * Test the queue management functionality
 */
async function testQueueManagement() {
  console.log('🧪 Testing Queue Management Functionality');
  console.log('=========================================');

  if (!GCP_PROJECT_ID || !GCP_REGION) {
    console.error(
      '❌ Missing required environment variables: GCP_PROJECT_ID, GCP_REGION',
    );
    return;
  }

  console.log(`📍 Project: ${GCP_PROJECT_ID}, Region: ${GCP_REGION}`);
  console.log('');

  try {
    // Test 1: Check current queue health
    console.log('🔍 Test 1: Checking current queue health...');
    const healthBefore = await checkExamQueueHealth();
    console.log('Queue Health Before:', healthBefore);
    console.log('');

    // Test 2: Ensure queues exist
    console.log('🔧 Test 2: Ensuring exam queues exist...');
    await ensureExamQueuesExist();
    console.log('✅ Exam queues ensured to exist');
    console.log('');

    // Test 3: Validate queue readiness
    console.log('🎯 Test 3: Validating queue readiness...');
    await validateExamQueueReadiness();
    console.log('✅ Queue readiness validated');
    console.log('');

    // Test 4: Check queue health after ensuring they exist
    console.log('🔍 Test 4: Checking queue health after ensuring existence...');
    const healthAfter = await checkExamQueueHealth();
    console.log('Queue Health After:', healthAfter);
    console.log('');

    // Test 5: Individual queue operations
    console.log('🔧 Test 5: Testing individual queue operations...');

    const queueExists = await checkQueueExists(EXAM_QUEUE_NAMES.EXAM_QUESTIONS);
    console.log(
      `Queue "${EXAM_QUEUE_NAMES.EXAM_QUESTIONS}" exists:`,
      queueExists,
    );

    if (!queueExists) {
      console.log('Creating queue...');
      await createCloudTasksQueue(EXAM_QUEUE_NAMES.EXAM_QUESTIONS);
      console.log('✅ Queue created');
    }
    console.log('');

    console.log('🎉 All queue management tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test queue deletion and recreation scenario
 * This simulates the scenario where a queue might be accidentally deleted
 */
async function testQueueDeletionRecovery() {
  console.log('🧪 Testing Queue Deletion Recovery Scenario');
  console.log('==========================================');

  if (!GCP_PROJECT_ID || !GCP_REGION) {
    console.error(
      '❌ Missing required environment variables: GCP_PROJECT_ID, GCP_REGION',
    );
    return;
  }

  try {
    const cloudTasksClient = new CloudTasksClient();
    const queuePath = cloudTasksClient.queuePath(
      GCP_PROJECT_ID,
      GCP_REGION,
      EXAM_QUEUE_NAMES.EXAM_QUESTIONS,
    );

    console.log(
      '⚠️  WARNING: This test will attempt to delete and recreate the queue',
    );
    console.log('🔍 Checking if queue exists before deletion...');

    const existsBefore = await checkQueueExists(
      EXAM_QUEUE_NAMES.EXAM_QUESTIONS,
    );
    console.log(`Queue exists before deletion: ${existsBefore}`);

    if (existsBefore) {
      console.log('🗑️  Deleting queue to simulate accidental deletion...');
      try {
        await cloudTasksClient.deleteQueue({ name: queuePath });
        console.log('✅ Queue deleted successfully');
      } catch (deleteError: any) {
        if (deleteError.code === 5) {
          // NOT_FOUND
          console.log('ℹ️  Queue was already deleted');
        } else {
          throw deleteError;
        }
      }
    }

    console.log('🔍 Checking if queue exists after deletion...');
    const existsAfterDeletion = await checkQueueExists(
      EXAM_QUEUE_NAMES.EXAM_QUESTIONS,
    );
    console.log(`Queue exists after deletion: ${existsAfterDeletion}`);

    console.log('🔧 Testing recovery: ensuring queue exists...');
    await ensureExamQueuesExist();

    console.log('🔍 Checking if queue exists after recovery...');
    const existsAfterRecovery = await checkQueueExists(
      EXAM_QUEUE_NAMES.EXAM_QUESTIONS,
    );
    console.log(`Queue exists after recovery: ${existsAfterRecovery}`);

    if (existsAfterRecovery) {
      console.log('🎉 Queue deletion recovery test completed successfully!');
    } else {
      throw new Error('Queue recovery failed');
    }
  } catch (error) {
    console.error('❌ Queue deletion recovery test failed:', error);
    throw error;
  }
}

// Export test functions for use in testing
export { testQueueManagement, testQueueDeletionRecovery };

// Run tests if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await testQueueManagement();
      console.log('');

      // Uncomment the following line to test deletion recovery
      // WARNING: This will delete and recreate the queue
      // await testQueueDeletionRecovery();
    } catch (error) {
      console.error('Tests failed:', error);
      process.exit(1);
    }
  })();
}
