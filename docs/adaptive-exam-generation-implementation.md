# Adaptive Exam Generation Implementation

## Overview

This document describes the implementation of adaptive exam generation that uses previous exam reports to improve future exam topic generation. The system checks for the last completed exam's report and combines it with the exam planning prompt to create more personalized and targeted exam content.

## Features Implemented

### 1. Exam Report Integration in Topic Generation

When creating a new exam, the system now:

- Checks for the last completed exam with a non-null `exam_report` for the same user and certification
- Extracts the exam report content
- Combines it with the exam planning prompt to inform AI topic generation
- Logs adaptive learning usage for monitoring

### 2. Enhanced Exam Planner Service

The `examPlanner` service has been enhanced with:

- New `lastExamReport` parameter in the input schema
- Modified prompt building to include adaptive learning insights
- Updated logging to track when adaptive learning is enabled
- Backward compatibility with existing calls (parameter is optional)

### 3. Database Integration

The implementation leverages the existing `ExamAttempt.exam_report` field:

- Queries completed exams with reports for the same user/certification
- Orders by `submitted_at` DESC to get the most recent exam
- Handles cases where no previous report exists gracefully

## Implementation Details

### Files Modified

1. **`/functions/src/services/genkit/examPlanner.ts`**

   - Added `lastExamReport` to input and output schemas
   - Modified `buildExamPlanPrompt` to include adaptive learning section
   - Enhanced logging for adaptive learning tracking

2. **`/functions/src/endpoints/api/users/exams/createExam.ts`**

   - Added database query to fetch last exam report
   - Enhanced error handling for report retrieval
   - Comprehensive logging for debugging and monitoring

3. **`/functions/src/endpoints/api/ai/examPlanner.ts`**
   - Updated API handler to accept `lastExamReport` parameter
   - Enhanced documentation with new parameter example
   - Updated logging to include adaptive learning info

### Database Query

```typescript
const lastCompletedExam = await prismaInstance.examAttempt.findFirst({
  where: {
    user_id: user.user_id,
    cert_id: certIdNumber,
    exam_status: ExamStatus.COMPLETED,
    exam_report: {
      not: null,
    },
  },
  select: {
    exam_report: true,
    exam_id: true,
    submitted_at: true,
  },
  orderBy: {
    submitted_at: "desc",
  },
});
```

### AI Prompt Enhancement

The prompt now includes an adaptive learning section when a previous exam report exists:

```typescript
const adaptiveSection = lastExamReport?.trim()
  ? `

  ADAPTIVE LEARNING INSIGHTS (use this to focus on areas needing improvement):
  Based on the previous exam performance report below, prioritize topics that need strengthening and adjust difficulty for areas of mastery:
  
  ${lastExamReport.trim()}`
  : "";
```

## Benefits

1. **Personalized Learning**: Topics are generated based on individual performance history
2. **Adaptive Difficulty**: AI can adjust topic focus based on strengths and weaknesses
3. **Improved Learning Outcomes**: Users get targeted practice on areas needing improvement
4. **Seamless Integration**: Works automatically without user intervention
5. **Backward Compatibility**: Existing functionality remains unchanged when no report exists

## Monitoring and Logging

The implementation includes comprehensive logging:

- When adaptive learning is enabled/disabled
- Last exam report retrieval success/failure
- Exam plan generation with adaptive context
- Error handling for database queries

Log keys to monitor:

- `ADAPTIVE_LEARNING: Found last exam report`
- `ADAPTIVE_LEARNING: No previous exam report found`
- `adaptiveLearningEnabled: true/false`
- `hasLastExamReport: true/false`

## Error Handling

The implementation includes robust error handling:

- Database query failures don't break exam creation
- Missing exam reports fall back to standard generation
- Comprehensive logging for debugging
- Graceful degradation when adaptive learning fails

## Usage Flow

1. User creates a new exam
2. System checks for last completed exam with report
3. If found, report is included in AI prompt
4. AI generates topics considering previous performance
5. Exam proceeds with adaptive topic generation
6. System logs adaptive learning usage

## Testing Considerations

To test the implementation:

1. Create a user with a completed exam that has an exam report
2. Create a new exam for the same certification
3. Verify that the exam report is retrieved and used
4. Check logs for adaptive learning indicators
5. Compare topic generation with/without previous reports

## Future Enhancements

Potential improvements:

- Analyze multiple previous exams
- Weight reports by recency and performance
- Add user settings for adaptive learning preferences
- Track improvement metrics over time
- Add A/B testing for adaptive vs standard generation
