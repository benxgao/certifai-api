# Project Simulation Readiness (Docs-Only)

> **Source of truth**: Docs-only execution readiness rubric for assistant-led planning
> **Last reviewed**: 2026-05-29
> **Owner**: Engineering Team / AI Assistants

## Purpose

Define how to evaluate whether a comparable project can be planned and executed by an assistant using docs specs as primary context.

## Readiness Standard

A docs set is simulation-ready when an assistant can:

1. List required docs before implementation planning.
2. Produce decision evidence for major choices using canonical docs.
3. Identify docs insufficiency without hallucination.
4. Propose concrete doc updates that close insufficiency gaps.
5. Complete a planning simulation with no unjustified fallback code scans.

## Minimum Inputs

At minimum, the simulation must load:

- `docs/ai/guide.md`
- `docs/ai/assistant-context-index.md`
- `docs/operations/docs-maintenance.md`
- `docs/operations/ai-retrieval-smoke-tests.md`
- Any domain docs required by the task scenario

## Drill Output Requirements

Each simulation run must include:

- `Docs Needed` list with rationale
- Decision evidence table:

| Decision | Docs cited | Sufficiency | Fallback scan | Doc update action |
| --- | --- | --- | --- | --- |
| <decision> | <doc paths> | Sufficient/Insufficient | No/Yes (+ reason) | None / <specific update> |

- Summary verdict: `Pass`, `Partial`, or `Fail`
- Remediation backlog (if partial/fail)

## Scoring Rubric

| Dimension | Max Points | Pass condition |
| --- | --- | --- |
| Docs Needed quality | 25 | Complete list before implementation planning |
| Decision traceability | 35 | Major decisions mapped to canonical docs |
| Insufficiency handling | 20 | All gaps produce concrete doc updates/blockers |
| Fallback discipline | 20 | No unjustified code scans |
| **Total** | **100** | **Pass threshold: >= 80** |

## Failure Modes

Common failure indicators:

- Missing `Docs Needed` section
- Decision claims with no doc citation
- Fallback code scan with no insufficiency rationale
- Vague remediation (e.g., “update docs later”) without target docs

## Remediation Loop

When simulation is `Partial` or `Fail`:

1. Update missing/ambiguous canonical docs.
2. Register updates in `assistant-context-index.md` and routing in `guide.md`.
3. Re-run simulation prompt from `ai-retrieval-smoke-tests.md`.
4. Record before/after result in rollout session note.

## Related Docs

- [Assistant Guide](./guide.md) – routing to required docs by task
- [Assistant Context Index](./assistant-context-index.md) – canonical doc inventory
- [Docs Maintenance Protocol](../operations/docs-maintenance.md) – governance contract and enforcement
- [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md) – simulation prompts and QA checklist
- [Spec-First + Kanban Integration Policy](../operations/spec-first-kanban-integration.md) – rollout contract for docs-first decision evidence
