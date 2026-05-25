# Docs Maintenance Protocol

> **Source of truth**: `docs/` topology and repository contribution workflow
> **Last reviewed**: 2026-05-26
> **Owner**: Engineering Team

## Purpose

Prevent documentation drift by enforcing layering rules, discoverability gates, and recurring review cadence.

## Layering Contract (Required)

- **Invariant docs** (`docs/<domain>/*.md`) contain stable rules, contracts, and guardrails.
- **Procedure docs** (`docs/workflow/*-workflow.md`) contain numbered lifecycle steps, state transitions, and troubleshooting.

### Reviewer enforcement rule

PRs that add step-by-step numbered procedures to non-workflow domain docs require explicit reviewer sign-off (or must be moved to `docs/workflow/`).

## Discoverability Contract

A doc is considered merge-ready only if it is:

1. Registered in `docs/ai/assistant-context-index.md`
2. Routed from `docs/ai/guide.md`
3. Includes `Source of truth` metadata
4. Includes `## Related Docs` with outbound links

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

Record findings in PR or ops notes and open follow-up issues for drift.

## Ownership and Change Process

- Doc owners are responsible for domain accuracy.
- PR reviewers enforce layering + discoverability gates.
- Significant structure/policy changes should be recorded via ADR.

## Related Docs

- [Assistant Context Index](../ai/assistant-context-index.md) – canonical discoverability map
- [Assistant Guide](../ai/guide.md) – task routing map
- [Workflow Guide](../workflow/README.md) – procedure placement rules
- [ADR 0001](../adr/0001-docs-architecture-mvp.md) – docs architecture decision
