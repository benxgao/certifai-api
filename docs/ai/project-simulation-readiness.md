# Project Simulation Readiness (Docs-Only)

> **Source of truth**: Docs-only execution readiness rubric for assistant-led planning
> **Last reviewed**: 2026-05-29
> **Owner**: Engineering Team / AI Assistants

## Purpose

Define measurable criteria for whether a comparable project can be planned and executed by an assistant using docs specs as primary context.

## Readiness Standard

A docs set is simulation-ready when an assistant can:

1. List required docs before implementation planning.
2. Produce decision evidence for major choices using canonical docs.
3. Identify docs insufficiency without hallucination.
4. Propose concrete doc updates that close insufficiency gaps.
5. Complete a planning simulation with no unjustified fallback code scans.

## Operational Cadence Policy

Default cadence for docs-only simulation drills:

1. **Per major rollout (required)**
	- Run at least one simulation drill before closing any rollout that changes governance, workflow contracts, or multi-domain patterns.
2. **Biweekly release-cycle health check (required)**
	- Run one cross-domain simulation drill every two weeks even if no major rollout closed, to detect drift.
3. **Exception path (allowed with owner approval)**
	- A drill can be deferred only when all are true:
	  - no canonical doc changes affecting decision contracts,
	  - no unresolved insufficiency blockers from prior runs,
	  - owner-approved defer note with next due date.

**Policy owner:** Eng Productivity Lead

## Fallback-Code-Scan Ratio Policy

Use the ratio below for each simulation run:

