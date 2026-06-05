# Rollout Plan Template

Use this template when a user asks for a rollout plan, phased plan, migration plan, implementation plan, or any similar planning artifact.

## Style goals

- Write the plan as a decision-quality engineering document, not a short task note.
- Prefer explicit reasoning over vague bullets.
- Start with the smallest high-impact fix first when there is a confirmed root cause.
- Keep dependency boundaries clear.
- Make phases independently testable.
- Identify a minimum-viable hotfix path (usually first 1–2 phases) before progressive hardening.
- If a phase is too large for one safe commit, split it into sub-subphases that are independently reviewable, revertible, and verifiable.
- Prefer wording that makes the plan easy to execute incrementally in separate commits.
- Always require a **Phase 0 verification phase** before implementation work begins, with evidence-backed outputs.
- Always include mandatory closing phases for Docs Sync, AI-ready docs reflection/next-plan handoff, Docs-only Simulation Drill, and Eval & Health Score.
- Enforce a docs-first decision contract: list required docs before implementation, record sufficiency, and update docs when insufficiency is discovered.

## Progress markers

Use these markers in the document itself:

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — completed and verified
- `[!]` — blocked

Only mark a sub-subphase as `[x]` after its independent verification passes.
Only mark a phase as `[x]` after all child items are `[x]` and the phase-level verification gate passes.

## Required structure

````markdown
# Rollout: <Short, specific title>

## Summary

<One or two paragraphs describing the problem, intent, and why this rollout exists.>

## Current Evaluation

### What already exists

- <existing component/system/pattern>
- <existing component/system/pattern>

### What is not centralized / stable / complete yet

#### 1. <Problem area>

- <evidence>
- <evidence>

Representative files:

- `<path>`
- `<path>`

#### 2. <Problem area>

- <evidence>
- <evidence>

### Risks in the current state

- [ ] <risk>
- [ ] <risk>
- [ ] <risk>

## Scope

- Estimated files to create: <n>
- Estimated files to modify: <n>
- Risk level: <Low | Medium | High>

### In scope

- <item>
- <item>

### Out of scope

- <item>
- <item>

## Phase 0 Verification Contract (mandatory before planned work)

- Verify existing solutions first (reuse route handlers, services, cache helpers, schemas where possible).
- Detect docs-to-code drift before coding starts; log `none` or explicit deltas with remediation path.
- Confirm architecture boundaries (thin handlers, service orchestration, no direct infra calls in route layer unless explicitly approved).
- Provide codebase evidence for each major design decision (doc citation + file/symbol evidence).
- Require AI assistants to refresh the current rollout plan from Phase 0 findings before Phase 1 begins.

## Minimum Viable Hotfix

- <Phase(s) that unblock users immediately>
- <Why these phases are safe/minimal>

## Docs Impact

> Complete this section at planning time — before writing any code.
> Load [`docs/ai/guide.md`](../../docs/ai/guide.md) and [`docs/ai/assistant-context-index.md`](../../docs/ai/assistant-context-index.md) to identify relevant docs.

### Docs checked during planning

| Doc                        | Relevant finding              |
| -------------------------- | ----------------------------- |
| `docs/<section>/<file>.md` | <what you found or confirmed> |

### Docs-First Retrieval Checklist

> Complete this section before writing any code. This checklist is **required** in every rollout plan.

- [ ] Loaded all primary docs for this task type from [`docs/ai/guide.md`](../../docs/ai/guide.md).
- [ ] Declared `Docs Needed` list with a reason for each required doc before implementation starts.
- [ ] Assessed sufficiency — docs were **sufficient** / **insufficient** _(strike one)_.
  - If insufficient: docs that were missing, ambiguous, or outdated: `<list here>`
  - If insufficient: fallback code scan was used for this specific decision: `<describe here>`
- [ ] Recorded decision evidence for all major decisions (doc citation + sufficiency + fallback + update action).
- [ ] Post-task docs update required: `[ ] Yes` — captured in Docs to update below | `[ ] No` — docs remain accurate after this change.

