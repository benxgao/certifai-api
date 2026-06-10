# Architecture Reference Guide

Quick reference for the system architecture across all major components.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 15)                      │
│              (certifai-app)                                  │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API / WebSockets
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Firebase Functions)                    │
│              (certifai-api/functions)                        │
├─────────────────────────────────────────────────────────────┤
│ Exam Management │ AI Generation │ Learning Intelligence     │
│ (Adaptive)      │ (Genkit)       │ (Knowledge Pooling)      │
└────────┬────────┴────────┬───────┴────────┬─────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
    PostgreSQL        Firestore         Redis Cache
    (Prisma)          (Questions        (L2 Cache)
                      Reports)
```

## Core Components

### 1. Exam Management

**Purpose:** Create, track, and manage certification exams

**Key Features:**

- Adaptive topic generation based on previous performance
- Asynchronous batch question generation
- Real-time progress tracking (2-second polling)
- Rate limiting (3 exams/24 hours)
- Cloud Task orchestration

**See:** [Adaptive Exam Generation](./architecture/adaptive-exam-generation.md)

### 2. Exam Status Lifecycle

**Purpose:** Track exam progression from creation to completion

**Status Flow:**

```
QUESTIONS_GENERATING  → READY → STARTED → COMPLETED
  (questions being       (ready     (user      (user
   created)               for        started)   submitted)
                         user)
