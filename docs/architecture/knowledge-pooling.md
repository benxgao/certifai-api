# Knowledge Pooling Architecture

## Overview

Knowledge Pooling analyzes exam mistakes and generates targeted learning insights using AI. It creates consolidated recommendations that help users focus on their weak areas.

## How It Works

```
1. User completes exam
   └→ Submit exam → Cloud Task triggered

2. Cloud Task: Knowledge Pooling
   └→ Fetch incorrect answers
   └→ Analyze with AI
   └→ Generate insights
   └→ Store in Firestore (merged with previous)

3. User requests insights
   └→ API checks cache (7 days)
   └→ Return consolidated data OR regenerate
```

## Key Concepts

### What Are Insights?

Each insight is a learning point extracted from a mistake:

```
{
  insight_id: uuid,
  insight: "NAT Gateways are AWS-managed services",
  topic: "VPC and Networking",
  exam_id: "exam_123",
  generated_at: timestamp
}
```

### Consolidation

**Before:** Multiple insight arrays per exam  
**After:** Single consolidated list for all exams in a certification

```
User's AWS Certification
├─ Exam 1 Insights
│  └─ Topic: VPC → 3 insights
│  └─ Topic: IAM → 2 insights
├─ Exam 2 Insights
│  └─ Topic: VPC → 1 insight
│  └─ Topic: Security → 2 insights
└─ Consolidated View
   ├─ VPC: 4 total insights
   ├─ IAM: 2 total insights
   └─ Security: 2 total insights
```

## System Components

### 1. Exam Submission Trigger