### Spec-First Readiness Checklist (required)

> These fields are non-optional for rollout readiness.

- [ ] Spec includes explicit `Scope` (in/out boundaries).
- [ ] Spec includes `Assumptions` with cited docs.
- [ ] Spec includes `Constraints` (technical/process guardrails).
- [ ] Spec includes `Decision Log` entries for major decisions.
- [ ] Spec includes measurable `Acceptance Criteria` with independent verification.

### Graph-Link Checklist (required)

> Complete this section whenever docs are created/updated in the rollout.

- [ ] New/changed governance docs are registered in [`docs/ai/assistant-context-index.md`](../../docs/ai/assistant-context-index.md).
- [ ] New/changed governance docs are routed from [`docs/ai/guide.md`](../../docs/ai/guide.md).
- [ ] Touched docs include `## Related Docs` with working relative links.
- [ ] No rollout-created doc is orphaned (at least one inbound path from index, guide, or related docs).

### Docs Needed (required before implementation)

| Doc                        | Why it is needed for this rollout       |
| -------------------------- | --------------------------------------- |
| `docs/<section>/<file>.md` | <decision or behavior this doc informs> |

### Decision Evidence Log (required)

| Decision             | Docs cited   | Sufficiency verdict       | Fallback code scan used? | Doc update action     |
| -------------------- | ------------ | ------------------------- | ------------------------ | --------------------- |
| <decision statement> | `<doc path>` | Sufficient / Insufficient | No / Yes (`<why>`)       | None / `Update <doc>` |

> If any row is marked **Insufficient**, include a corresponding entry in **Docs to update** (or an explicit blocker with owner and due date).

### Docs Insufficiency Remediation Workflow (non-optional)

For every `Insufficient` decision evidence row:

1. Record the exact insufficiency reason (missing / ambiguous / outdated doc detail).
2. Record whether fallback code scan was used, and for which decision only.
3. Add an explicit remediation item under **Docs to update** in this same rollout.
4. If same-rollout remediation is blocked, record owner + due date and keep rollout phase open until tracked.

### Docs to create

| File                       | Reason                               |
| -------------------------- | ------------------------------------ |
| `docs/<section>/<file>.md` | <new pattern / new domain / new ADR> |

### Docs to update

| File                       | What changes                                   |
| -------------------------- | ---------------------------------------------- |
| `docs/<section>/<file>.md` | <field, section, or entry that needs updating> |

### Docs to delete or archive

| File                       | Reason                            |
| -------------------------- | --------------------------------- |
| `docs/<section>/<file>.md` | <superseded by / removed feature> |

### No docs affected

- [ ] Confirmed: this plan introduces no new patterns, changes no existing conventions, and removes no documented features.
      _(Check this box only if all three conditions above are true.)_

## Context Map

### Files to modify first

| File     | Purpose   | Why it matters |
| -------- | --------- | -------------- |
| `<path>` | <purpose> | <reason>       |
| `<path>` | <purpose> | <reason>       |

### Likely files to create

| File     | Purpose   |
| -------- | --------- |
| `<path>` | <purpose> |
| `<path>` | <purpose> |

### Dependencies / related patterns

| File     | Relationship   |
| -------- | -------------- |
| `<path>` | <relationship> |
| `<path>` | <relationship> |

### Risks

- [ ] <risk>
- [ ] <risk>

## Recommended Architecture

### Principle 1: <name>

<explanation>

### Principle 2: <name>

<explanation>

## Dependency Rule

> **Each phase must touch exactly one dependency layer unless the user explicitly asks for a looser plan.**

> **Phase 0 is mandatory and must complete before any implementation phase (Phase 1+) starts.**

<Explain the dependency chain and why mixed-layer phases are risky.>

## Phase Sequencing Rule

> **Default sequencing: Phase 0 verification/drift detection → root-cause fix → data recovery/backfill → contract hardening → UX/message polish → tests.**

If user asks for minimal change first, move architecture refactors and retry redesign behind the immediate hotfix phases.

