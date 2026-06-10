# Adaptive Exam Generation Architecture

## Overview

Adaptive exam generation personalizes certification practice by analyzing each user's previous exam performance and generating new exams focused on their weak areas. The system uses structured performance data to dynamically allocate topics and adjust difficulty levels.

## How It Works

### Exam Creation Flow

```
1. User initiates new exam
2. System fetches last completed exam report
3. Extract topic performance data (accuracy rates, difficulty levels)
4. Exam Planner uses performance data to:
   - Allocate 60% of topics to weak areas
   - Allocate 25% to average areas
   - Allocate 15% to strong areas (validation only)
5. Generate topic list with duplicates for weak areas
6. Queue questions for generation
7. Users practice with personalized content
```

### Data Flow Diagram

```
┌─────────────────┐
│  Last Completed │
│ Exam Report     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Parse Performance Structure      │
│ - Topic names                   │
│ - Accuracy rates (%)            │
│ - Difficulty levels             │
│ - Categorize weak/avg/strong    │
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Adaptive Topic Allocation        │
│ - 60% weak (2-4 duplicates)     │
│ - 25% average (1-2 duplicates)  │
│ - 15% strong (1 only)           │
└────────┬───────────────────────┘
         │
         ▼
┌──────────────┐
│ Exam Planner │  Generate N topics
└────────┬─────┘
         │
         ▼
┌──────────────────┐
│ New Exam Topics  │  More weak topics
└──────────────────┘
```

## Key Design Decisions

### 1. Topic Allocation Strategy

- **Weak areas (60%)**: Users spend most time on areas they struggle with
- **Average areas (25%)**: Reinforcement and consolidation
- **Strong areas (15%)**: Validation of mastery

### 2. Duplication Approach

- Weak topics (accuracy <50%): Include 2-4 times
- Weak topics (accuracy 50-60%): Include 1-2 times
- Average topics: Include 1-2 times
- Strong topics: Include once or skip

### 3. Backward Compatibility

- System gracefully handles exams without previous reports
- Falls back to standard topic generation if needed
- No breaking changes to existing APIs

## System Components

### Core Services

| Component              | Purpose                                         | Location                                  |
| ---------------------- | ----------------------------------------------- | ----------------------------------------- |
| **Exam Planner**       | Generates adaptive topic lists                  | `services/genkit/examPlanner.ts`          |
| **Adaptive Topics**    | Parses performance data and builds instructions | `services/genkit/adaptiveTopics.ts`       |
| **Create Exam**        | Entry point for exam creation                   | `endpoints/api/users/exams/createExam.ts` |
| **Exam Report Parser** | Parses structured Firestore data                | `types/examReport.ts`                     |

### Data Structures

**Topic Performance** (from exam report):

```
{
  topic: string                           // Topic name
  accuracy_rate: number (0.0 - 1.0)      // How well user performed
  difficulty_level: easy|intermediate|   // Topic difficulty
                    advanced|expert
  performance_category: weak|average|     // Categorization
                        strong
}
```

**Exam Report** (stored in Firestore):

```
{
  exam_id: string
  overall_score: number (%)
  topic_performance: TopicPerformance[]
}
```

## Benefits

| Benefit              | Impact                                                                |
| -------------------- | --------------------------------------------------------------------- |
| **Focused Practice** | Users concentrate on weak areas instead of reviewing mastered topics  |
| **Efficiency**       | Reduces study time by eliminating redundant easy content              |
| **Data-Driven**      | Personalization based on actual performance, not guessing             |
| **Scalable**         | Firestore handles large-scale data; works for all certification types |
| **Seamless**         | Automatic - no user configuration needed                              |

## Integration Points

### When Creating an Exam

```typescript
POST /api/users/{user_id}/exams
{
  "cert_id": 123,
  "numberOfQuestions": 50,
  "customPromptText": "Focus on security"  // Optional
}
```

The system automatically:

1. Queries last exam report for this user + certification
2. Extracts topic performance data
3. Passes it to exam planner
4. Generates personalized topics

### Monitoring

Log these events to track adaptive learning usage:

- `ADAPTIVE_LEARNING: Found last exam report` - Adaptive mode enabled
- `ADAPTIVE_LEARNING: No previous exam found` - Standard mode used
- Topic distribution: weak/average/strong counts

## Error Handling

| Scenario            | Behavior                                            |
| ------------------- | --------------------------------------------------- |
| No previous exam    | Use standard topic generation (backward compatible) |
| Corrupt report data | Log warning and fall back to standard generation    |
| Database error      | System continues without adaptive data              |
| Invalid JSON        | Caught by parser, falls back gracefully             |

The system never fails exam creation due to adaptive learning issues.

## Related Docs

- [docs/workflow/exam-generation-workflow.md](../workflow/exam-generation-workflow.md) — Spec-first exam generation lifecycle, from request to completion. Ref: `functions/src/services/genkit/examPlanner.ts`
- [docs/ai-services/exam-generation.md](../ai-services/exam-generation.md) — Genkit and AI generation guardrails for adaptive topic selection. Ref: `functions/src/services/genkit/adaptiveTopics.ts`
- [docs/architecture/exam_active.md](./exam_active.md) — Exam status lifecycle that receives the generated exam. Ref: `functions/src/endpoints/api/users/exams/getExamLiveStatus.ts`
- [docs/architecture/exam_data.md](./exam_data.md) — Persistence model for exams, reports, and topic performance input. Ref: `functions/src/types/examReport.ts`
- [docs/services/service-catalog.md](../services/service-catalog.md) — Service-layer boundaries for planner, Prisma, and Firestore dependencies. Ref: `functions/src/endpoints/api/users/exams/createExam.ts`

## Future Enhancements

1. **Multi-Exam Analysis** - Analyze trends across multiple exams
2. **Time Decay** - Weight recent exams more heavily
3. **User Preferences** - Allow users to adjust adaptive intensity
4. **Performance Tracking** - Show improvement over time
5. **ML Optimization** - Predict optimal topic sequencing
