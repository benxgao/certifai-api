# Exam Generation (AI Services Invariants)

> **Source of truth**: `functions/src/services/genkit/`, `functions/src/services/examRateLimit/`, `functions/src/services/optimizedRateLimit/`, `functions/src/services/cloudTasks/`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Define stable AI-service invariants for exam generation: Genkit usage, model/config defaults, rate limiting, and queueing guardrails.

> This document contains **invariants only**. Step-by-step sequencing belongs in [Exam Generation Workflow](../workflow/exam-generation-workflow.md).

## Key Concepts

- **Genkit singleton initialization** with timeout-protected retry behavior.
- **Default model**: `gemini-2.5-flash` (`DEFAULT_GENAI_MODEL`).
- **Structured generation** via Zod schemas and validated outputs.
- **Rate limiting before generation** for cost and fairness controls.
- **Cloud Tasks offload** for asynchronous generation batches.

## Conventions / Rules (Invariants Only)

### 1) AI initialization invariant

All flows must use shared AI instance factories/utilities:

- `createAiInstancePromise()`
- `generateWithValidation()`
- `validateAndFilterResponse()`
- `handleGenerationError()`

Do not create per-request ad-hoc AI clients in handlers.

### 2) Output validation invariant

LLM output must be schema-validated (Zod) before use/storage.

- Reject null/empty or malformed output.
- Filter invalid generated items before persistence.

### 3) Rate-limit invariant

Exam generation is rate-limited per user (24h window).

- Optimized path uses Redis sorted-set strategy (`OptimizedRateLimitService`).
- Fallback/legacy path exists in `examRateLimit` service.
- Enforce before expensive generation begins.

### 4) Queue invariant

Generation jobs are task-queued and require queue readiness checks.

- Queue names are standardized (`exam-questions-queue`, etc.).
- Validate queue availability before creating tasks.

### 5) Status invariant

Exam status transitions must use enum values and valid lifecycle progression.

- Generation failures map to failure state (`QUESTION_GENERATION_FAILED`).
- In-progress generation state is explicit (`QUESTIONS_GENERATING`).

### 6) Local-vs-production execution invariant

Cloud Task behavior differs by environment:

- Local development may execute tasks immediately.
- Production executes asynchronously via queues.

Code and tests must not rely on only one behavior mode.

### 7) Cost and reliability invariant

Generation operations must be observable and resilient:

- Structured logging around generation attempts/results.
- Retry-safe/idempotent handling for task delivery.

## Dangerous Areas / Anti-patterns

- Calling Genkit directly from request handlers without queue strategy.
- Skipping schema validation and persisting raw model output.
- Bypassing rate-limit checks.
- Assuming task queue exists without readiness checks.
- Hard-coding model or token parameters in random call sites.

## Related Docs

- [Exam Generation Workflow](../workflow/exam-generation-workflow.md) – full lifecycle sequence
- [Service Catalog](../services/service-catalog.md) – where Genkit/rate-limit/cloudTasks services live
- [Redis Patterns](../cache/redis-patterns.md) – rate-limit sorted set and cache behavior
- [Testing Strategy](../testing/strategy.md) – async + task behavior test guidance