## Commit Slicing Rule

> **A phase may be split into sub-subphases when the file count, review surface, or QA burden is too large for one safe commit.**

### Rules for sub-subphases

- Each sub-subphase should be independently reviewable and revertible.
- Each sub-subphase should end with a local verification step.
- If a missing prerequisite appears, add or revise an earlier-layer sub-subphase instead of patching around it downstream.
- Do not split a phase in a way that creates temporary broken imports between commits.

## Progress Markers

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — completed and verified
- `[!]` — blocked

## Progress Dashboard

- [ ] Phase 0 — Verification and plan refresh
- [ ] Phase 1 — <name>
- [ ] Phase 2 — <name>
- [ ] Phase 3 — <name>
- [ ] Phase N — Docs Sync
- [ ] Phase N+1 — AI-ready docs reflection and next-plan handoff
- [ ] Phase N+2 — Docs-only Simulation Drill
- [ ] Phase N+3 — Rollout Eval & Health Score

## Phases

### Phase 0: Verification baseline and plan refresh

**Progress**: `[ ]`

**Layer**: discovery/evidence layer

**Goal**: Verify what already exists, detect doc drift, confirm boundaries, and update the plan using evidence before implementation starts.

**Files**:

- `<doc path>` — read/verify — confirm source-of-truth behavior for this rollout
- `<code path>` — inspect — collect implementation evidence and reusable components
- `<current-rollout-path>.md` — modify — refresh plan scope/files/risks based on verified findings

**Verification gate** (must pass before Phase 1 starts):

- Evidence table exists with concrete file paths + symbols for reusable solutions.
- Doc drift status is explicitly logged (`none` or tracked deltas with remediation).
- Architecture boundary check is explicitly logged (`confirmed` or remediation needed).
- Plan diff shows updates grounded in Phase 0 evidence.

**Sub-subphase checklist**:

- [ ] **0.1 — Verify existing solutions**: identify reusable patterns/components/services.
  - **Independent verification**: evidence table includes file paths and symbols.
- [ ] **0.2 — Detect doc drift**: compare canonical docs with current implementation behavior.
  - **Independent verification**: drift table is present with `none` or actionable deltas.
- [ ] **0.3 — Confirm architectural boundaries**: validate layer boundaries and prohibited coupling.
  - **Independent verification**: scan findings explicitly mark boundary status.
- [ ] **0.4 — Capture decision evidence**: map each major decision to docs + codebase proof.
  - **Independent verification**: Decision Evidence Log rows include doc citation and file evidence.
- [ ] **0.5 — AI-assisted plan refresh**: update current rollout plan before Phase 1.
  - **Independent verification**: plan changes reference Phase 0 evidence IDs/entries.

---

### Phase 1: <name>

**Progress**: `[ ]`

**Layer**: `<scope boundary>`

**Goal**: <what this phase accomplishes>

**Files**:

- `<path>` — create/modify — <reason>
- `<path>` — create/modify — <reason>

**Verification gate** (must pass before Phase 2 starts):

- <TypeScript / grep / QA / test check>
- <TypeScript / grep / QA / test check>

**Sub-subphase checklist**:

- [ ] **1.1 — <name>**: <work item>
  - **Independent verification**: <specific local verification>
- [ ] **1.2 — <name>**: <work item>
  - **Independent verification**: <specific local verification>

---

### Phase 2: <name>

**Progress**: `[ ]`

**Layer**: `<scope boundary>`

**Goal**: <what this phase accomplishes>

**Files**:

- `<path>` — create/modify — <reason>

**Verification gate** (must pass before Phase 3 starts):

- <check>
- <check>

**Sub-subphase checklist**:

- [ ] **2.1 — <name>**: <work item>
  - **Independent verification**: <specific local verification>

---

### Phase N: <name> _(optional conditional phase)_

**Progress**: `[ ]`

**Layer**: `<scope boundary>`

**Goal**: <what this phase accomplishes>

**Pre-condition check** (do before implementation):

