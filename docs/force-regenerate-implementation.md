# Force Regenerate Implementation Summary

## Overview

Implemented force regenerate functionality for knowledge-pooling data in Firestore. When `force_regenerate` is set to `true`, the system will remove existing knowledge pooling data for a specific exam before creating new data for that exam.

## Files Modified

### 1. `examKnowledgePoolingFirestoreService.ts`

#### Changes Made:

- **Function Signature Update**: Added `forceRegenerate: boolean = false` parameter to `saveExamKnowledgePoolingToFirestore`
- **Force Regenerate Logic**: Added conditional logic to remove existing exam-specific data when `forceRegenerate` is true
- **Enhanced Logging**: Added detailed logging for force regenerate operations including counts of removed items
- **Documentation**: Added comprehensive JSDoc comments explaining the force regenerate functionality

#### Key Implementation Details:

```typescript
// Added parameter
export const saveExamKnowledgePoolingToFirestore = async (
  apiUserId: string,
  examData: ExamKnowledgePoolingData,
  forceRegenerate: boolean = false,
): Promise<ConsolidatedKnowledgePoolingData>

// Force regenerate logic
if (forceRegenerate) {
  // Remove insights from this specific exam
  existingInsights = existingInsights.filter(
    (insight: KnowledgeInsight) => insight.exam_id !== examData.exam_id,
  );

  // Remove exam summary for this specific exam
  existingExamSummaries = existingExamSummaries.filter(
    (summary: any) => summary.exam_id !== examData.exam_id,
  );
}
```

### 2. `knowledgePoolingService.ts`

#### Changes Made:

- **Service Method Update**: Updated `saveKnowledgePoolingData` to accept and pass `forceRegenerate` parameter
- **Parameter Passing**: Modified the call to Firestore service to pass the `force_regenerate` parameter from the request
- **Enhanced Logging**: Added `force_regenerate` flag to log statements

#### Key Implementation Details:

```typescript
// Updated method signature
private static async saveKnowledgePoolingData(
  api_user_id: string,
  examKnowledgeData: ExamKnowledgePoolingData,
  forceRegenerate: boolean = false,
): Promise<ConsolidatedKnowledgePoolingData>

// Pass parameter through
const consolidatedData = await this.saveKnowledgePoolingData(
  api_user_id,
  examKnowledgeData,
  force_regenerate,
);
```

## Functionality

### Normal Behavior (forceRegenerate = false)

1. Retrieves existing knowledge pooling data from Firestore
2. Merges new insights with existing insights (avoiding duplicates)
3. Updates exam summary for the specific exam
4. Saves consolidated data back to Firestore

### Force Regenerate Behavior (forceRegenerate = true)

1. Retrieves existing knowledge pooling data from Firestore
2. **Removes all existing insights for the specific exam**
3. **Removes existing exam summary for the specific exam**
4. Merges new insights with remaining insights (from other exams)
5. Adds new exam summary
6. Saves consolidated data back to Firestore

## Benefits

1. **Data Consistency**: Ensures clean regeneration of exam-specific insights without duplicates or stale data
2. **Targeted Removal**: Only removes data for the specific exam, preserving insights from other exams
3. **Audit Trail**: Comprehensive logging shows exactly what data was removed and what remains
4. **Backward Compatibility**: Default parameter ensures existing code continues to work without modification

## Testing

Created test file `force-regenerate-test.ts` that demonstrates:

- Normal save operation
- Force regenerate operation
- Verification that only new data exists for the regenerated exam
- Preservation of data for other exams

## Usage Example

```typescript
// Normal save (existing behavior)
await saveExamKnowledgePoolingToFirestore(userId, examData, false);

// Force regenerate (new functionality)
await saveExamKnowledgePoolingToFirestore(userId, examData, true);
```

## API Integration

The force regenerate functionality is automatically triggered when the API receives:

```json
{
  "exam_id": "exam_123",
  "api_user_id": "user_456",
  "force_regenerate": true
}
```

The `force_regenerate` parameter flows through:

1. API Handler → Knowledge Pooling Service → Firestore Service
2. Each layer passes the parameter to enable force regeneration when needed

## Logging and Monitoring

Enhanced logging provides visibility into:

- When force regenerate is triggered
- How many insights/summaries were removed
- How many items remain after cleanup
- Final counts after regeneration

This enables easy monitoring and debugging of the force regenerate functionality.
