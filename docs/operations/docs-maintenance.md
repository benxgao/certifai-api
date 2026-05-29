# Docs Maintenance Protocol

> **Source of truth**: `docs/` topology and repository contribution workflow
> **Last reviewed**: 2026-05-29
> **Owner**: Engineering Team

## Purpose

Prevent documentation drift by enforcing layering rules, discoverability gates, and recurring review cadence.

## Layering Contract (Required)

- **Invariant docs** (`docs/<domain>/*.md`) contain stable rules, contracts, and guardrails.
- **Procedure docs** (`docs/workflow/*-workflow.md`) contain numbered lifecycle steps, state transitions, and troubleshooting.

### Reviewer enforcement rule

PRs that add step-by-step numbered procedures to non-workflow domain docs require explicit reviewer sign-off (or must be moved to `docs/workflow/`).

## Docs-First Decision Contract for Rollouts (Required)

For rollout plans under `ai_oriented_kanban/`, reviewers must enforce that assistants can make decisions from docs specs first, then repair docs when gaps are found.

Required evidence in rollout artifacts:

1. `Docs Needed` list is declared before implementation, with reason per doc.
2. `Decision Evidence Log` exists for major decisions and includes:
   - Decision statement
   - Docs cited
   - Sufficiency verdict (`Sufficient` / `Insufficient`)
   - Fallback code scan usage + reason (if any)
   - Doc update action
3. Any `Insufficient` decision row has a matching docs remediation action in the same rollout (or explicit blocker with owner + due date).
4. Closing phases include Docs Sync, AI-ready reflection/handoff, docs-only simulation drill, and health score evaluation.

### Rollout reviewer enforcement rule

Reject rollout PRs when any of the following are missing:

- No `Docs Needed` declaration
- No decision evidence log for key decisions
- Fallback code scans used without insufficiency reason
- Docs insufficiency discovered but no docs update action recorded
- Simulation drill cadence decision/evidence missing for rollout closures that require drills
- Fallback-code-scan ratio not reported for simulation drill runs (or ratio formula/threshold undefined)

### Simulation-readiness policy enforcement

For rollouts that claim simulation-readiness completion:

1. Evidence must include cadence compliance (`per-major-rollout` drill plus biweekly health-check context).
2. Evidence must include fallback-code-scan ratio using:
   - numerator = decisions with fallback scan
   - denominator = total major decisions
3. Ratio threshold interpretation must be explicit (`Pass` / `Partial` / `Fail`).
4. Any `Partial` or `Fail` result must include blocker owner + due date and follow-up rollout linkage.

## Discoverability Contract

A doc is considered merge-ready only if it is:

1. Registered in `docs/ai/assistant-context-index.md`
2. Routed from `docs/ai/guide.md`
3. Includes `Source of truth` metadata
4. Includes `## Related Docs` with outbound links

### Kanban artifact graph-link enforcement (Required)

For rollout artifacts under `ai_oriented_kanban/` that introduce or change governance rules:

1. Canonical governance doc must exist under `docs/` (not only in kanban artifact text).
2. Governance doc must be indexed in `docs/ai/assistant-context-index.md`.
3. Governance doc must be routed in `docs/ai/guide.md` for at least one task path.
4. Governance doc and affected docs must include `## Related Docs` backlinks to prevent orphan knowledge.

Reject PRs where rollout artifacts reference policy changes that are not graph-linked through index + guide + related-doc backlinks.

## Archive Retirement Policy

- `docs/plans/` are planning artifacts only; they are **not canonical live guidance**.
- If an enforceable rule exists only in a plans doc, migrate it to its canonical domain doc under `docs/` before relying on it.
- Do not add new long-term pattern guidance solely to `docs/plans/`.

## Update Cadence and Freshness SLA

### Monthly review (lightweight)

- Spot-check top-level canonical docs:
  - `docs/ai/repo-map.md`
  - `docs/ai/assistant-context-index.md`
  - `docs/ai/guide.md`
  - domain docs touched in last 30 days
- Validate links and remove stale references.

### Quarterly topology review (full)

- Validate all internal links under `docs/`.
- Confirm no orphan docs (every doc has at least one inbound path from index/guide/related links).
- Confirm layering rule is still being followed.

## Quarterly Topology Review Procedure

1. Enumerate docs and templates:
   - `find docs -name "*.md"`
2. Check unresolved placeholders:
   - `grep -R "TODO" docs/`
3. Check metadata coverage:
   - `grep -R "Source of truth" docs/`
4. Check `## Related Docs` coverage:
   - `grep -R "## Related Docs" docs/`
5. Validate index registration for newly added docs:
   - search `docs/ai/assistant-context-index.md`
6. Validate routing registration:
   - search `docs/ai/guide.md`
7. Validate rollout docs-first contract usage in active rollouts:
   - `grep -R "Docs Needed" ai_oriented_kanban/10-active/`
   - `grep -R "Decision Evidence Log" ai_oriented_kanban/10-active/`
   - spot-check insufficiency rows include docs update actions
8. Validate kanban-driven governance graph links:
   - verify any new governance docs are present in index and guide
   - verify touched governance docs include `## Related Docs`

Record findings in PR or ops notes and open follow-up issues for drift.

## Ownership and Change Process

- Doc owners are responsible for domain accuracy.
- PR reviewers enforce layering + discoverability gates.
- PR reviewers also enforce rollout docs-first decision evidence and insufficiency remediation gates.
- Significant structure/policy changes should be recorded via ADR.

## Related Docs

- [Assistant Context Index](../ai/assistant-context-index.md) – canonical discoverability map
- [Assistant Guide](../ai/guide.md) – task routing map
- [Workflow Guide](../workflow/README.md) – procedure placement rules
- [AI Retrieval Smoke Tests](./ai-retrieval-smoke-tests.md) – retrieval QA and simulation checks
- [ADR 0001](../adr/0001-docs-architecture-mvp.md) – docs architecture decision
