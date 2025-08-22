# Knowledge Pooling Workflow - Exam-Based Refactoring

## Overview

The knowledge pooling workflow has been refactored from a certification-based approach to an exam-based approach. Instead of analyzing all incorrect answers across all exams for a certification, the system now processes insights per individual exam and concatenates them in Firestore.

## Key Changes

### Architecture Change

- **Before**: Input `cert_id` → Analyze all exams → Store certification-level insights
- **After**: Input `exam_id` → Analyze specific exam → Append to certification insights

### API Changes

- **Endpoint**: `/api/ai/knowledge-pooling`
- **Input Parameter**: Changed from `cert_id` to `exam_id`
- **Response**: Returns consolidated data with insights from all analyzed exams

### New Files Created

1. **`examKnowledgePoolingDataService.ts`**

   - Fetches incorrect answers for a specific exam
   - Returns exam info and certification details
   - Function: `getIncorrectAnswersForExam(exam_id, user_id)`

2. **`examKnowledgePoolingFirestoreService.ts`**
   - Handles exam-based data storage with concatenation
   - Merges insights by topic to avoid duplicates
   - Maintains exam summaries and consolidated data
   - Key functions:
     - `saveExamKnowledgePoolingToFirestore()`
     - `getConsolidatedKnowledgePoolingFromFirestore()`
     - `hasRecentExamKnowledgePooling()`

### Updated Files

1. **`knowledgePoolingGnerator.ts`**

   - Updated input schema to include `exam_id`
   - Modified AI prompt for exam-specific analysis
   - Updated validation and metadata handling

2. **`knowledgePoolingGenerator.ts` (API Handler)**
   - Complete rewrite for exam-based approach
   - Uses new data service and Firestore service
   - Maintains backward compatibility for caching

## Data Structure

### Firestore Storage Path

```
users/:api_user_id/certs/:cert_id/knowledge_pooling
```

### Consolidated Data Structure

```typescript
interface ConsolidatedKnowledgePoolingData {
  knowledge_insights: KnowledgePoolingItem[];
  last_updated: string;
  cert_id: number;
  certification_name: string;
}

interface KnowledgeInsight {
  insight: string;
  context: string;
  exam_id: string; // NEW: Tracks which exam generated this insight
  generated_at: string; // NEW: When this insight was generated
}
```

## Key Features

### Insight Concatenation

- Insights are merged by topic to avoid duplicates
- New insights are appended to existing ones
- Topic-based organization maintained
- Each insight includes `exam_id` and `generated_at` for full traceability

### Exam Tracking

- Each exam's analysis is tracked separately
- Exam summaries stored with metadata
- Recent data checking per exam
- Precise insight removal when deleting exam data
- Query insights by specific exam_id

### Caching Strategy

- 7-day cache for each exam analysis
- Force regeneration option available
- Consolidated view always returned

## Benefits

1. **Granular Analysis**: Process insights immediately after each exam
2. **Incremental Updates**: Add new insights without reprocessing all data
3. **Better Performance**: Smaller data processing per request
4. **User Experience**: Faster feedback after exam completion
5. **Data Integrity**: Maintain historical analysis per exam

## Usage Example

```javascript
// API Request
POST /api/ai/knowledge-pooling
{
  "exam_id": "exam_123",
  "user_id": "user_456",
  "force_regenerate": false
}

// Response
{
  "success": true,
  "data": {
    "knowledge_insights": [...]
  },
  "metadata": {
    "exam_id": "exam_123",
    "certification_name": "AWS Solutions Architect",
    "generated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

## Migration Notes

- Existing certification-level data remains compatible
- New exam-based data will be appended to existing insights with `exam_id` tracking
- API clients need to update request parameter from `cert_id` to `exam_id`
- Response structure includes additional metadata for better tracking

## Helper Functions

### Get Insights by Exam ID

```typescript
getInsightsByExamId(apiUserId, certId, examId): Promise<KnowledgePoolingItem[]>
```

- Filters consolidated insights to show only those from a specific exam
- Useful for exam-specific analysis and debugging

### Enhanced Delete Function

- `deleteExamKnowledgePoolingFromFirestore()` now precisely removes insights by `exam_id`
- No more orphaned insights from deleted exams
- Maintains data integrity across exam deletions

## Implementation Status

✅ Data service for exam-specific queries  
✅ Firestore service with concatenation logic  
✅ AI service updated for exam-based prompts  
✅ API handler refactored  
✅ Type definitions updated  
✅ Error handling and logging

The refactoring is complete and ready for testing with real exam data.
