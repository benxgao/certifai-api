# Service Catalog

> **Source of truth**: `functions/src/services/`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Provide a canonical inventory of backend services and when to use each, so contributors and assistants route implementation to the correct service layer.

## Service Layer Conventions

- Endpoint handlers should orchestrate request/response and delegate domain logic to services.
- Reuse existing services before introducing new abstractions.
- Keep cross-cutting behavior (logging, caching, monitoring, queueing, auth) in dedicated services.
- Avoid direct infra SDK calls in endpoint handlers when a service exists.

## Service Inventory

### Core data and persistence

1. **`prisma/`**
   - Responsibility: PostgreSQL access through Prisma singleton + enums.
   - Use for: relational data reads/writes, transactional updates.

2. **`firestore/`**
   - Responsibility: Firestore-specific access patterns.
   - Use for: question/report documents and non-relational exam artifacts.

3. **`firebase/`**
   - Responsibility: Firebase Admin wrappers (auth/logger/rtdb helpers).
   - Use for: Firebase integration points from server side.

### Caching and performance

4. **`redis/`**
   - Responsibility: Upstash Redis interface, key helpers, TTL patterns.
   - Use for: L2 cache reads/writes, invalidation helpers, sorted-set operations.

5. **`cache/`**
   - Responsibility: cache orchestration and semantic invalidation (`CacheManager`).
   - Use for: event-driven invalidation (exam generation change, profile update, etc.).

6. **`performance/`**
   - Responsibility: metrics/performance monitoring.
   - Use for: operation timings and optimization instrumentation.

### AI and exam generation

7. **`genkit/`**
   - Responsibility: AI flows (planner, quiz generator, report/summaries support).
   - Use for: schema-validated model generation through shared utils.

8. **`examRateLimit/`**
   - Responsibility: rate-limit checks with DB/cache-aware logic.
   - Use for: compatibility paths and detailed rate-limit info.

9. **`optimizedRateLimit/`**
   - Responsibility: high-performance Redis sorted-set rate limiting.
   - Use for: hot-path exam creation limit checks and event recording.

10. **`cloudTasks/`**
    - Responsibility: task service abstractions + queue manager.
    - Use for: creating exam generation / exam report / knowledge pooling tasks.

### Domain and orchestration services

11. **`knowledgePooling/`**
    - Responsibility: post-exam knowledge synthesis and related generation.
    - Use for: generating/updating pooled learning insights.

12. **`certSummaryService.ts`**
    - Responsibility: certification summary retrieval/generation path.
    - Use for: cert-level summaries and prerequisite-aware behavior.

13. **`exam-generation-logger.ts` / `exam-generation-metrics.ts` / `exam-generation-health-check.ts`**
    - Responsibility: observability and health for generation pipeline.
    - Use for: structured generation telemetry and monitoring checks.

### Security, integrations, and infrastructure

14. **`jwt/`**
    - Responsibility: service/public JWT creation and verification utilities.
    - Use for: non-Firebase token-based service auth paths.

15. **`gcp/`**
    - Responsibility: GCP integration helpers (Cloud Tasks, Secret Manager, etc.).
    - Use for: cloud infra interactions behind service boundary.

16. **`resend/`**
    - Responsibility: email delivery integration.
    - Use for: transactional notifications.

17. **`monitoring/`**
    - Responsibility: monitoring utilities and support.
    - Use for: health/reporting hooks beyond per-domain metrics.

18. **`firms/`, `data/`, `database/`**
    - Responsibility: domain-specific and data access helper modules.
    - Use for: domain aggregation/use-case helpers where applicable.

## Which Service to Call (Quick Matrix)

- Add/update relational exam metadata → `prisma/`
- Read/write Redis cache and TTL policy → `redis/` + `cache/`
- Enqueue async exam work → `cloudTasks/`
- Generate AI topics/questions/reports → `genkit/`
- Enforce exam creation rate limit → `optimizedRateLimit/`
- Handle post-exam knowledge insights → `knowledgePooling/`
- Verify or generate public JWT → `jwt/`

## Service Boundary Rules

- Do not bypass service layer to call SDKs directly if a service already exists.
- Keep endpoint handlers thin: parse input, call service(s), return `ApiResponse<T>`.
- Keep retry/idempotency behavior in service/task handlers, not controller glue.

## Dangerous Areas / Anti-patterns

- Mixed concerns: endpoint doing direct DB + direct Redis + direct Genkit inline.
- Duplicate queue creation logic outside queue manager utilities.
- Creating new one-off services when an existing domain service can be extended.
- Silent fallback behavior without logging in infrastructure services.

## Related Docs

- [Prisma Patterns](../database/prisma-patterns.md) – relational data conventions
- [Redis Patterns](../cache/redis-patterns.md) – caching rules and invalidation
- [Exam Generation (AI Services Invariants)](../ai-services/exam-generation.md) – AI guardrails
- [Exam Generation Workflow](../workflow/exam-generation-workflow.md) – sequencing across services
- [API Endpoint Conventions](../api/endpoint-conventions.md) – endpoint-to-service usage
