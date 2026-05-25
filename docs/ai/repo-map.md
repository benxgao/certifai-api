# Repository Map: System Boundaries & Critical Context

> **Source of truth**: Live repository structure and `docs/ARCHITECTURE.md`
> **Last reviewed**: 2026-05-26
> **Owner**: Engineering Team / AI Assistants

## Purpose

This document provides a high-level map of the certifai-api system boundaries, critical invariants, and dangerous areas. AI assistants use this as the entry point for understanding the project structure, constraints, and rules before reading domain-specific docs.

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│          Frontend (Next.js 15)                       │
│          (certifai-app)                              │
└──────────────────┬──────────────────────────────────┘
                   │ REST API / WebSockets
                   ▼
┌─────────────────────────────────────────────────────┐
│     Backend (Firebase Functions + Express.js)        │
│     (certifai-api/functions)                         │
├─────────────────────────────────────────────────────┤
│  Exam Management         AI Generation (Genkit)     │
│  (Adaptive exam gen)     (Vertex AI)                │
│  Knowledge Pooling       Real-time polling          │
└────────┬─────────────────┬──────────────┬───────────┘
         │                 │              │
         ▼                 ▼              ▼
    PostgreSQL         Firestore       Redis Cache
    (Prisma)           (Questions      (L2 Cache)
                       Reports)
```

## Project Structure

| Directory                      | Purpose                                            | Key Files                                                     |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| `functions/src/`               | Server entry point and Express app setup           | `index.ts`, `endpoints/`, `middlewares/`, `services/`         |
| `functions/src/endpoints/api/` | All REST endpoints organized by domain             | `ai/`, `auth/`, `cache/`, `examReportErrorMap.ts`, `index.ts` |
| `functions/src/middlewares/`   | Auth chain and request middleware                  | `authCheck.ts`, `jwtAuth.ts`, `verifyUserAccess.ts`           |
| `functions/src/services/`      | Business logic layer (Prisma, Redis, Genkit, etc.) | 20+ service subdirectories                                    |
| `functions/src/types/`         | Type definitions and enums                         | `express.ts`, `index.ts`, `enums.ts`, `errors.ts`             |
| `functions/__tests__/`         | Unit and integration tests                         | Test files organized by domain                                |
| `docs/`                        | Architecture, API, database, and operations docs   | See [Assistant Context Index](./assistant-context-index.md)   |

## Critical Invariants (Non-negotiable Rules)

### 1. **API Response Envelope**

All API responses must use the `ApiResponse<T>` type:

```typescript
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}
interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
}
type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

**Where documented**: [API Response Envelope](../api/response-envelope.md)

### 2. **Auth Middleware Chain**

Authentication entry point: **`src/middlewares/authCheck.ts`**

Flow:

1. `authCheck` – Extracts Firebase token from header
2. `jwtAuth` – Decodes and verifies token
3. `verifyUserAccess` – Looks up user in database, sets `req.verified_user`

**Key invariant**: `req.user` is NEVER set directly; use `req.verified_user` only when available.

**Where documented**: [Auth Patterns](../auth/auth-patterns.md) | [Auth Verification Workflow](../workflow/auth-verification-workflow.md)

### 3. **Service Layer Boundary**

- **Never** access Prisma client directly outside `functions/src/services/prisma/`
- All database queries must go through the Prisma service layer in `functions/src/services/`
- All cache operations must go through Redis service in `functions/src/services/redis/`

**Where documented**: [Service Catalog](../services/service-catalog.md)

### 4. **Cloud Tasks Behavior – LOCAL vs. PRODUCTION**

- **Local dev**: Cloud Tasks execute immediately (synchronously) in the function
- **Production**: Cloud Tasks execute asynchronously in queue

**Dangerous**: Assuming async behavior in local dev can mask bugs. Always test with explicit async/await.

**Where documented**: [Testing Strategy](../testing/strategy.md)

### 5. **Genkit/Vertex AI Rate Limiting**

- **Global rate limit**: 3 exams generated per user per 24 hours
- **Implementation**: `functions/src/services/examRateLimit/` and `optimizedRateLimit/`
- **Enforcement**: Checked before calling Genkit service

**Dangerous**: Bypassing rate limit can cause cost overruns and service degradation.

**Where documented**: [AI Services Conventions](../ai-services/exam-generation.md)

### 6. **Type Safety – No `any` Types**

- All Prisma queries must return typed data (use generated Prisma types)
- All Express handlers must type `req` and `res` using `TypedRequestHandler<ReqBody, ResBody, ...>`
- All component props and SWR hooks must have explicit type parameters

