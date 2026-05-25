# Prisma Patterns

> **Source of truth**: `functions/src/services/prisma/index.ts`, `functions/prisma/schema.prisma`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Define how `certifai-api` uses Prisma safely and consistently: singleton client usage, transaction conventions, query patterns, and migration guardrails.

## Key Concepts

- **Singleton Prisma client**: Prisma is initialized once and reused across hot reloads.
- **Service-layer boundary**: endpoint handlers should call service logic; avoid ad-hoc direct DB logic spread across endpoints.
- **Typed enums from Prisma**: use exported enums (`CertificationStatus`, `ExamStatus`, `DifficultyLevel`) instead of string literals.
- **Concurrency-tuned transaction defaults**: `ReadCommitted`, tuned `timeout`/`maxWait` for high-concurrency writes.

## Conventions / Rules

### 1) Use the shared Prisma client

Use `prismaInstance` from `functions/src/services/prisma/index.ts`.

- Do not create new `PrismaClient()` instances in handlers/services.
- Reuse exported enums from the same module.

### 2) Keep DB operations typed

- Return typed results from Prisma queries.
- Avoid `any` for query results and request payload adaptation.
- Prefer `select` for minimal field retrieval when only subset is needed.

### 3) Use transactions for multi-step writes

For multi-step write paths (e.g., exam creation + status updates), use transactional/batched operations.

- Current code uses `BatchWriteOptimizer` with transactional execution for critical paths.
- Keep related state transitions atomic to avoid partial writes.

### 4) Connection and datasource behavior

Prisma datasource URL is built from `DATABASE_URL` with performance parameters in `getOptimizedConnectionUrl()`.

- Missing `DATABASE_URL` is a hard error.
- Supabase pooled URLs (`pooler.supabase.com`) enable `pgbouncer=true` and lower connection limit.

### 5) Migration safety rules

- Add defaults or nullable fields when introducing new required schema elements.
- Avoid destructive changes without backward-compatibility plan.
- Generate/apply migrations from `functions/` context with review.

## Query Patterns

### Pattern A: Ownership checks with select

Common auth path:

- Query by `user_id`
- Select only ownership fields
- Compare with authenticated token context

Example source pattern: `verifyUserAccess.ts` uses `findUnique` + `select { user_id, firebase_user_id }`.

### Pattern B: Count + oldest timestamp for rate windows

Rate-limit implementations use:

- `count` in rolling window
- `findFirst(orderBy: asc)` to compute reset time

This keeps logic deterministic and explainable.

### Pattern C: Status-driven lifecycle updates

Exam pipeline writes explicit enum states (`QUESTIONS_GENERATING`, `QUESTION_GENERATION_FAILED`, etc.) and should always preserve valid state transitions.

## Dangerous Areas / Anti-patterns

- Creating new Prisma clients outside `services/prisma/index.ts`.
- Updating related records across multiple queries without transaction/atomic grouping.
- Using raw string status values instead of enum constants.
- Pulling full records when only 1-2 fields are needed.
- Schema changes that force immediate non-null values without defaults/backfill.

## Verification Checklist

- `prismaInstance` imported from `services/prisma/index.ts` in new DB-touching code.
- Enum comparisons use `ExamStatus.*` / `CertificationStatus.*`.
- Multi-write operations are transactional.
- No new `any` in Prisma result shaping.

## Related Docs

- [Service Catalog](../services/service-catalog.md) – where Prisma sits in service boundaries
- [API Endpoint Conventions](../api/endpoint-conventions.md) – handler + contract behavior
- [Response Envelope](../api/response-envelope.md) – response contract from DB-backed handlers
- [Redis Patterns](../cache/redis-patterns.md) – cache interplay with Prisma-backed reads
- [Operations: Prisma Migration](../operations/prisma-migrate.md) – operational migration workflow
