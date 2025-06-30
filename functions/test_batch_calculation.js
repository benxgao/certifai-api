// Test script to validate batch calculation logic
const QUESTIONS_PER_BATCH = 1;

function testBatchCalculation(totalQuestions, batchNumber) {
  console.log(
    `\n--- Test: totalQuestions=${totalQuestions}, batchNumber=${batchNumber} ---`,
  );

  // Old problematic calculation
  const oldCalculation = Math.min(
    10, // Old hardcoded value
    totalQuestions - batchNumber * 10,
  );

  // New fixed calculation
  const questionsGenerated = batchNumber * QUESTIONS_PER_BATCH;
  const remainingQuestions = Math.max(0, totalQuestions - questionsGenerated);
  const questionsForNextBatch = Math.min(
    QUESTIONS_PER_BATCH,
    remainingQuestions,
  );

  console.log(`Old calculation result: ${oldCalculation}`);
  console.log(`New calculation result: ${questionsForNextBatch}`);
  console.log(`Questions generated so far: ${questionsGenerated}`);
  console.log(`Remaining questions: ${remainingQuestions}`);

  if (oldCalculation < 0) {
    console.log(`❌ OLD LOGIC PRODUCES NEGATIVE: ${oldCalculation}`);
  } else {
    console.log(`✅ Old logic is positive: ${oldCalculation}`);
  }

  if (questionsForNextBatch < 0) {
    console.log(`❌ NEW LOGIC PRODUCES NEGATIVE: ${questionsForNextBatch}`);
  } else {
    console.log(`✅ New logic is non-negative: ${questionsForNextBatch}`);
  }
}

// Test scenarios that could cause the error
console.log('Testing batch calculation logic for negative count bug...');

// Scenario 1: Normal case
testBatchCalculation(20, 5);

// Scenario 2: Edge case that causes negative in old logic
testBatchCalculation(20, 8);

// Scenario 3: Another problematic case
testBatchCalculation(15, 10);

// Scenario 4: Case that matches the reported error (-7)
// If total_questions = 20 and batch_number = 3, old logic would be:
// Math.min(10, 20 - 3*10) = Math.min(10, -10) = -10
testBatchCalculation(20, 3);

// Let's find what parameters would give us exactly -7
console.log('\n--- Finding parameters that produce -7 ---');
for (let total = 1; total <= 30; total++) {
  for (let batch = 1; batch <= 10; batch++) {
    const oldResult = Math.min(10, total - batch * 10);
    if (oldResult === -7) {
      console.log(
        `Found -7 case: totalQuestions=${total}, batchNumber=${batch}`,
      );
    }
  }
}