$$
	ext{fallback ratio} = \frac{\#\text{ decisions that used fallback code scan}}{\#\text{ total major decisions in the run}}
$$

Measurement rules:

- Denominator = count of `Decision Evidence Log` rows for the run.
- Numerator = rows where `Fallback code scan used?` is `Yes (...)`.
- If denominator is `0`, run is invalid and must be re-executed.

Thresholds:

- **Pass:** fallback ratio $\le 0.10$
- **Partial:** fallback ratio $> 0.10$ and $\le 0.25$
- **Fail:** fallback ratio $> 0.25$

Release-health rule (rolling window):

- Track the median fallback ratio for the latest 4 runs.
- Mark governance as simulation-ready only when median ratio is $\le 0.10$ and no unresolved critical insufficiency exists.

## Minimum Documentation Set (Required)

A simulation run is not valid unless all baseline docs below are loaded before planning decisions:

- `docs/ai/guide.md`
- `docs/ai/assistant-context-index.md`
- `docs/operations/spec-first-kanban-integration.md`
- `docs/operations/docs-maintenance.md`
- `ai_oriented_kanban/templates/rollout-plan-template.md`

Then add domain-specific docs required by the scenario (API/Auth/Database/etc.).

## Required Evidence Model

Each simulation run must include:

- `Docs Needed` list with rationale per doc
- Decision evidence for each major decision
- Sufficiency verdict per decision (`Sufficient` / `Insufficient`)
- Fallback scan record where used
- Doc remediation action for every insufficiency

### Decision Evidence Log Schema

| Decision | Docs cited | Sufficiency verdict | Fallback code scan used? | Doc update action |
| --- | --- | --- | --- | --- |
| `<decision>` | `<doc paths>` | `Sufficient` / `Insufficient` | `No` / `Yes (reason)` | `None` / `<doc update or blocker owner+date>` |

## Scoring Rubric

| Dimension | Max Points | Pass condition |
| --- | --- | --- |
| Docs assembly accuracy | 25 | Baseline doc set declared before implementation planning |
| Decision traceability | 25 | Major decisions include complete decision evidence rows |
| Fallback discipline | 25 | No unjustified code scan; every fallback includes insufficiency reason |
| Remediation closure | 25 | Every insufficiency maps to concrete doc update or blocker owner+date |
| **Total** | **100** | **Pass threshold: >= 85** |

## Simulation Run Procedure

1. Select a representative planning task comparable to active rollout complexity.
2. Load required baseline docs and any domain docs for the scenario.
3. Produce `Docs Needed` and initial decision evidence before implementation suggestions.
4. Complete planning output with docs-first decision path.
5. Record insufficiencies, fallback scans, and remediation actions.
6. Score run and publish `Pass` / `Partial` / `Fail` verdict.

## Failure Modes

Common failure indicators:

- Missing `Docs Needed` section
- Decision claims with no doc citation
- Fallback code scan with no insufficiency rationale
- Vague remediation (e.g., “update docs later”) without target docs

## Run Log Template

### Simulation Run

- **Date:** `<YYYY-MM-DD>`
- **Task scenario:** `<one-sentence summary>`
- **Evaluator:** `<name>`
- **Fallback ratio:** `<numerator/denominator = ratio>`

### Docs Needed

| Doc | Why needed |
| --- | --- |
| `<path>` | `<reason>` |

### Decision Evidence Log

| Decision | Docs cited | Sufficiency verdict | Fallback code scan used? | Doc update action |
| --- | --- | --- | --- | --- |
| `<decision>` | `<doc paths>` | `Sufficient` / `Insufficient` | `No` / `Yes (reason)` | `<action>` |

### Scorecard

| Dimension | Points earned | Notes |
| --- | --- | --- |
| Docs assembly accuracy (25) | `<0-25>` | `<evidence>` |
| Decision traceability (25) | `<0-25>` | `<evidence>` |
| Fallback discipline (25) | `<0-25>` | `<evidence>` |
| Remediation closure (25) | `<0-25>` | `<evidence>` |
| **Total (100)** | `<0-100>` | `<Pass if >= 85>` |

### Outcome

- **Readiness verdict:** `Pass` / `Partial` / `Fail`
- **Critical gaps found:** `<list>`
- **Required follow-up updates:** `<docs to update + owners/dates>`

## Simulation Run Log

### Simulation Run — 2026-05-29

- **Task scenario:** Plan a docs-first rollout for a cross-domain auth + cache change with governance-link verification.
- **Evaluator:** AI Assistant (rollout validation pass)
- **Fallback ratio:** `0/3 = 0.00` (Pass threshold met)

### Docs Needed

| Doc | Why needed |
| --- | --- |
| `docs/ai/guide.md` | Route task to canonical governance and domain docs first. |
| `docs/ai/assistant-context-index.md` | Validate full canonical doc inventory for planning context. |
| `docs/operations/spec-first-kanban-integration.md` | Enforce docs-needed and decision-evidence contract during planning. |
| `docs/operations/docs-maintenance.md` | Verify graph-link and reviewer enforcement gates. |
| `ai_oriented_kanban/templates/rollout-plan-template.md` | Ensure output shape matches required rollout artifacts. |
| `docs/operations/ai-retrieval-smoke-tests.md` | Confirm drill prompt expectations and pass criteria. |

### Decision Evidence Log

| Decision | Docs cited | Sufficiency verdict | Fallback code scan used? | Doc update action |
| --- | --- | --- | --- | --- |
| Use docs-first planning structure with pre-implementation evidence capture | `docs/operations/spec-first-kanban-integration.md`, `ai_oriented_kanban/templates/rollout-plan-template.md` | Sufficient | No | None |
| Verify governance graph-link coverage before closure | `docs/operations/docs-maintenance.md`, `docs/ai/assistant-context-index.md`, `docs/ai/guide.md` | Sufficient | No | None |
| Validate simulation drill scoring and closeout threshold | `docs/ai/project-simulation-readiness.md`, `docs/operations/ai-retrieval-smoke-tests.md` | Sufficient | No | Added Prompt 10 in `docs/operations/ai-retrieval-smoke-tests.md` to make future drill execution explicit. |

### Scorecard

| Dimension | Points earned | Notes |
| --- | --- | --- |
| Docs assembly accuracy (25) | 25 | Baseline + scenario docs declared before planning decisions. |
| Decision traceability (25) | 25 | All major decisions include full evidence rows. |
| Fallback discipline (25) | 25 | No fallback code scan used; no unjustified scan behavior. |
| Remediation closure (25) | 23 | No critical insufficiencies found; preventive update added to smoke tests for future reproducibility. |
| **Total (100)** | **98** | **Pass (`>= 85`)** |

### Outcome

- **Readiness verdict:** `Pass`
- **Critical gaps found:** None in this run.
- **Required follow-up updates:** Continue policy decisions tracked in `ai_oriented_kanban/10-active/simulation-readiness-ops-cadence.md` (owners/dates already assigned).

## Remediation Loop

When simulation is `Partial` or `Fail`:

1. Update missing/ambiguous canonical docs.
2. Register updates in `assistant-context-index.md` and routing in `guide.md`.
3. Re-run simulation prompt from `ai-retrieval-smoke-tests.md`.
4. Record before/after result in rollout session note.

## Exit Criteria for “Simulation Ready”

A domain/process is simulation ready only when all are true:

- At least one simulation run scored `>= 85`.
- No unjustified fallback code scan was used.
- All insufficiencies from that run have merged doc updates or tracked blockers.
- Routing and index links for touched docs are valid.

## Related Docs

- [Assistant Guide](./guide.md) – routing to required docs by task
- [Assistant Context Index](./assistant-context-index.md) – canonical doc inventory
- [Docs Maintenance Protocol](../operations/docs-maintenance.md) – governance contract and enforcement
- [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md) – simulation prompts and QA checklist
- [Spec-First + Kanban Integration Policy](../operations/spec-first-kanban-integration.md) – rollout contract for docs-first decision evidence
- [Rollout Plan Template](../../ai_oriented_kanban/templates/rollout-plan-template.md) – required planning structure and evidence fields