- **Event:** User submits exam
- **Action:** Queue Cloud Task for knowledge pooling
- **Async:** Yes (doesn't block exam completion)

### 2. Knowledge Pooling Service

- **Input:** Exam ID, User ID, Incorrectly answered questions
- **Process**:
  1. Fetch incorrect answers from PostgreSQL
  2. Send to AI for analysis
  3. AI generates learning insights
  4. Validation and deduplication
- **Output:** Array of insights

### 3. Firestore Storage

- **Path:** `users/{userId}/certs/{certId}`
- **Structure:** Single document per certification
- **Merge:** New insights merged (old per-exam data removed)

### 4. Caching Strategy

- **Duration:** 7 days
- **Invalidation:** User can force refresh
- **Speed Benefit:** Instant retrieval for cached data

## API Endpoints

### Internal: POST `/api/ai/knowledge-pooling`

Service-to-service endpoint (used by Cloud Tasks)

**Request:**

```json
{
  "exam_id": "exam_123",
  "api_user_id": "user_456",
  "force_regenerate": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "knowledge_insights": [ ... ],
    "cert_id": 1,
    "last_updated": "2025-08-20T10:30:00Z",
    "certification_name": "AWS Solutions Architect"
  },
  "cached": false
}
```

### User: GET `/users/:user_id/certifications/:cert_id/knowledge-pooling`

Retrieve consolidated insights for a certification

**Response:**

```json
{
  "success": true,
  "data": {
    "knowledge_insights": [
      {
        "insight": "NAT Gateways are AWS-managed",
        "topic": "VPC and Networking",
        "exam_id": "exam_123"
      }
    ],
    "stats": {
      "total_insights": 8,
      "unique_exams": 2,
      "unique_topics": 4
    }
  }
}
```

### User: POST `/users/:user_id/certifications/:cert_id/knowledge-pooling`

Generate/refresh insights for a specific exam

**Request:**

```json
{
  "exam_id": "exam_123",
  "forceGenerate": true // Skip cache
}
```

**Response:** Same as GET

## Data Flow Diagram

```
┌─────────────────┐
│ Exam Submitted  │
└────────┬────────┘
         │
         ▼
┌────────────────────────┐
│ Cloud Task Queued      │
│ knowledge-pooling      │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Fetch Incorrect        │  PostgreSQL Query:
│ Answers from Exam      │  - Which questions wrong?
└────────┬───────────────┘  - What were correct answers?
         │
         ▼
┌────────────────────────┐
│ AI Analysis            │  Genkit multi-turn:
│ Generate Insights      │  - Context of mistakes
└────────┬───────────────┘  - Learning principles
         │
         ▼
┌────────────────────────┐
│ Deduplicate            │  Compare with existing:
│ Merge with Previous    │  - Same topic?
└────────┬───────────────┘  - Same insight text?
         │
         ▼
┌────────────────────────┐
│ Store in Firestore     │  users/{userId}/
│ (merged document)      │  certs/{certId}
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│ User Requests          │
│ GET insights           │
│ (from cache or new)    │
└────────────────────────┘
```

## Validation Chain

The system validates at every step:

1. ✅ Firebase JWT token valid
2. ✅ User exists in database
3. ✅ Exam exists and belongs to user
4. ✅ Exam completed (not draft)
5. ✅ User owns the certification
6. ✅ Incorrect answers exist to analyze

Invalid at any step → Clear error with HTTP status code

## Storage Structure

**Firestore Document:**

```
Collection: users
  Document: {userId}
    Collection: certs
      Document: {certId}
        knowledge_pooling: {
          knowledge_insights: [
            {
              insight_id: uuid,
              insight: string,
              topic: string,
              exam_id: string,
              generated_at: timestamp
            }
          ],
          cert_id: number,
          certification_name: string,
          last_updated: timestamp
        }
```

## Deduplication Strategy

Before storing new insights, system checks for duplicates:

```
For each new insight:
  - Get text (lowercase, trimmed)
  - Compare with existing insights
  - If exact match found: SKIP (not added)
  - If no match: ADD (new insight)
```

This prevents duplicate learning points from multiple exams.

## Caching Logic

**On GET request:**

```
1. Check if Firestore doc exists
   └─ Not found → 404 (no completed exams yet)

2. Check last_updated timestamp
   └─ Older than 7 days → Regenerate
   └─ Newer than 7 days → Return cached

3. Return data with metadata
   └─ "cached": true/false
   └─ "processing_time_ms": N
```

**On POST request:**

```
1. If forceGenerate = false
   └─ Same as GET
2. If forceGenerate = true
   └─ Ignore timestamp, always regenerate
   └─ Overwrite old data
```

## Error Handling

| Scenario              | HTTP Code | Behavior                 |
| --------------------- | --------- | ------------------------ |
| No token              | 401       | Authentication required  |
| Invalid exam_id       | 400       | Bad request              |
| Exam not found        | 404       | Not found                |
| User doesn't own exam | 404       | Not found (security)     |
| Exam not complete     | 404       | Can't analyze draft exam |
| No incorrect answers  | 404       | Nothing to analyze       |
| AI generation fails   | 500       | Service error (logged)   |

## Monitoring

Key metrics:

- `knowledge_pooling_generated` - New insights created
- `knowledge_pooling_cached` - Cached data returned
- `regeneration_requested` - Force refresh used
- Generation time in ms
- Insight count per exam
- Deduplication rate

## Future Enhancements

1. **Topic-Specific Recommendations** - Suggest study resources per topic
2. **Spaced Repetition** - Schedule reviews of weak areas
3. **Peer Insights** - Anonymized insights from similar users
4. **Performance Trends** - Track improvement over time

   -H 'Authorization: Bearer <TOKEN>' \
   -H 'Content-Type: application/json' \
   -d '{"exam_id": "exam_123", "forceGenerate": true}'

````

**Get existing insights:**

```bash
curl -X GET \
  'http://localhost:5001/certifai-uat/us-central1/endpoints/api/users/user_456/certifications/1/knowledge-pooling' \
  -H 'Authorization: Bearer <TOKEN>'
````

**Internal API (service-to-service):**

```bash
curl -X POST http://localhost:5001/certifai-uat/us-central1/endpoints/api/ai/knowledge-pooling \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"exam_id": "exam_123", "api_user_id": "user_456", "force_regenerate": false}'
```

### Expected Behavior Table

| Scenario                        | Expected           | Notes                            |
| ------------------------------- | ------------------ | -------------------------------- |
| New exam, first generation      | 200 + insights     | Should generate 3-5 insights     |
| Cache hit (forceGenerate=false) | 200 + same data    | processing_time_ms < 100ms       |
| Cache miss or force             | 200 + new insights | processing_time_ms > 1000ms      |
| Multiple exams (same cert)      | Combined insights  | Stats show correct unique counts |
| No data exists                  | 404 Not Found      | Use POST to generate first       |
| Stale cache (>7 days)           | Auto-regenerate    | Even with forceGenerate=false    |

## Security

### Authentication Flow

1. **Firebase JWT Token** → Required in Authorization header
2. **Decoded by Middleware** → Extracts `firebase_user_info.uid`
3. **User Endpoints** → Verify user can access their own data
4. **Exam Validation** → Confirm exam belongs to user (PostgreSQL)
5. **Cloud Tasks** → Use auth headers to call internal APIs

### Access Control

| Layer             | Check                 | Result                |
| ----------------- | --------------------- | --------------------- |
| **Endpoint Auth** | Firebase token valid? | ❌ → 401 Unauthorized |
| **Ownership**     | Exam belongs to user? | ❌ → 404 Not Found    |
| **Exam Status**   | Exam submitted?       | ❌ → 404 Not Found    |
| **Data Access**   | User in correct cert? | ❌ → 404 Not Found    |

### Best Practices

- ✅ All errors return generic 404 to avoid data leakage
- ✅ Firebase JWT required for all endpoints
- ✅ Never trust `user_id` from URL alone—verify from token
- ✅ Exam validation includes user ownership check
- ✅ Cloud Tasks use service account with restricted permissions

## Key Implementation Details

### Deduplication

Insights are deduplicated by comparing the lowercased, trimmed text of each insight. This prevents storing identical insights from different exams.

### Force Regenerate Behavior

When `force_regenerate=true` is used:

1. Fetches existing insights from Firestore
2. Filters out insights from the specific exam being regenerated
3. Adds new AI-generated insights for that exam
4. Saves consolidated data back

This ensures fresh insights for the exam while preserving insights from other exams.

### Cloud Task Integration

When a user submits an exam:

1. Exam submission endpoint creates a Cloud Task
2. Task queued to `knowledge-pooling-queue`
3. Google Cloud invokes `/delegators/tasks/knowledge-pooling` handler
4. Handler calls `KnowledgePoolingService.generateKnowledgePooling()`
5. Process runs in background (user gets immediate confirmation)
6. Insights available within 1-3 seconds

**Note:** Cloud Tasks only run once per exam. To regenerate, call the user endpoint with `forceGenerate=true`.

## Related Docs

- [docs/architecture/exam_data.md](./exam_data.md) — Exam/report storage model and the data that feeds insight generation. Ref: `functions/src/services/firebase/examReportFirestore.ts`
- [docs/workflow/exam-generation-workflow.md](../workflow/exam-generation-workflow.md) — Spec-first lifecycle for exam completion and downstream tasks. Ref: `functions/src/delegators/tasks/knowledge-pooling/`
- [docs/ai-services/exam-generation.md](../ai-services/exam-generation.md) — AI service conventions and rate/cost guardrails. Ref: `functions/src/services/firestore/examKnowledgePoolingFirestoreService.ts`
- [docs/cache/redis-patterns.md](../cache/redis-patterns.md) — Cache rules for consolidated insight retrieval. Ref: `functions/src/services/cache/index.ts`
- [docs/database/prisma-patterns.md](../database/prisma-patterns.md) — Relational query and schema conventions for exam ownership checks. Ref: `functions/prisma/schema.prisma`
