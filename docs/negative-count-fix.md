# Fix for Negative Count Error in Exam Question Generation

## Issue Description

The exam generation process for exam ID `72ccabfe-478a-4836-a839-b5c297a592c7` was failing with a negative count error (`"count": -7`). This occurred during the Cloud Tasks-based recursive question generation process.

## Root Cause

The issue was in `/functions/src/delegators/tasks/take.ts` where the calculation for `questions_to_generate` in the next batch could result in negative values:

```typescript
// Problematic code (BEFORE):
questions_to_generate: Math.min(
  10, // Hardcoded value that didn't match QUESTIONS_PER_BATCH = 1
  (exam.total_questions || 0) - batch_number * 10, // Could be negative
),
```

### Why it happened:

1. **Inconsistent batch size**: `createExam.ts` uses `QUESTIONS_PER_BATCH = 1`, but `take.ts` used hardcoded `10`
2. **No negative value protection**: When `batch_number * 10` exceeded `exam.total_questions`, the result became negative
3. **Math.min() preserves negative values**: `Math.min(10, -7) = -7`

### Example scenarios that caused -7:

- totalQuestions=3, batchNumber=1: `Math.min(10, 3 - 1*10) = Math.min(10, -7) = -7`
- totalQuestions=13, batchNumber=2: `Math.min(10, 13 - 2*10) = Math.min(10, -7) = -7`
- totalQuestions=23, batchNumber=3: `Math.min(10, 23 - 3*10) = Math.min(10, -7) = -7`

## Fix Implementation

### 1. Centralized batch size configuration

- Moved `QUESTIONS_PER_BATCH` definition to only exist in `createExam.ts`
- Added `questions_per_batch` to the task payload to pass the value to `take.ts`
- Removed duplicate constant definition in `take.ts`

### 2. Fixed the calculation logic

```typescript
// NEW code (AFTER):
const questionsGenerated = batch_number * questions_per_batch;
const remainingQuestions = Math.max(
  0,
  (exam.total_questions || 0) - questionsGenerated
);
const questionsForNextBatch = Math.min(questions_per_batch, remainingQuestions);
```

### 3. Added early validation

```typescript
// Validate that questions_to_generate is not negative
if (questions_to_generate < 0) {
  logger.error(
    `Invalid questions_to_generate value: ${questions_to_generate} for exam ${exam_id}, batch ${batch_number}`
  );
  res.status(400).json({
    success: false,
    error: `Invalid questions count: ${questions_to_generate}. Count must be >= 0.`,
  });
  return;
}
```

### 4. Added early completion logic

```typescript
// Only create next batch if there are questions remaining
if (questionsForNextBatch <= 0) {
  logger.warn(
    `No more questions needed for exam ${exam_id}. Total: ${exam.total_questions}, Generated: ${questionsGenerated}`
  );
  // Mark exam as ready since we've generated enough questions
  await updateExamAfterQuestionAssociation(exam_id, {
    success: true,
    associatedQuestionCount: questionsGenerated,
    selectedQuestionIds: [],
    certification: null,
  });
  // ... return success response
}
```

## Files Modified

- `/functions/src/delegators/tasks/take.ts`: Fixed batch calculation logic, added validation, and updated to consume `questions_per_batch` from payload
- `/functions/src/endpoints/api/users/exams/createExam.ts`: Updated to pass `questions_per_batch` in task payload

## Prevention Measures

1. **Single source of truth**: `QUESTIONS_PER_BATCH` is now defined only in `createExam.ts` and passed via payload
2. **Negative value protection**: `Math.max(0, ...)` ensures remaining questions never go negative
3. **Input validation**: Early validation rejects negative `questions_to_generate` values
4. **Graceful completion**: Properly handles cases where no more questions are needed

## Testing

The fix was validated with a test script that confirmed:

- Old logic produces negative values in multiple scenarios
- New logic always produces non-negative values
- The specific -7 error case is resolved

## Impact

- Fixes the immediate error causing exam generation failures
- Prevents similar negative count errors in the future
- Maintains backward compatibility with existing functionality
- Improves error handling and logging for easier debugging