- <file/setting to inspect>
- <decision rule: execute phase vs skip and mark `[!]`>

**Files** _(only if pre-condition is met)_:

- `<path>` — create/modify — <reason>

**Verification gate** _(if phase is executed)_:

- <check>

**Sub-subphase checklist**:

- [ ] **N.0 — Infrastructure/contract audit**: <audit action>
  - **Independent verification**: <evidence that condition is met; else mark blocked/skip>

---

### Phase N: Docs Sync _(mandatory closing phase)_

**Progress**: `[ ]`

**Layer**: documentation layer

**Goal**: Ensure all docs listed in `## Docs Impact` are created, updated, or archived so the knowledge base stays accurate after this rollout.

**Pre-condition check**:

- Review `## Docs Impact` section of this plan.
- If the "No docs affected" checkbox was checked and verified, this phase may be skipped — mark it `[!]` with note "skipped: no docs affected".

**Files** _(from Docs Impact section above)_:

- `<doc to create>` — create — <reason>
- `<doc to update>` — modify — <what changes>
- `<doc to delete>` — delete — <reason>

**Verification gate**:

- Every doc listed in `## Docs Impact → Docs to create` exists.
- Every doc listed in `## Docs Impact → Docs to update` has an updated `Last reviewed:` date.
- `grep -r "TODO\|FIXME\|TBD" docs/ | grep -v "_template"` returns no unresolved placeholders in updated files.
- `grep -r "Source of truth" <updated-doc-path>` confirms the field is present and correct.
- `grep "<new-doc-filename>" docs/ai/assistant-context-index.md` returns a match for any new doc added.
- Docs-first retrieval checklist (above) is filled in: sufficiency was assessed and any gap is recorded.
- All touched docs have a valid `## Related Docs` section with working relative links (docs link integrity gate).
- Graph-link checklist (above) is complete for all new/updated docs.

**Sub-subphase checklist**:

- [ ] **N.0 — Confirm docs-first retrieval checklist**: verify the checklist in `## Docs Impact → Docs-First Retrieval Checklist` is completed; any doc update triggered by code findings is listed under "Docs to update".
  - **Independent verification**: checklist is not blank; post-task update field is marked Yes or No with justification.
- [ ] **N.1 — Create new docs**: author all files listed under "Docs to create".
  - **Independent verification**: all new files exist; each has `Source of truth:`, `Last reviewed:`, `Owner:` fields filled.
- [ ] **N.2 — Update existing docs**: apply all changes listed under "Docs to update".
  - **Independent verification**: `Last reviewed:` date updated; no conflicting guidance with other docs in same section.
- [ ] **N.3 — Archive or delete stale docs**: remove files listed under "Docs to delete".
  - **Independent verification**: `grep -r "<deleted-filename>" docs/` returns no live links to the removed file.
- [ ] **N.4 — Update assistant-context-index.md**: add/remove entries to match new doc set.
  - **Independent verification**: `docs/ai/assistant-context-index.md` Quick Reference table reflects current state.
- [ ] **N.5 — Verify docs link integrity**: confirm each touched doc has a valid `## Related Docs` section with working relative links.
  - **Independent verification**: spot-check every new or modified doc — no broken relative paths, no missing `## Related Docs` section.

---

### Phase N+1: AI-ready docs reflection and next-plan handoff _(mandatory closing phase)_

**Progress**: `[ ]`

**Layer**: planning/documentation improvement layer

**Goal**: Capture what was learned while executing this rollout (concerns, rework causes, confirmed improvements, unresolved questions) and convert them into a concrete next rollout plan file.

**Pre-condition check**:

- Review the plan’s improvement/reflection notes (for example: "what can be improved").
- Review `## Open Questions` and mark which were resolved vs still pending.

**Files**:

- `<next-rollout-path>.md` — create/modify — phased plan for confirmed follow-up improvements
- `<current-rollout-path>.md` — modify — add a short handoff note linking to the next rollout

**Verification gate**:

