# AI Retrieval Smoke Tests

> **Source of truth**: Canonical docs under `docs/ai/`, domain docs, and workflow docs
> **Last reviewed**: 2026-05-29
> **Owner**: Engineering Team

## Purpose

Provide a lightweight QA protocol to verify assistants can answer common engineering tasks using canonical docs first, with no invented details, while explicitly handling doc insufficiency via remediation updates.

## Test Method

For each prompt:

1. Ask the assistant prompt exactly as written.
2. Verify the assistant lists a `Docs Needed` set before implementation decisions.
3. Verify answer cites/uses relevant canonical docs.
4. Verify no invented endpoints/services/rules.
5. Verify invariants vs workflow separation is respected.
6. If docs are insufficient, verify assistant records insufficiency and proposes concrete doc updates.

Pass criteria per prompt:

- Correct primary docs selected
- `Docs Needed` list present and relevant
- Major decisions include doc-based evidence and sufficiency verdict
- Key constraints included
- No contradictions with canonical docs
- If insufficiency is detected, remediation targets are explicit

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

### 6) Create a rollout plan using docs-first governance

**Prompt:** “Create a rollout plan for a cross-service auth + cache change. List the docs you need first, then produce decision evidence and note where docs are insufficient.”

Expected doc path usage:

- `docs/ai/guide.md`
- `docs/ai/assistant-context-index.md`
- `docs/operations/docs-maintenance.md`
- `ai_oriented_kanban/templates/rollout-plan-template.md`

Expected behavior:

- Includes a `Docs Needed` table before implementation details.
- Includes `Decision Evidence Log` entries with sufficiency verdict.
- For insufficiency, includes exact docs update targets.

### 7) Validate docs-only simulation readiness

**Prompt:** “Given only the docs, can you run a planning simulation for a comparable feature and state whether docs are sufficient? If not, list exact doc updates required.”

Expected doc path usage:

- `docs/ai/guide.md`
- `docs/ai/assistant-context-index.md`
- `docs/operations/docs-maintenance.md`
- `docs/operations/ai-retrieval-smoke-tests.md`

Expected behavior:

- Returns a docs-first decision path and explicit sufficiency verdict.
- Uses fallback code scan only when justified by missing/ambiguous docs.
- Produces a remediation list that can be applied in Docs Sync.

## Evaluation Checklist

- [ ] Used canonical docs (index/guide/domain/workflow), not plans-only docs
- [ ] Declared `Docs Needed` before implementation details
- [ ] Provided decision-level evidence (docs cited + sufficiency + fallback + update action)
- [ ] Correctly distinguished invariant rules from step-by-step workflow
- [ ] Returned correct API/auth/service boundaries
- [ ] Included relevant caveats (rate limits, queue behavior, cache invalidation)
- [ ] No hallucinated files, endpoints, or contracts
- [ ] If docs were insufficient, listed concrete docs updates (not vague notes)

## Failure Handling

If a smoke test fails:

1. Determine whether routing (`docs/ai/guide.md`) is missing/weak.
2. Determine whether index entry (`docs/ai/assistant-context-index.md`) is missing.
3. Determine whether decision evidence or docs-needed requirements are missing from templates/policy docs.
4. Update canonical doc(s) and add backlinks in `## Related Docs`.
5. Re-run failed prompts and record whether insufficiency loop was closed.

## Related Docs

- [Assistant Context Index](../ai/assistant-context-index.md) – discoverability entrypoint
- [Assistant Guide](../ai/guide.md) – task routing source
- [Docs Maintenance Protocol](./docs-maintenance.md) – governance and review cadence
- [Rollout Plan Template](../../ai_oriented_kanban/templates/rollout-plan-template.md) – required docs-first rollout structure
- [Exam Generation Workflow](../workflow/exam-generation-workflow.md) – queue/async lifecycle reference