**Where documented**: [Backend Coding Instructions](instruction.instructions.md#type-safety-notes)

### 7. **Exam Status Lifecycle**

Valid status transitions:

```
QUESTIONS_GENERATING → READY → STARTED → COMPLETED
  (questions being     (ready    (user       (user
   created)            for       started)    submitted)
                       user)
```

**Dangerous**: Status updates must be atomic; out-of-order updates can corrupt exam state.

**Where documented**: [Exam Status Flow](../architecture/exam_active.md)

## System Boundaries (What Goes Where)

### Frontend (certifai-app)

- Calls backend REST API only
- No direct database access
- No direct Firebase Functions calls
- All auth handled via Firebase Auth SDK

### Backend (certifai-api/functions)

- Express.js HTTP server
- Handles all business logic, auth, and data persistence
- Communicates with PostgreSQL (via Prisma), Firestore, Redis, and Vertex AI
- Enqueues Cloud Tasks for async work (exam generation)

### Data Storage

- **PostgreSQL (Prisma)**: User accounts, exam metadata, certification mappings (source of truth)
- **Firestore**: Questions, exam reports, topic performance history
- **Redis**: Cached query results, session data, rate-limit counters
- **Cloud Storage**: Generated files (exam PDFs, reports)

## Entry Points

| Entry Point            | Purpose                                                  | File                                                         |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| HTTP endpoints         | REST API for exam, profile, cache management             | `functions/src/endpoints/api/` and routers in each subdomain |
| Cloud Tasks delegators | Async job execution (exam generation, knowledge pooling) | `functions/src/delegators/`                                  |
| Scheduled functions    | Cleanup, monitoring, health checks                       | `functions/src/scheduledFunctions/`                          |
| Firebase Auth webhooks | User account lifecycle (custom claims, deletion)         | TBD (not yet exposed)                                        |

## Dangerous Areas (High-Risk Patterns)

### 🔴 CRITICAL: Privileged Operations

- **User impersonation**: Never trust `user_id` from `req.query` or `req.body` alone. Always verify against `req.verified_user` from auth middleware.
- **Bulk operations**: Always paginate; never fetch all records at once.
- **Cost drivers**: Genkit calls, Large FileStore fetches, High-volume Redis keys. Monitor costs in Cloud Logging.

### 🔴 CRITICAL: Data Consistency

- **Concurrent exam updates**: Multiple requests may try to transition exam status simultaneously. Use database-level locks or optimistic concurrency patterns.
- **Cache invalidation**: Stale cache can serve outdated exam results for hours. Always invalidate cache when exam status changes.
- **Async race conditions**: Cloud Tasks may retry silently. Ensure idempotent handlers (check before insert/update behavior).

### 🟠 HIGH: Local Dev Misconfigurations

- **Missing `.env` file**: Firebase config not set → all calls fail silently.
- **PostgreSQL not running**: `npm run serve` connects but queries hang.
- **Firebase emulator not started**: Auth checks fail unexpectedly.

### 🟠 HIGH: Type Safety Gaps

- Using `any` types circumvents all compile-time checks. If adding `any`, document why.
- Using `data?.data` pattern when response type has no `.data` field creates runtime errors.

## Best Practices at a Glance

| Goal                      | Pattern                                                                                                             | Where                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Add a protected endpoint  | 1. Define route in `endpoints/api/` with `AuthenticatedRequest`. 2. Use Prisma service. 3. Return `ApiResponse<T>`. | [API Conventions](../api/endpoint-conventions.md)                 |
| Add a caching layer       | Use Redis service in `functions/src/services/redis/` with explicit TTL.                                             | [Redis Patterns](../cache/redis-patterns.md)                      |
| Add a Prisma migration    | Follow `src/services/prisma/migrations.ts` for safe migration workflow.                                             | [Prisma Patterns](../database/prisma-patterns.md)                 |
| Add exam generation logic | Rate-limit first, then call Genkit service with model config.                                                       | [Genkit Patterns](../ai-services/exam-generation.md)              |
| Debug a Cloud Tasks issue | Check logs in Cloud Logging. Remember: SYNC in local dev, ASYNC in production.                                      | [Cloud Tasks (Workflow)](../workflow/exam-generation-workflow.md) |

## Quick Navigation

**I want to...** → **Read this**

- Understand system architecture → [Architecture Overview](../architecture/firebase-functions-structure.md)
- Add/modify an API endpoint → [API Endpoint Conventions](../api/endpoint-conventions.md)
- Work with the database → [Prisma Patterns](../database/prisma-patterns.md)
- Implement caching → [Redis Patterns](../cache/redis-patterns.md)
- Understand the auth chain → [Auth Patterns](../auth/auth-patterns.md) → [Auth Verification Workflow](../workflow/auth-verification-workflow.md)
- Generate exams with AI → [AI Services Conventions](../ai-services/exam-generation.md) → [Exam Generation Workflow](../workflow/exam-generation-workflow.md)
- Find the right service → [Service Catalog](../services/service-catalog.md)
- Write tests → [Testing Strategy](../testing/strategy.md)
- Deploy changes → [Deployment Guide](../operations/deployment.md)

## Related Docs

- [Architecture: Firebase Functions Structure](../architecture/firebase-functions-structure.md) – Detailed routing and middleware organization
- [API: Endpoint Conventions](../api/endpoint-conventions.md) – REST naming and response contracts
- [Auth: Auth Patterns](../auth/auth-patterns.md) – Auth invariants
- [Services: Service Catalog](../services/service-catalog.md) – Inventory of all 20+ services
- [Workflows](../workflow/) – Step-by-step procedures for multi-step domains (exam generation, auth verification)
- [Assistant Context Index](./assistant-context-index.md) – Complete index of all canonical docs
- [Assistant Guide](./guide.md) – Task routing: which doc to load for which task
