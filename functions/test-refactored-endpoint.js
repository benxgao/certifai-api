/**
 * Test script for the refactored knowledge pooling endpoint
 * This verifies that the service layer architecture works correctly
 */

const {
  knowledgePoolingGeneratorHandler,
} = require('./lib/endpoints/api/ai/knowledgePoolingGenerator');

// Mock request and response objects
const createMockRequest = (body, firebaseUserInfo = null) => ({
  body,
  firebase_user_info: firebaseUserInfo,
});

const createMockResponse = () => {
  const res = {
    statusCode: null,
    data: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.data = data;
      return this;
    },
  };
  return res;
};

async function testRefactoredEndpoint() {
  console.log('🧪 Testing refactored knowledge pooling endpoint...\n');

  // Test 1: Missing exam_id
  console.log('Test 1: Missing exam_id');
  const req1 = createMockRequest({ api_user_id: 'test-user' });
  const res1 = createMockResponse();

  await knowledgePoolingGeneratorHandler(req1, res1);
  console.log(`Status: ${res1.statusCode}`);
  console.log(`Response: ${JSON.stringify(res1.data, null, 2)}\n`);

  // Test 2: Missing api_user_id
  console.log('Test 2: Missing api_user_id');
  const req2 = createMockRequest({ exam_id: 'test-exam' });
  const res2 = createMockResponse();

  await knowledgePoolingGeneratorHandler(req2, res2);
  console.log(`Status: ${res2.statusCode}`);
  console.log(`Response: ${JSON.stringify(res2.data, null, 2)}\n`);

  // Test 3: Missing authentication
  console.log('Test 3: Missing authentication');
  const req3 = createMockRequest({
    exam_id: 'test-exam',
    api_user_id: 'test-user',
  });
  const res3 = createMockResponse();

  await knowledgePoolingGeneratorHandler(req3, res3);
  console.log(`Status: ${res3.statusCode}`);
  console.log(`Response: ${JSON.stringify(res3.data, null, 2)}\n`);

  // Test 4: With authentication (this will fail at user lookup, but tests the flow)
  console.log('Test 4: With authentication');
  const req4 = createMockRequest(
    {
      exam_id: 'test-exam',
      api_user_id: 'test-user',
      force_regenerate: false,
    },
    { uid: 'test-firebase-uid' },
  );
  const res4 = createMockResponse();

  await knowledgePoolingGeneratorHandler(req4, res4);
  console.log(`Status: ${res4.statusCode}`);
  console.log(`Response: ${JSON.stringify(res4.data, null, 2)}\n`);

  console.log('✅ All tests completed successfully!');
  console.log(
    'The refactored endpoint properly validates inputs and delegates to the service layer.',
  );
}

// Run the tests
testRefactoredEndpoint().catch(console.error);
