# AI Retrieval Smoke Tests

> **Source of truth**: Canonical docs under `docs/ai/`, domain docs, and workflow docs
> **Last reviewed**: 2026-05-26
> **Owner**: Engineering Team

## Purpose

Provide a lightweight QA protocol to verify assistants can answer common engineering tasks using canonical docs only, with no invented details.

## Test Method

For each prompt:

1. Ask the assistant prompt exactly as written.
2. Verify answer cites/uses relevant canonical docs.
3. Verify no invented endpoints/services/rules.
4. Verify invariants vs workflow separation is respected.

Pass criteria per prompt:

- Correct primary docs selected
- Key constraints included
- No contradictions with canonical docs

## Representative Prompts (Required Set)

### 1) Add a new protected endpoint

**Prompt:** “Add a new protected endpoint for user settings and explain required middleware + response contract.”

Expected doc path usage:

- `docs/api/endpoint-conventions.md`
- `docs/auth/auth-patterns.md`
- `docs/workflow/auth-verification-workflow.md`
- `docs/api/response-envelope.md`

### 2) Implement exam generation rate limiting

**Prompt:** “Implement exam generation rate limiting for 3 exams per 24h and describe the safest service path.”

Expected doc path usage:

- `docs/ai-services/exam-generation.md`
- `docs/services/service-catalog.md`
- `docs/cache/redis-patterns.md`
- `docs/workflow/exam-generation-workflow.md`

### 3) Add a Redis-cached query

**Prompt:** “Add caching for a paginated certifications query with TTL and invalidation guidance.”

Expected doc path usage:

- `docs/cache/redis-patterns.md`
- `docs/database/prisma-patterns.md`
- `docs/services/service-catalog.md`

### 4) Debug Cloud Tasks local-dev issue

**Prompt:** “Why does task behavior look synchronous locally but async in prod, and how should tests account for it?”

Expected doc path usage:

- `docs/workflow/exam-generation-workflow.md`
- `docs/testing/strategy.md`
- `docs/ai/repo-map.md`

### 5) Add a Prisma migration safely

**Prompt:** “Add a non-breaking Prisma schema change and list migration safety checks.”

Expected doc path usage:

- `docs/database/prisma-patterns.md`
- `docs/operations/prisma-migrate.md`
- `docs/testing/strategy.md`

## Evaluation Checklist

- [ ] Used canonical docs (index/guide/domain/workflow), not plans-only docs
- [ ] Correctly distinguished invariant rules from step-by-step workflow
- [ ] Returned correct API/auth/service boundaries
- [ ] Included relevant caveats (rate limits, queue behavior, cache invalidation)
- [ ] No hallucinated files, endpoints, or contracts

## Failure Handling

If a smoke test fails:

1. Determine whether routing (`docs/ai/guide.md`) is missing/weak.
2. Determine whether index entry (`docs/ai/assistant-context-index.md`) is missing.
3. Update canonical doc(s) and add backlinks in `## Related Docs`.
4. Re-run failed prompts.

## Related Docs

- [Assistant Context Index](../ai/assistant-context-index.md) – discoverability entrypoint
- [Assistant Guide](../ai/guide.md) – task routing source
- [Docs Maintenance Protocol](./docs-maintenance.md) – governance and review cadence
- [Exam Generation Workflow](../workflow/exam-generation-workflow.md) – queue/async lifecycle reference
