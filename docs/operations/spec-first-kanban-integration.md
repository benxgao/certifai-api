# Spec-First + Kanban Integration Policy

> **Source of truth**: Docs-first rollout governance for `ai_oriented_kanban/`
> **Last reviewed**: 2026-05-29
> **Owner**: Engineering Team / AI Assistants

## Purpose

Define the mandatory docs-first contract for rollout planning and execution so assistants can make implementation decisions from docs specs first, then improve docs when gaps are found.

## Policy Summary (Required)

Every rollout plan in `ai_oriented_kanban/` must include:

1. **Docs Needed (before implementation)**
   - List each required doc and why it is needed.
2. **Decision Evidence Log (during planning/execution)**
   - Record `Decision`, `Docs cited`, `Sufficiency verdict`, `Fallback code scan`, and `Doc update action`.
3. **Insufficiency remediation loop**
   - If docs are insufficient, update docs in the same rollout (or create explicit blocker with owner + due date).
4. **Mandatory closing phases**
   - Docs Sync
   - AI-ready reflection and next-plan handoff
   - Docs-only simulation drill
   - Rollout evaluation and health score

## Required Spec Format (Before Implementation)

Each rollout spec must explicitly define:

1. **Scope**
   - In-scope outcomes and out-of-scope boundaries.
2. **Assumptions**
   - Planning assumptions with supporting doc references.
3. **Constraints**
   - Technical/process restrictions and non-negotiable guardrails.
4. **Decision Log**
   - Major decisions with docs evidence and sufficiency verdicts.
5. **Acceptance Criteria**
   - Independent verification checks that determine done/not-done.

### Acceptance Criteria Schema (Required)

Use measurable pass/fail style:

- `Given`: preconditions/context
- `When`: action/change performed
- `Then`: observable and verifiable result
- `Evidence`: command/check/manual proof used

Example criterion:

- **Given** rollout Phase 1 files are updated
- **When** reviewer checks `.github/pull_request_template.md`
- **Then** `Docs Needed` and decision evidence capture are explicitly required
- **Evidence** PR template section includes those checklist items

## Required Decision Evidence Schema

Use this schema in rollout artifacts:

| Field | Required | Description |
| --- | --- | --- |
| Decision | Yes | What choice was made |
| Docs cited | Yes | Canonical docs used to justify decision |
| Sufficiency verdict | Yes | `Sufficient` or `Insufficient` |
| Fallback code scan used? | Yes | `No` or `Yes` + reason |
| Doc update action | Yes | `None`, specific doc update, or explicit blocker |

## Reviewer Gate

Reject rollout work if any are missing:

- No `Docs Needed` declaration before implementation details
- No decision evidence for key decisions
- Fallback code scan without insufficiency reason
- Insufficiency discovered but no doc update action or blocker ownership

Approve only when all are true:

- Spec includes `Scope`, `Assumptions`, `Constraints`, `Decision Log`, and `Acceptance Criteria`.
- Acceptance criteria are independently verifiable.
- Major decisions have complete evidence schema rows.

## Pre-Implementation Gate (Execution Order)

Before implementation begins, rollout artifacts must show:

1. `Docs Needed` completed with reason per doc.
2. Initial decision evidence rows for major implementation decisions.
3. Sufficiency verdict for each major decision (`Sufficient` / `Insufficient`).

If any decision is `Insufficient`, fallback code scanning is allowed only for that decision and must be paired with a concrete doc update action (or explicit blocker owner + due date).

## Verification Expectations

A rollout is governance-compliant when:

- `Docs Needed` and `Decision Evidence Log` are complete.
- Insufficiency rows are closed with doc updates or tracked blockers.
- Discoverability is preserved (index + guide + related docs).
- Simulation drill result is captured with pass/partial/fail and remediation notes.

## Minimal Example

### Docs Needed

- `docs/ai/guide.md` — route to task-relevant primary docs.
- `docs/ai/assistant-context-index.md` — confirm canonical doc set.
- `docs/operations/docs-maintenance.md` — enforce governance/review gates.

### Decision Evidence Log (Sample)

| Decision | Docs cited | Sufficiency verdict | Fallback code scan used? | Doc update action |
| --- | --- | --- | --- | --- |
| Use rollout template docs-first sections | `ai_oriented_kanban/templates/rollout-plan-template.md` | Sufficient | No | None |
| Resolve outdated middleware path reference | `docs/auth/auth-patterns.md` | Insufficient | Yes (doc path differed from live code) | Update `docs/auth/auth-patterns.md` with corrected path |

## Related Docs

- [Docs Maintenance Protocol](./docs-maintenance.md) – overall docs governance and reviewer responsibilities
- [AI Retrieval Smoke Tests](./ai-retrieval-smoke-tests.md) – QA protocol that tests this contract
- [Assistant Guide](../ai/guide.md) – assistant task routing to this policy
- [Assistant Context Index](../ai/assistant-context-index.md) – discoverability entry for this policy
- [Rollout Plan Template](../../ai_oriented_kanban/templates/rollout-plan-template.md) – required rollout structure