- The next rollout file exists and contains a phased plan (scope, phases, verification gates, rollback).
- Confirmed actions from the reflection section are explicitly listed in the next rollout scope.
- Unresolved questions are carried over with clear decision owners or decision criteria.
- Current rollout contains a handoff note linking to the next rollout plan file.
- Reflection includes at least one docs insufficiency pattern and one prevention update for future docs-first runs.

**Sub-subphase checklist**:

- [ ] **N+1.1 — Summarize confirmed improvements**: extract approved actions from reflection notes.
  - **Independent verification**: every approved action appears in next rollout plan scope.
- [ ] **N+1.2 — Convert unresolved questions to decisions**: add owner/criteria/timeline for each pending question.
  - **Independent verification**: no open question is left without a decision path.
- [ ] **N+1.3 — Author next rollout plan**: write a complete phased plan in the designated next-plan file.
  - **Independent verification**: next plan includes phases, verification gates, and rollback plan.
- [ ] **N+1.4 — Record handoff in current plan**: add session note linking to next rollout path.
  - **Independent verification**: link/path is present and readable.

---

### Phase N+2: Docs-only Simulation Drill _(mandatory closing phase)_

**Progress**: `[ ]`

**Layer**: validation and reproducibility layer

**Goal**: Validate that a new assistant can execute a comparable rollout from docs specs first, with any fallback scans explicitly justified and converted into doc improvements.

**Pre-condition check**:

- Confirm Phase N (Docs Sync) and Phase N+1 (AI-ready reflection/handoff) are complete or have justified `[!]` status.
- Confirm canonical routing docs are current: `docs/ai/guide.md` and `docs/ai/assistant-context-index.md`.

**Files**:

- `docs/operations/ai-retrieval-smoke-tests.md` — modify — add/refresh simulation drill prompt.
- `docs/ai/project-simulation-readiness.md` — create/modify — store rubric, run log template, and pass/fail notes.
- `<current-rollout-path>.md` — modify — record drill outcome and remediation follow-ups.

**Verification gate**:

- Drill output includes `Docs Needed` and `Decision Evidence Log`.
- Every fallback scan in drill output has insufficiency reason and a linked docs update action.
- At least one drill run completes with docs-first behavior and no unjustified code scan.

**Sub-subphase checklist**:

- [ ] **N+2.1 — Author drill scenario**: define representative task, expected output, and pass criteria.
  - **Independent verification**: scenario references canonical docs and includes measurable outputs.
- [ ] **N+2.2 — Run drill and capture evidence**: execute scenario and save output.
  - **Independent verification**: output includes docs list, decision evidence, and remediation actions.
- [ ] **N+2.3 — Apply remediation updates**: update docs for all confirmed insufficiencies.
  - **Independent verification**: every insufficiency has either a merged doc fix or justified blocker with owner/date.

---

### Phase N+3: Rollout Eval & Health Score _(mandatory closing phase)_

**Progress**: `[ ]`

**Layer**: rollout quality/evaluation layer

**Goal**: Produce a 0–120 rollout health score after Docs Sync, AI-ready reflection, and simulation drill complete, and record the score with evidence in a session note.

**Pre-condition check**:

- Confirm Phase N (Docs Sync), Phase N+1 (AI-ready reflection/handoff), and Phase N+2 (simulation drill) are marked `[x]` or have documented `[!]` justifications.
- Confirm docs-first retrieval checklist, decision evidence log, and reflection decisions are available as scoring evidence.

**Scoring rubric**:

| Dimension            | Max Points | How scored                                                                                                                 |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Docs-first adherence | 40         | Docs-First Retrieval Checklist fully completed, sufficiency explicitly assessed, and fallback decisions documented if used |
| Docs health          | 40         | All Docs Sync verification gates passed: create/update/archive/link-index checks complete                                  |
| Reflection quality   | 20         | Reflection records at least one confirmed improvement and every open question has an owner or revisit condition            |
| Simulation readiness | 20         | Drill evidence shows docs-first execution and insufficiency remediation loop is closed                                     |
| **Total**            | **120**    | Suggested pass threshold: `>= 85`                                                                                          |

