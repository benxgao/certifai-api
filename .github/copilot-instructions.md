# Copilot Instructions (certifai-api)

> **Source of truth**: Assistant behavior contract for docs-first implementation in this repository
> **Last reviewed**: 2026-05-29
> **Owner**: Engineering Team / AI Assistants

## Mission

Use canonical docs as the primary source for planning and implementation decisions. Only use code scanning when docs are insufficient, and feed findings back into docs to improve future assistant runs.

## Docs-First Decision Rules (Required)

For planning and implementation tasks:

1. Load routing and index docs first:
   - `docs/ai/guide.md`
   - `docs/ai/assistant-context-index.md`
2. Declare a `Docs Needed` list before implementation decisions.
3. Use docs specs as the default decision source.
4. If docs are insufficient:
   - record insufficiency clearly
   - use minimal fallback code scan for that decision only
   - record exact docs update action
5. Keep decision traceability via a decision evidence log.

## Required Evidence Schema

For major decisions, capture:

- `Decision`
- `Docs cited`
- `Sufficiency verdict` (`Sufficient` / `Insufficient`)
- `Fallback code scan used?` (`No` / `Yes` + reason)
- `Doc update action` (`None` / concrete doc update / blocker owner+date)

## Rollout Behavior Requirements

When authoring or executing rollout plans:

- Use `ai_oriented_kanban/templates/rollout-plan-template.md`.
- Confirm rollout spec includes `Scope`, `Assumptions`, `Constraints`, `Decision Log`, and `Acceptance Criteria`.
- Complete docs-first sections before implementation:
  - `Docs-First Retrieval Checklist`
  - `Docs Needed`
  - `Decision Evidence Log`
- Ensure closing phases are present and executed:
  - Docs Sync
  - AI-ready reflection and next-plan handoff
  - Docs-only Simulation Drill
  - Rollout Eval & Health Score

## Pre-Implementation Gate (Required)

Before writing implementation code, assistants must:

1. Declare `Docs Needed` with reason per document.
2. Record an initial decision evidence row for each major decision.
3. Mark sufficiency verdict per decision (`Sufficient` / `Insufficient`).

If any decision is `Insufficient`, use fallback code scan only for that decision and record the exact docs remediation action.

## Docs Remediation Contract

If code reality diverges from docs or docs are insufficient:

- Update canonical docs in the same task/rollout whenever possible.
- Register new docs in:
  - `docs/ai/assistant-context-index.md`
  - `docs/ai/guide.md`
- Ensure touched docs include `## Related Docs` links.

## Quality Gates Before Completion

Do not mark work complete unless:

- Docs-first evidence fields are filled for major decisions.
- Any insufficiency has remediation updates or explicit blocker ownership.
- Relevant docs `Last reviewed` fields are updated.
- Retrieval/simulation expectations remain satisfied per `docs/operations/ai-retrieval-smoke-tests.md`.

## Related Docs

- [Assistant Guide](../docs/ai/guide.md)
- [Assistant Context Index](../docs/ai/assistant-context-index.md)
- [Docs Maintenance Protocol](../docs/operations/docs-maintenance.md)
- [AI Retrieval Smoke Tests](../docs/operations/ai-retrieval-smoke-tests.md)
- [Spec-First + Kanban Integration Policy](../docs/operations/spec-first-kanban-integration.md)
- [Project Simulation Readiness](../docs/ai/project-simulation-readiness.md)
- [Rollout Plan Template](../ai_oriented_kanban/templates/rollout-plan-template.md)
- [Executive Report Template](../ai_oriented_kanban/templates/excutive-report-template.md)
