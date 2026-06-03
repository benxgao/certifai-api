# Copilot Instructions (certifai-api: Lean Router)

> **Source of truth**: `docs/` (domain specs), routed from this file
> **Last reviewed**: 2026-06-03
> **Owner**: Engineering Team / AI Assistants

This file stays intentionally short. Domain behavior belongs in canonical docs.

## Start Here (Mandatory)

1. Load [`docs/ai/guide.md`](../docs/ai/guide.md) first.
2. Use [`docs/ai/assistant-context-index.md`](../docs/ai/assistant-context-index.md) to select domain docs.
3. For planning/rollout tasks, declare `Docs Needed` and a `Decision Evidence Log` before implementation decisions.
4. If docs are insufficient (missing/ambiguous/outdated), run a bounded fallback code scan for that decision only and update docs in the same change.

## Domain Instruction Allocation (`docs/` is canonical)

| Domain | Canonical folder | Primary entry docs |
| --- | --- | --- |
| AI routing + retrieval | `docs/ai/` | `guide.md`, `assistant-context-index.md`, `repo-map.md`, `project-simulation-readiness.md` |
| API contracts + endpoints | `docs/api/` | `endpoint-conventions.md`, `response-envelope.md` |
| Auth + access verification | `docs/auth/`, `docs/workflow/` | `auth-patterns.md`, `auth-verification-workflow.md` |
| Database + ORM | `docs/database/` | `prisma-patterns.md` |
| Cache | `docs/cache/` | `redis-patterns.md` |
| AI services + exam generation | `docs/ai-services/`, `docs/workflow/` | `exam-generation.md`, `exam-generation-workflow.md` |
| Services layer | `docs/services/` | `service-catalog.md` |
| Architecture + system structure | `docs/architecture/` | `firebase-functions-structure.md` |
| Testing | `docs/testing/` | `strategy.md` |
| Operations + governance | `docs/operations/` | `deployment.md`, `docs-maintenance.md`, `spec-first-kanban-integration.md`, `ai-retrieval-smoke-tests.md` |
| Product glossary | `docs/product/` | `glossary.md` |
| Architecture decisions | `docs/adr/` | `0001-docs-architecture-mvp.md` |

## Non-Negotiable Guardrails

- Never run `npm run build` during assistant sessions.
- Never reset the database.
- Never commit Firebase config/service-account credentials.
- Never hardcode API endpoints; use environment/config.
- Keep scope tight: no unsolicited refactors or feature expansion.

## Validation Defaults

- Run targeted tests/checks for touched areas.
- Run TypeScript checks after significant type changes.
- `npm run lint` may be skipped only when a known repo-level blocker exists; record the reason in rollout/session notes.

## Rollout Planning Trigger

For rollout/migration/implementation plans, use [`ai_oriented_kanban/templates/rollout-plan-template.md`](../ai_oriented_kanban/templates/rollout-plan-template.md) and apply policy requirements from [`docs/operations/spec-first-kanban-integration.md`](../docs/operations/spec-first-kanban-integration.md).

## Related Docs

- [Assistant Guide](../docs/ai/guide.md)
- [Assistant Context Index](../docs/ai/assistant-context-index.md)
- [Docs Maintenance Protocol](../docs/operations/docs-maintenance.md)
- [AI Retrieval Smoke Tests](../docs/operations/ai-retrieval-smoke-tests.md)
- [Spec-First + Kanban Integration Policy](../docs/operations/spec-first-kanban-integration.md)
- [Project Simulation Readiness](../docs/ai/project-simulation-readiness.md)