**Scoring rules**:

- Gate passed = full points for that gate.
- Gate skipped without justification = 0 points for that gate.
- Gate marked `[!]` with documented reason = half points for that gate.

**Verification gate**:

- Score table is populated with evidence for all four dimensions.
- Total score is calculated and recorded.
- A session note records the final score, dimension-by-dimension justification, and archive readiness decision.

**Sub-subphase checklist**:

- [ ] **N+3.1 — Evaluate docs-first adherence**: review Docs-First Retrieval Checklist completion and sufficiency verdict.
  - **Independent verification**: checklist is complete and sufficiency is explicitly marked sufficient/insufficient.
- [ ] **N+3.2 — Evaluate docs health**: review Docs Sync verification-gate results.
  - **Independent verification**: every docs gate is pass, justified block, or justified skip.
- [ ] **N+3.3 — Evaluate reflection quality**: review AI-ready reflection decisions and handoff outputs.
  - **Independent verification**: at least one confirmed improvement and owner/criteria for all open questions.
- [ ] **N+3.4 — Evaluate simulation readiness**: review drill outcomes and remediation closure quality.
  - **Independent verification**: drill includes docs list/evidence/remediation and no unresolved critical insufficiency.
- [ ] **N+3.5 — Record final score session note**: write session note with score breakdown and final recommendation.
  - **Independent verification**: session note includes total score and archive gate decision (`>= 85` pass / `< 85` hold).

---

## Dependency Graph

```text
<upstream layer>
  ↓
<next layer>
  ↓
<next layer>
```
````

Each arrow means "depends on". A phase should not modify a node that a lower layer already imports from.

## Suggested Implementation Order

1. <phase or sub-subphase order>
2. <phase or sub-subphase order>
3. <phase or sub-subphase order>

If a gap is found during a downstream phase, add an isolated earlier-layer fix instead of patching the gap inline in the downstream file.

## Progress Checks (Resume-at-any-time protocol)

At the end of each working session:

1. Update **Progress Dashboard** and active phase `Progress` marker.
2. Mark sub-subphase `[x]` only after independent verification passes.
3. Add a short session note with timestamp, last completed step, next step, and blockers.
4. If blocked, mark item `[!]` and record unblock dependency.

### Session Note Template

```markdown
### Session Note — <YYYY-MM-DD HH:mm local>

- Completed: <phase.subphase>
- Verified by: <command/test/QA>
- Next: <phase.subphase>
- Blockers: <none | details>
```

## Essential Implementation Details

- Define one canonical cross-layer error envelope if the task spans backend + frontend contracts.
- Prefer machine-readable error identifiers (`error_code`) over message-string parsing.
- Document idempotency assumptions for retries/backfills.
- Keep business-rule changes explicit; if unchanged, state that clearly.
- Include at least one data-recovery/backfill note when users may already be affected.

## Success Criteria

- <criterion>
- <criterion>
- <criterion>

## Rollback Plan

1. <rollback step>
2. <rollback step>
3. <rollback step>

## Open Questions

1. <question>
2. <question>

## Recommendation

<Recommended execution order and why it is the safest/default path.>

```

## Authoring rules

- Keep headings concrete and short.
- Prefer evidence-backed observations tied to real files.
- Reference exact failure signals when available (logs, status code, schema parse error, stack signature).
- When relevant, include concrete verification such as:
  - `npx tsc --noEmit`
  - `grep -r ...`
  - targeted visual QA routes
  - lint/test checks that are appropriate for the repo
- Include at least one manual end-to-end verification path that validates user-visible recovery.
- Keep each phase to one dependency layer unless explicitly marked as contract-alignment phase.
- Use the template as the default structure, but trim sections that truly do not apply.
- If the user asks for a lighter or shorter plan, compress the structure rather than abandoning it entirely.
- Docs Sync, AI-ready docs reflection/handoff, Docs-only Simulation Drill, and Rollout Eval & Health Score are mandatory closing phases.
```