```

**See:** [Exam Status Flow](./architecture/exam_active.md) and [Exam Data](./architecture/exam_data.md)

### 3. Intelligent Caching

**Purpose:** 90-95% reduction in database queries through multi-layer caching

**Three Layers:**

- **L1 Memory**: 10-20ms (Hot data)
- **L2 Redis**: 50-100ms (Popular data)
- **L3 Database**: 200-500ms (Source of truth)

**Features:**

- Automatic promotion based on usage
- Smart demotion to save memory
- Circuit breaker for failures
- Pattern-based invalidation

**See:** [Cache Architecture](./architecture/redis-cache.md)

### 4. Knowledge Pooling

**Purpose:** Analyze exam mistakes and generate targeted learning insights

**Flow:**

1. User completes exam
2. System analyzes incorrect answers
3. AI generates learning insights
4. Insights consolidated per certification
5. 7-day cache for performance

**See:** [Knowledge Pooling Architecture](./architecture/knowledge-pooling.md)

## Data Storage Strategy

| Data                  | Storage                  | Purpose             |
| --------------------- | ------------------------ | ------------------- |
| **Exam Metadata**     | PostgreSQL               | Source of truth     |
| **Questions**         | Firestore                | Distributed storage |
| **Exam Reports**      | Firestore                | Learning data       |
| **Topic Performance** | Firestore                | Adaptive input      |
| **User Sessions**     | Redis                    | Fast lookups        |
| **Public Data**       | Redis (L2) + Memory (L1) | High-volume reads   |

## Key Architectural Decisions

### 1. Why Asynchronous Exam Generation?

- **Why:** Generating 50+ questions takes time
- **How:** Cloud Tasks process 10 questions per batch
- **Benefit:** Instant response, background processing, scalable

### 2. Why Adaptive Learning?

- **Why:** Users learn better when focused on weak areas
- **How:** Parse previous exam reports → allocate 60% to weak, 25% to average, 15% to strong
- **Benefit:** More effective study, fewer redundant questions

### 3. Why Multi-Layer Cache?

- **Why:** Public endpoints hit 10,000+ times/hour
- **How:** Memory (hottest) → Redis (popular) → Database (cold)
- **Benefit:** 90%+ fewer queries, instant responses

### 4. Why Cloud Tasks?

- **Why:** Long-running operations (exam generation, insights analysis)
- **How:** Queue → distributed processing → webhook callback
- **Benefit:** Reliable, scalable, non-blocking

### 5. Why Firestore for Questions?

- **Why:** Need fast, distributed document storage
- **How:** Store one question per document, batch operations
- **Benefit:** Scales horizontally, real-time updates

## Integration Points

### Frontend ↔ Backend

- **REST Endpoints:** `/api/users/:id/exams`, `/api/public/certifications`
- **WebSockets:** Real-time exam progress, chat
- **SWR Hooks:** Cached API access with automatic refresh

### Backend ↔ AI (Genkit)

- **Exam Planner:** Topic generation with adaptive input
- **Question Generator:** Individual question creation
- **Knowledge Pooling:** Insight generation from mistakes

### Backend ↔ Databases

- **PostgreSQL:** Exam metadata, user data
- **Firestore:** Questions, reports, insights
- **Redis:** Cache layer, fast lookups
- **RTDB:** Temporary progress tracking

## Performance Targets

| Metric                   | Target        | Actual             |
| ------------------------ | ------------- | ------------------ |
| Exam creation response   | <1s           | ~200ms             |
| Question generation      | <3s per batch | ~2s                |
| Public endpoint latency  | <100ms        | ~15-50ms (cached)  |
| Exam query time          | <1s           | ~50-100ms (cached) |
| Cache hit rate           | >90%          | **96.5%**          |
| Database query reduction | 80-90%        | **90-95%**         |

## Monitoring & Logging

### Key Metrics to Track

- Exam creation duration
- Question generation time per batch
- Cache hit/miss rates
- Knowledge pooling generation time
- API response times (p50, p95, p99)

### Important Log Keys

- `ADAPTIVE_LEARNING` - Adaptive mode status
- `cache_hit` / `cache_miss` - Cache performance
- `exam_status_transition` - Status changes
- `cloud_task_queued` - Batch processing
- `knowledge_pooling_generated` - Insights created

## Scaling Considerations

### Horizontal Scaling

- ✅ Firebase Functions: Auto-scales
- ✅ Firestore: Cloud-native, auto-scales
- ✅ Redis: Use Upstash (managed service)
- ✅ PostgreSQL: Read replicas, connection pooling

### Vertical Scaling

- Database indexes optimized for common queries
- Cloud Task batching reduces individual tasks
- Cache reduces database load

## Future Enhancements

1. **Multi-Exam Analytics** - Track improvement across multiple attempts
2. **ML-Based Difficulty** - Predict optimal difficulty progression
3. **Peer Learning** - Anonymized insights from similar users
4. **Spaced Repetition** - Schedule reviews of weak areas
5. **Collaborative Features** - Study groups, peer discussion

## Getting Started

**For Developers:**

1. Start with [Exam Management](./architecture/adaptive-exam-generation.md) to understand adaptive learning
2. Review [Status Flow](./architecture/exam_active.md) for exam lifecycle
3. Check [Cache Architecture](./architecture/redis-cache.md) for performance patterns

**For Architects:**

1. Review this overview first
2. Deep dive into specific component docs as needed
3. Reference [Exam Data](./architecture/exam_data.md) for database interactions

**For DevOps:**

1. Check monitoring sections in each doc
2. Review scaling considerations above
3. Set up alerts based on key metrics

## Related Docs

- [docs/architecture/adaptive-exam-generation.md](./adaptive-exam-generation.md) — Adaptive exam planning and topic allocation. Ref: `functions/src/services/genkit/examPlanner.ts`
- [docs/architecture/exam_active.md](./exam_active.md) — Status lifecycle and polling behavior for generated exams. Ref: `functions/src/endpoints/api/users/exams/getExamLiveStatus.ts`
- [docs/architecture/exam_data.md](./exam_data.md) — Storage and transition details for exam metadata and associated question data. Ref: `functions/src/utils/examQuestionAssociation.ts`
- [docs/architecture/knowledge-pooling.md](./knowledge-pooling.md) — Post-exam insight generation and Firestore consolidation. Ref: `functions/src/services/firestore/examKnowledgePoolingFirestoreService.ts`
- [docs/architecture/redis-cache.md](./redis-cache.md) — Cache strategy and invalidation patterns used across the architecture. Ref: `functions/src/services/cache/cacheHierarchy.ts`
- [docs/architecture/prisma.md](./prisma.md) — Prisma setup notes for the relational backend layer. Ref: `functions/prisma/schema.prisma`

## Document Structure

```
docs/architecture/
├── ARCHITECTURE.md              ← You are here
├── adaptive-exam-generation.md  ← Personalization logic
├── exam_active.md               ← Status transitions
├── exam_data.md                 ← Database interactions
├── knowledge-pooling.md         ← Insights generation
├── redis-cache.md               ← Caching strategy
└── prisma.md                    ← Database setup
```

---

_Last Updated: April 2026_
