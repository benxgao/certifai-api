# Rollout: Simulation Readiness Operational Cadence + Fallback Ratio Policy

## Summary

This follow-up rollout operationalizes the open governance decisions from `specs-first-kanban-integration.md`: how often docs-only simulation drills should run and which fallback-code-scan ratio qualifies a docs set as simulation-ready. The outcome is a measurable, low-friction policy with ownership, cadence, and evidence capture integrated into existing retrieval QA + rollout workflows.

## Scope

- Estimated files to create: 0
- Estimated files to modify: 4–6
- Risk level: Medium

### In scope

- Decide and document simulation drill cadence with ownership and exceptions.
- Define fallback-code-scan ratio target and measurement method.
- Add policy enforcement checks to docs and rollout artifacts.
- Record blocker closure criteria for simulation-readiness claims.

### Out of scope

- Backend/API business logic changes.
- Rewriting existing domain docs outside governance/routing surfaces.

## Docs Impact

### Docs Needed

| Doc | Why needed |
| --- | --- |
| `docs/ai/project-simulation-readiness.md` | Baseline rubric and scoring model to extend with cadence + ratio policy. |
| `docs/operations/ai-retrieval-smoke-tests.md` | Prompt-level QA workflow where cadence and ratio checks are exercised. |
| `docs/operations/docs-maintenance.md` | Governance gate and reviewer enforcement language. |
| `docs/ai/guide.md` | Routing expectations for when simulation drills are required. |
| `docs/ai/assistant-context-index.md` | Discoverability verification for any new governance guidance. |

### Docs to update

| File | What changes |
| --- | --- |
| `docs/ai/project-simulation-readiness.md` | Add cadence policy, fallback-ratio calculation method, and pass/fail boundary examples. |
| `docs/operations/ai-retrieval-smoke-tests.md` | Add cadence execution note and ratio-tracking prompt output requirement. |
| `docs/operations/docs-maintenance.md` | Add reviewer gate requiring cadence and ratio evidence for simulation-readiness claims. |
| `docs/ai/guide.md` | Add route for “determine simulation cadence / fallback target” governance task. |

## Progress Dashboard

- [ ] Phase 1 — Cadence decision contract
- [ ] Phase 2 — Fallback ratio policy definition
- [ ] Phase 3 — Docs integration and reviewer gates
- [ ] Phase 4 — Validation run and closure recommendation

## Phase 1: Cadence decision contract

**Progress**: `[ ]`

**Goal**: Resolve whether simulation drills are per-major-rollout, release-cadenced, or hybrid.

**Files**:

- `docs/ai/project-simulation-readiness.md` — modify — add decision matrix and selected cadence.
- `docs/operations/docs-maintenance.md` — modify — reviewer gate for cadence compliance.

**Verification gate**:

- Decision table exists with options, tradeoffs, and selected default.
- Owner and exception path are documented.

## Phase 2: Fallback ratio policy definition

**Progress**: `[ ]`

**Goal**: Define acceptable fallback-code-scan ratio and how it is computed.

**Files**:

- `docs/ai/project-simulation-readiness.md` — modify — add formula and thresholds.
- `docs/operations/ai-retrieval-smoke-tests.md` — modify — require ratio capture in drill outputs.

**Verification gate**:

- Formula is unambiguous (numerator/denominator/time window).
- Thresholds include pass/partial/fail interpretation.

## Phase 3: Docs integration and reviewer gates

**Progress**: `[ ]`

**Goal**: Ensure routing/index/governance docs consistently enforce the new policy.

**Files**:

- `docs/operations/docs-maintenance.md` — modify — enforce policy in rollout reviews.
- `docs/ai/guide.md` — modify — add routing entry to policy docs.
- `docs/ai/assistant-context-index.md` — modify if needed — reflect policy location changes.

**Verification gate**:

- Policy is discoverable from index + guide.
- Related-doc backlinks are present for all touched docs.

## Phase 4: Validation run and closure recommendation

**Progress**: `[ ]`

**Goal**: Execute one simulation run under the new policy and publish closure recommendation.

**Files**:

- `docs/operations/ai-retrieval-smoke-tests.md` — modify — capture run result reference.
- `ai_oriented_kanban/10-active/specs-first-kanban-integration.md` — modify — link validated outcomes and close open questions.

**Verification gate**:

- Run output includes docs-needed list, decision evidence log, fallback ratio, and remediation items.
- Recommendation clearly states whether policy is ready for default adoption.

## Simulation Blockers (Owned)

| Blocker | Owner | Mitigation | Due date |
| --- | --- | --- | --- |
| No standardized drill cadence across teams | Eng Productivity Lead | Publish cadence matrix + decision in Phase 1, then enforce via docs-maintenance gate. | 2026-06-12 |
| No agreed fallback scan ratio threshold | AI Governance DRI | Define ratio formula/threshold in Phase 2 and validate with one run in Phase 4. | 2026-06-12 |
| Drill evidence not consistently attached to rollouts | Release Manager | Add required run-reference field in smoke tests and rollout closure checklist. | 2026-06-14 |

## Rollback Plan

1. Revert cadence/ratio policy docs if thresholds cause operational friction.
2. Keep prior simulation-readiness scoring rubric unchanged while collecting additional evidence.
3. Re-open this rollout with adjusted thresholds and explicit reviewer feedback.

## Recommendation

Execute this rollout immediately after Phase 6 handoff so Phase 7 and Phase 8 in the parent rollout can be completed with stable, measurable governance inputs.
