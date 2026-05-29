# Rollout: Spec-First Development + Graph-Link System (certifai-api)

## Summary

This rollout applies the same spec-first development + ai-oriented-kanban integration and graph-link system governance already established in `certifai-app`, adapted for the current `certifai-api` documentation and workflow structure. The intent is to make feature work spec-led (clear scope, explicit decisions, risk handling) while enforcing a discoverable, cross-linked documentation graph that eliminates orphan docs and routing ambiguity for assistants and reviewers. It also explicitly updates `copilot-instructions.md` so assistants prioritize doc specs for decisions, only fall back to code scans when docs are insufficient, and then update docs to align with the verified code wherever possible.

This rollout also formalizes an end-state where assistants can execute similar future projects using documentation specs as the primary runtime context: assistants must (1) list required docs before implementation, (2) record doc sufficiency for each major decision, and (3) propose/perform doc updates when docs are insufficient so future work becomes easier and more accurate.

The plan is phased to minimize risk: first establish the spec-first kanban contract and PR gates, then harden the documentation graph and retrieval checks, followed by mandatory docs sync and evaluation phases.

## Current Evaluation

### What already exists

- Docs governance: `docs/operations/docs-maintenance.md` (layering + discoverability + cadence).
- AI retrieval QA: `docs/operations/ai-retrieval-smoke-tests.md`.
- Workflow placement standard: `docs/workflow/README.md`.
- Canonical doc map and routing: `docs/ai/assistant-context-index.md`, `docs/ai/guide.md`.

### What is not centralized / stable / complete yet

#### 1. Spec-first development is not explicitly integrated with kanban artifacts

- No explicit spec-first checklist in `ai_oriented_kanban` templates or active items.
- No standardized “spec → decision → rollout → verification” structure in kanban items.

Representative files:

- `ai_oriented_kanban/templates/rollout-plan-template.md`
- `ai_oriented_kanban/templates/excutive-report-template.md`

#### 2. Graph-link system governance is not explicitly extended to kanban artifacts

- Docs have graph-link rules, but kanban artifacts do not enforce backlinking to canonical docs.
- No standard mapping between kanban items and the doc graph (index/guide entries + related links).

Representative files:

- `ai_oriented_kanban/10-active/`
- `docs/ai/assistant-context-index.md`

#### 3. Decision evidence and simulation-readiness outputs are not mandatory

- No required `Docs Needed` list in rollout artifacts before implementation starts.
- No mandatory per-decision evidence model (`decision ← docs cited ← sufficiency verdict ← fallback scan evidence ← doc update action`).
- No readiness check to prove a future assistant can execute comparable work with docs specs only.

Representative files:

- `ai_oriented_kanban/templates/rollout-plan-template.md`
- `docs/operations/ai-retrieval-smoke-tests.md`

### Risks in the current state

- [ ] Spec-first intent remains implicit; review quality depends on reviewer memory.
- [ ] Kanban artifacts do not guarantee doc linkage, causing retrieval gaps.
- [ ] Graph-link policy may regress in practice without explicit kanban gates.
- [ ] AI decisions are not reproducible because decision-to-doc evidence is not consistently captured.
- [ ] Docs-only project simulation cannot be validated without explicit readiness criteria.

## Scope

- Estimated files to create: 2
- Estimated files to modify: 7–10
- Risk level: Medium

### In scope

- Spec-first checklist integrated into ai-oriented kanban templates and active items.
- Graph-link system rules applied to kanban docs and doc-routing updates.
- Retrieval QA coverage for spec-first + kanban-driven tasks.
- Copilot instructions and routing guidance updated so AI assistants treat docs specs as primary sources, with code scans only when docs are insufficient and doc updates required to reconcile with code.
- Mandatory `Docs Needed` declaration and decision-evidence logging for each rollout.
- Simulation-readiness criteria so comparable tasks can be executed from docs specs with minimal/no code scanning.

### Out of scope

- Changing backend behavior or business logic.
- Refactoring existing API endpoints.

## Minimum Viable Hotfix

- Add a spec-first checklist and graph-link gating section to kanban templates, aligned with the certifai-app closing phases (Docs Sync, Reflection, Health Score).
- Add routing references in `docs/ai/guide.md` and index entries for any new governance docs.
- Update `copilot-instructions.md` with a docs-first decision rule and explicit “update docs if code differs” requirement.
- Add a mandatory `Docs Needed + Sufficiency Log` block in rollout artifacts so assistant decisions are auditable and reusable.

These steps are safe, low-risk, and immediately improve review quality and retrieval reliability.

## Docs Impact

### Docs checked during planning

| Doc                                           | Relevant finding                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `docs/operations/docs-maintenance.md`         | Layering + discoverability contract already defined for canonical docs. |
| `docs/operations/ai-retrieval-smoke-tests.md` | QA protocol exists but does not include kanban/spec-first prompts.      |
| `docs/ai/assistant-context-index.md`          | Complete canonical map; can register any new governance docs.           |
| `docs/ai/guide.md`                            | Task routing map exists; needs spec-first/kanban routing entry.         |
| `docs/workflow/README.md`                     | Workflow doc placement rules already in place.                          |

### Docs-First Retrieval Checklist

- [x] Loaded all primary docs for this task type from `docs/ai/guide.md`.
- [x] Declared `Docs Needed` list before implementation, with reason for each doc.
- [x] Assessed sufficiency — docs were **sufficient** / ~~**insufficient**~~.
  - If insufficient: docs that were missing, ambiguous, or outdated: _N/A in this phase set; no canonical gap blocked rollout progress._
  - If insufficient: fallback code scan was used for this specific decision: _N/A_
- [x] For each major decision, recorded evidence: `Decision`, `Docs cited`, `Sufficiency verdict`, `Fallback scan used?`, `Doc update action`.
- [x] Post-task docs update required: `[x] Yes` — captured in Docs to update below | `[ ] No` — docs remain accurate after this change.

### Docs Needed (Phase 4–6 execution)

| Doc | Why needed in this execution window |
| --- | --- |
| `docs/operations/ai-retrieval-smoke-tests.md` | Implement Phase 4 retrieval QA prompts and insufficiency-remediation scenario. |
| `docs/operations/spec-first-kanban-integration.md` | Validate required decision-evidence and remediation contract language for prompts/checks. |
| `docs/operations/docs-maintenance.md` | Confirm graph-link enforcement and docs-sync acceptance criteria. |
| `docs/ai/assistant-context-index.md` | Verify required discoverability links for governance docs. |
| `docs/ai/guide.md` | Validate routing entries used by new smoke-test prompts and docs-first execution rule. |
| `docs/ai/project-simulation-readiness.md` | Align Phase 6 reflection outputs with simulation-readiness rubric and blockers. |

### Decision Evidence Log (Phase 4–6 execution)

| Decision | Docs cited | Sufficiency verdict | Fallback code scan used? | Doc update action |
| --- | --- | --- | --- | --- |
| Expand retrieval QA with graph-link verification prompt | `docs/operations/ai-retrieval-smoke-tests.md`, `docs/operations/spec-first-kanban-integration.md` | Sufficient | No | Updated `docs/operations/ai-retrieval-smoke-tests.md` required prompt set and pass criteria. |
| Keep docs-sync placeholder check scoped to touched docs evidence | `docs/operations/docs-maintenance.md`, `docs/operations/ai-retrieval-smoke-tests.md` | Sufficient | No | Recorded verification evidence in this rollout and kept unresolved historical placeholder out of touched-doc scope. |
| Create follow-up operationalization rollout for simulation cadence and scan-ratio targets | `docs/ai/project-simulation-readiness.md`, `docs/ai/guide.md`, `ai_oriented_kanban/templates/rollout-plan-template.md` | Sufficient | No | Created `ai_oriented_kanban/10-active/simulation-readiness-ops-cadence.md` and linked handoff below. |

### Docs to create

| File                                               | Reason                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `docs/operations/spec-first-kanban-integration.md` | Canonical policy tying spec-first delivery to kanban artifacts and review gates. |
| `docs/ai/project-simulation-readiness.md`          | Defines docs-only simulation criteria and pass/fail evidence model.              |

### Docs to update

| File                                                       | What changes                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `docs/operations/docs-maintenance.md`                      | Add spec-first + kanban linkage policy and explicit graph-link gate. |
| `docs/operations/ai-retrieval-smoke-tests.md`              | Add spec-first/kanban prompts.                                       |
| `docs/ai/guide.md`                                         | Add routing for spec-first/kanban tasks.                             |
| `docs/ai/assistant-context-index.md`                       | Register new governance doc.                                         |
| `ai_oriented_kanban/templates/rollout-plan-template.md`    | Embed spec-first checklist and graph-link references.                |
| `ai_oriented_kanban/templates/excutive-report-template.md` | Add governance checklist summary block.                              |
| `.github/copilot-instructions.md`                          | Add docs-first priority, spec-first workflow, and doc-update fallback. |
| `ai_oriented_kanban/10-active/specs-first-kanban-integration.md` | Track simulation-readiness gates and evidence.                    |

### Docs to delete or archive

| File   | Reason                |
| ------ | --------------------- |
| _None_ | No deletions planned. |

## Context Map

### Files to modify first

| File                                                    | Purpose                       | Why it matters                             |
| ------------------------------------------------------- | ----------------------------- | ------------------------------------------ |
| `ai_oriented_kanban/templates/rollout-plan-template.md` | Spec-first + graph-link gates | Ensures every plan is spec-led and linked. |
| `docs/operations/docs-maintenance.md`                   | Governance contract update    | Makes policy enforceable in reviews.       |
| `.github/copilot-instructions.md`                        | Assistant behavior contract   | Enforces docs-first decisions + doc updates. |
| `docs/ai/project-simulation-readiness.md`               | Simulation readiness contract | Makes docs-only execution measurable.       |

### Likely files to create

| File                                               | Purpose                         |
| -------------------------------------------------- | ------------------------------- |
| `docs/operations/spec-first-kanban-integration.md` | Canonical policy and checklist. |
| `docs/ai/project-simulation-readiness.md`          | Docs-only simulation rubric.    |

### Dependencies / related patterns

| File                                          | Relationship                        |
| --------------------------------------------- | ----------------------------------- |
| `docs/ai/assistant-context-index.md`          | Index entry for new governance doc. |
| `docs/ai/guide.md`                            | Routing for spec-first tasks.       |
| `docs/operations/ai-retrieval-smoke-tests.md` | QA coverage for new governance.     |
| `.github/copilot-instructions.md`             | Assistant spec-first + docs-first rules. |
| `docs/ai/project-simulation-readiness.md`     | Defines docs-only reproducibility checks. |

### Risks

- [ ] Checklist adoption failure by reviewers.
- [ ] Partial linkage creates a false sense of compliance.

## Recommended Architecture

### Principle 1: Spec-first as a kanban invariant

Every kanban item must include a spec that is reviewable, scoped, and linked to canonical docs. The spec is the source of truth for scope, risks, and acceptance criteria.

### Principle 2: Graph-link system as a routing contract

Every new policy or workflow must be reachable from the index, the routing guide, and at least one related doc link to avoid orphaned knowledge.

### Principle 3: Decision traceability and self-healing docs

Every significant implementation decision must be traceable to cited docs. If docs are insufficient, assistants must capture the insufficiency and update the docs in the same rollout (or explicitly block with owner + due date).

### Principle 4: Docs-only simulation readiness

The documentation set should be sufficient to execute a comparable project by providing specs, routing, decision criteria, and verification steps without relying on implicit tribal knowledge.

## Dependency Rule

Each phase touches a single dependency layer (kanban templates, then docs, then QA/validation). Cross-layer changes are isolated to contract-alignment subphases.

## Phase Sequencing Rule

Default sequencing: contract definition → template integration → doc graph updates → QA + verification.

## Progress Markers

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — completed and verified
- `[!]` — blocked

## Progress Dashboard

- [x] Phase 1 — Spec-first kanban contract
- [x] Phase 2 — Template and checklist integration
- [x] Phase 3 — Graph-link system hardening
- [x] Phase 4 — Retrieval QA expansion
- [x] Phase 5 — Docs Sync
- [x] Phase 6 — AI-ready docs reflection and next-plan handoff
- [x] Phase 7 — Docs-only Simulation Drill
- [x] Phase 8 — Rollout Eval & Health Score

## Phases

### Phase 1: Spec-first kanban contract

**Progress**: `[x]`

**Layer**: governance policy

**Goal**: Define the spec-first requirements and how they map to kanban artifacts and review gates.

**Files**:

- `docs/operations/spec-first-kanban-integration.md` — create — canonical policy and checklist.
- `.github/copilot-instructions.md` — create/modify — spec-first workflow, docs-first decision rule, and doc update fallback.

**Verification gate**:

- Doc includes spec-first checklist, acceptance criteria schema, and reviewer gate.
- `## Related Docs` links to `docs/operations/docs-maintenance.md` and `docs/ai/guide.md`.
- `copilot-instructions.md` explicitly states docs specs are primary sources; code scans are fallback only when docs are insufficient; doc updates required if code diverges.
- PR template/checklist requires `Docs Needed` and decision-evidence capture before implementation work starts.

**Sub-subphase checklist**:

- [x] **1.1 — Define spec format**: scope, assumptions, constraints, decision log, acceptance criteria.
  - **Independent verification**: spec format is explicit and example included.
- [x] **1.2 — Define review gate**: PR checks and evidence requirements.
  - **Independent verification**: checklist includes `Docs Needed`, sufficiency verdicts, pass/fail criteria.
- [x] **1.3 — Update copilot instructions**: add spec-first workflow guidance and docs-first decision rules.
  - **Independent verification**: instructions include doc-priority, required docs listing, code-scan fallback, and doc-update mandate.

**Phase 1 verification notes (2026-05-29)**:

- `docs/operations/spec-first-kanban-integration.md` now includes explicit spec format, acceptance criteria schema, reviewer gate, and minimal example.
- `.github/copilot-instructions.md` now includes an explicit pre-implementation gate requiring docs-needed declaration and per-decision sufficiency logging.
- `.github/pull_request_template.md` now requires `Docs Needed` and `Decision Evidence Log` capture before implementation details.

---

### Phase 2: Template and checklist integration

**Progress**: `[x]`

**Layer**: kanban template layer

**Goal**: Make spec-first and graph-link gates mandatory in ai-oriented kanban templates.

**Files**:

- `ai_oriented_kanban/templates/rollout-plan-template.md` — modify — add spec-first + graph-link checklist block.
- `ai_oriented_kanban/templates/rollout-plan-template.md` — modify — align closing phases and Docs Sync/Reflection/Health Score sections with certifai-app template.
- `ai_oriented_kanban/templates/excutive-report-template.md` — modify — add governance summary section.

**Verification gate**:

- Templates include explicit checklist sections.
- Checklist references canonical docs for policy and routing.
- Rollout template’s closing phases and verification gates match certifai-app (Docs Sync, AI-ready reflection/handoff, Rollout Eval & Health Score) and include docs update progress in the flow.
- Rollout template requires a structured `Decision Evidence Log` table and non-optional docs insufficiency remediation workflow.

**Sub-subphase checklist**:

- [x] **2.1 — Add spec-first checklist**: add required spec fields and acceptance criteria block.
  - **Independent verification**: checklist appears in template and is not optional.
- [x] **2.2 — Add graph-link checklist**: require index/guide/related links for any new doc.
  - **Independent verification**: checklist includes explicit link destinations.
- [x] **2.3 — Align closing phases**: mirror certifai-app’s Docs Sync, Reflection/Handoff, and Health Score phases and integrate docs update progress into the rollout flow.
  - **Independent verification**: template closing phases match certifai-app sections and include docs-progress checks.
- [x] **2.4 — Add decision evidence schema**: include required fields (`Decision`, `Docs`, `Sufficiency`, `Fallback`, `Doc updates`).
  - **Independent verification**: no rollout can be marked complete without this evidence.

**Phase 2 verification notes (2026-05-29)**:

- `ai_oriented_kanban/templates/rollout-plan-template.md` now includes explicit non-optional `Spec-First Readiness Checklist` and `Graph-Link Checklist` sections.
- `ai_oriented_kanban/templates/rollout-plan-template.md` now includes a required `Docs Insufficiency Remediation Workflow` tied to `Decision Evidence Log` entries.
- Closing-phase gates now explicitly include graph-link completion and reflection of docs-insufficiency prevention patterns.
- `ai_oriented_kanban/templates/excutive-report-template.md` now includes a required `Spec-First + Graph-Link Governance Summary` section.

---

### Phase 3: Graph-link system hardening

**Progress**: `[x]`

**Layer**: documentation topology

**Goal**: Ensure new governance docs are indexed, routed, and linked; update policies accordingly.

**Files**:

- `docs/operations/docs-maintenance.md` — modify — add spec-first + kanban linkage policy and enforcement.
- `docs/ai/assistant-context-index.md` — modify — add governance doc entry.
- `docs/ai/guide.md` — modify — add routing entry for spec-first/kanban work.
- `docs/ai/project-simulation-readiness.md` — create — docs-only execution readiness criteria.

**Verification gate**:

- New governance doc appears in index and guide.
- `docs-maintenance` explicitly defines graph-link enforcement for kanban artifacts.
- `docs/ai/guide.md` explicitly states doc specs are primary, code scans are fallback, and doc updates are required if code differs.
- `project-simulation-readiness` defines measurable pass/fail checks for docs-only execution.

**Sub-subphase checklist**:

- [x] **3.1 — Update docs-maintenance**: add spec-first/kanban gate and graph-link expectation.
  - **Independent verification**: policy mentions kanban artifacts explicitly.
- [x] **3.2 — Update index and guide**: add entries pointing to new doc.
  - **Independent verification**: links resolve and appear in correct sections.
- [x] **3.3 — Define simulation rubric**: document docs-only execution criteria and evidence collection.
  - **Independent verification**: rubric includes minimum documentation set and pass threshold.

**Phase 3 verification notes (2026-05-29)**:

- `docs/operations/docs-maintenance.md` now includes explicit kanban artifact graph-link enforcement (index + guide + related-doc backlinks) and quarterly validation steps.
- `docs/ai/guide.md` now explicitly states docs specs are primary, fallback code scans are conditional, and docs updates are required when insufficiencies are found.
- `docs/ai/assistant-context-index.md` now includes a `Simulation Readiness` entry for `docs/ai/project-simulation-readiness.md`.
- `docs/ai/project-simulation-readiness.md` now defines measurable docs-only rubric, minimum doc set, scoring threshold (`>= 85`), run log template, and exit criteria.

---

### Phase 4: Retrieval QA expansion

**Progress**: `[x]`

**Layer**: QA protocol

**Goal**: Add spec-first/kanban prompts to AI retrieval smoke tests to validate new routing.

**Files**:

- `docs/operations/ai-retrieval-smoke-tests.md` — modify — add 1–2 prompts covering spec-first/kanban governance.

**Verification gate**:

- New prompts reference `docs/operations/spec-first-kanban-integration.md` and routing docs.
- Pass criteria includes correct graph-link usage.
- At least one prompt tests whether the assistant can list required docs before implementation and identify insufficiencies with concrete doc updates.

**Sub-subphase checklist**:

- [x] **4.1 — Add prompts**: create at least one prompt for spec-first planning and one for graph-link verification.
  - **Independent verification**: prompt doc paths match canonical docs.
- [x] **4.2 — Add insufficiency remediation prompt**: simulate ambiguous docs and verify assistant proposes exact doc updates.
  - **Independent verification**: expected answer includes docs-needed list + update targets.

**Phase 4 verification notes (2026-05-29)**:

- `docs/operations/ai-retrieval-smoke-tests.md` now includes explicit graph-link usage in pass criteria.
- Added Prompt 8 for governance graph-link verification using index + guide + related-doc checks.
- Added Prompt 9 for docs-insufficiency remediation with explicit update-target expectations.

---

### Phase 5: Docs Sync _(mandatory closing phase)_

**Progress**: `[x]`

**Layer**: documentation layer

**Goal**: Ensure all docs listed in `## Docs Impact` are created, updated, or archived so the knowledge base stays accurate after this rollout.

**Pre-condition check**:

- Review `## Docs Impact` section of this plan.

**Files** _(from Docs Impact section above)_:

- `docs/operations/spec-first-kanban-integration.md` — create — canonical policy.
- `docs/ai/project-simulation-readiness.md` — create — docs-only simulation rubric.
- `docs/operations/docs-maintenance.md` — modify — policy updates.
- `docs/operations/ai-retrieval-smoke-tests.md` — modify — new prompts.
- `docs/ai/guide.md` — modify — routing entries.
- `docs/ai/assistant-context-index.md` — modify — index entry.
- `ai_oriented_kanban/templates/rollout-plan-template.md` — modify — checklist updates.
- `ai_oriented_kanban/templates/excutive-report-template.md` — modify — governance summary.

**Verification gate**:

- Every doc listed in `## Docs Impact → Docs to create` exists.
- Every doc listed in `## Docs Impact → Docs to update` has an updated `Last reviewed:` date.
- `grep -r "TODO\|FIXME\|TBD" docs/ | grep -v "_template"` returns no unresolved placeholders in updated files.
- `grep "spec-first-kanban-integration" docs/ai/assistant-context-index.md` returns a match.
- `grep "project-simulation-readiness" docs/ai/assistant-context-index.md` returns a match.
- All touched docs have a valid `## Related Docs` section with working links.

**Sub-subphase checklist**:

- [x] **5.0 — Confirm docs-first retrieval checklist**: verify the checklist is completed.
  - **Independent verification**: sufficiency is explicitly marked.
- [x] **5.1 — Create new docs**: author all new files.
  - **Independent verification**: new doc has `Source of truth`, `Last reviewed`, `Owner`.
- [x] **5.2 — Update existing docs**: apply all changes listed.
  - **Independent verification**: updated `Last reviewed` dates and consistent guidance.
- [x] **5.3 — Update assistant-context-index**: add new entry.
  - **Independent verification**: index entry appears under Operations or Process.
- [x] **5.4 — Verify link integrity**: validate related docs links.
  - **Independent verification**: spot-check each updated doc.
- [x] **5.5 — Verify decision evidence fields**: confirm templates/docs enforce required decision-evidence schema.
  - **Independent verification**: schema appears in template + governance docs.

**Phase 5 verification notes (2026-05-29)**:

- Confirmed docs-first checklist is completed in this rollout and sufficiency is explicitly marked `Sufficient`.
- Verified created docs exist and include metadata fields: `docs/operations/spec-first-kanban-integration.md`, `docs/ai/project-simulation-readiness.md`.
- Verified index matches required references for `spec-first-kanban-integration` and `project-simulation-readiness`.
- Verified touched canonical docs include `## Related Docs` heading and working cross-links.
- Placeholder scan found one historical `TBD` in `docs/ai/repo-map.md` (not touched in this rollout phase); touched docs in this rollout have no unresolved placeholders.

---

### Phase 6: AI-ready docs reflection and next-plan handoff _(mandatory closing phase)_

**Progress**: `[x]`

**Layer**: planning/documentation improvement layer

**Goal**: Capture learnings and convert them into a follow-up plan if needed.

**Pre-condition check**:

- Review open questions and policy gaps found during rollout.

**Files**:

- `ai_oriented_kanban/10-active/simulation-readiness-ops-cadence.md` — create — follow-up plan.
- `ai_oriented_kanban/10-active/specs-first-kanban-integration.md` — modify — add handoff note.

**Verification gate**:

- Next rollout file exists with phases, verification gates, and rollback plan.
- Current plan includes handoff note and link.
- Reflection includes at least one docs insufficiency pattern and one prevention update for future assistant runs.

**Sub-subphase checklist**:

- [x] **6.1 — Summarize improvements**: capture confirmed follow-up actions.
  - **Independent verification**: actions listed in next plan scope.
- [x] **6.2 — Convert open questions**: add owners and decision criteria.
  - **Independent verification**: no open question lacks decision path.
- [x] **6.3 — Author next rollout**: write follow-up plan file.
  - **Independent verification**: complete phased plan exists.
- [x] **6.4 — Record handoff**: add handoff note to current plan.
  - **Independent verification**: link is present.
- [x] **6.5 — Capture simulation blockers**: list blockers to docs-only execution with owners/dates.
  - **Independent verification**: each blocker has mitigation and due date.

**Phase 6 verification notes (2026-05-29)**:

- Authored follow-up rollout `ai_oriented_kanban/10-active/simulation-readiness-ops-cadence.md` with phased plan, verification gates, and rollback.
- Converted the two open questions in this rollout into owned decision tracks in the follow-up plan.
- Captured simulation-readiness blockers with owners, due dates, and mitigation actions in the follow-up plan.
- Documented a recurring insufficiency pattern: governance-ready docs did not yet define simulation cadence and acceptable fallback-scan ratio targets.
- Added prevention update: follow-up rollout now enforces owner-bound cadence/ratio policy decisions before Phase 7 drill closure.
- Added explicit handoff note and link below for next execution cycle.

---

### Phase 7: Docs-only Simulation Drill _(mandatory closing phase)_

**Progress**: `[x]`

**Layer**: validation and reproducibility layer

**Goal**: Prove that a new assistant can execute a comparable task by consuming docs specs and routing docs first, with fallback scans only when explicitly justified.

**Pre-condition check**:

- Phase 5 and Phase 6 are complete or justifiably blocked.

**Files**:

- `docs/operations/ai-retrieval-smoke-tests.md` — modify — add simulation drill scenario.
- `docs/ai/project-simulation-readiness.md` — create/modify — capture drill criteria and result template.
- `ai_oriented_kanban/10-active/specs-first-kanban-integration.md` — modify — record drill outcome and follow-ups.

**Verification gate**:

- Simulation drill result includes: `Docs Needed`, decision evidence log, insufficiency findings, doc updates made.
- At least one drill run achieves docs-first completion with no unjustified code scan.
- Any fallback code scan includes explicit insufficiency reason and corresponding docs update action.

**Sub-subphase checklist**:

- [x] **7.1 — Author drill scenario**: define a representative feature planning task and required output format.
  - **Independent verification**: scenario references canonical docs and success criteria.
- [x] **7.2 — Execute drill and capture evidence**: run the scenario and log outcomes.
  - **Independent verification**: log includes decision evidence and insufficiency remediation.
- [x] **7.3 — Apply corrective docs updates**: fix missing/ambiguous docs found by drill.
  - **Independent verification**: all identified doc gaps are updated or formally tracked.

**Phase 7 verification notes (2026-05-29)**:

- Added explicit drill scenario prompt (`### 10`) to `docs/operations/ai-retrieval-smoke-tests.md` with required run-log outputs and pass/fail handling.
- Executed and recorded simulation run evidence in `docs/ai/project-simulation-readiness.md` under `## Simulation Run Log` (includes `Docs Needed`, `Decision Evidence Log`, scorecard, and verdict).
- Drill scored `98/100` with `Pass` verdict and no unjustified fallback scan.
- No critical insufficiency was found; preventive updates were still applied via smoke-test drill formalization.

---

### Phase 8: Rollout Eval & Health Score _(mandatory closing phase)_

**Progress**: `[x]`

**Layer**: rollout quality/evaluation layer

**Goal**: Produce a 0–120 health score for the rollout after Docs Sync, reflection, and simulation drill complete.

**Pre-condition check**:

- Phase 5, Phase 6, and Phase 7 are complete or justifiably blocked.

**Scoring rubric**:

| Dimension            | Max Points | How scored                                                |
| -------------------- | ---------- | --------------------------------------------------------- |
| Docs-first adherence | 40         | Checklist complete and sufficiency assessed               |
| Docs health          | 40         | Docs Sync gates passed                                    |
| Reflection quality   | 20         | At least one improvement and decisions for open questions |
| Simulation readiness | 20         | Docs-only execution rubric pass and blocker closure plan  |
| **Total**            | **120**    | Pass threshold: $\ge 85$                                  |

**Verification gate**:

- Score table populated with evidence for all dimensions.
- Session note records final score and archive readiness.

**Sub-subphase checklist**:

- [x] **8.1 — Evaluate docs-first adherence**: review checklist completion.
  - **Independent verification**: checklist complete.
- [x] **8.2 — Evaluate docs health**: verify Docs Sync gates.
  - **Independent verification**: all gates pass or justified.
- [x] **8.3 — Evaluate reflection quality**: review reflection output.
  - **Independent verification**: improvement and decision paths exist.
- [x] **8.4 — Evaluate simulation readiness**: verify drill outcome and blocker closure plan.
  - **Independent verification**: drill evidence exists and gaps are owned.
- [x] **8.5 — Record final score**: add session note with total score.
  - **Independent verification**: score recorded and linked.

**Phase 8 score table (2026-05-29)**:

| Dimension | Max Points | Points Earned | Evidence |
| --- | --- | --- | --- |
| Docs-first adherence | 40 | 40 | `Docs-First Retrieval Checklist` complete; `Docs Needed` + decision evidence captured in this rollout. |
| Docs health | 40 | 38 | Docs Sync gates passed for touched scope; one historical `TBD` remains in untouched `docs/ai/repo-map.md`. |
| Reflection quality | 20 | 20 | Phase 6 includes insufficiency pattern + prevention update + owned follow-up plan. |
| Simulation readiness | 20 | 20 | Phase 7 drill logged in `docs/ai/project-simulation-readiness.md` with `98/100` pass and no unjustified fallback scan. |
| **Total** | **120** | **118** | **Pass (`>= 85`)** |

### Session Note — 2026-05-29 23:45 local

- Completed: Phase 7 + Phase 8 closeout
- Verified by: simulation run log recorded, prompt coverage updated, and score table populated with evidence links
- Final score: `118/120` (pass)
- Archive readiness: Ready to archive after follow-up rollout (`simulation-readiness-ops-cadence.md`) is tracked as separate execution stream
- Blockers: None for this rollout closure; follow-up policy operationalization remains intentionally open in linked rollout

## Dependency Graph

```text
Spec-first policy
	↓
Kanban templates
	↓
Doc graph + routing
	↓
Retrieval QA
  ↓
Docs-only simulation drill
```

## Suggested Implementation Order

1. Phase 1 — Spec-first kanban contract
2. Phase 2 — Template and checklist integration
3. Phase 3 — Graph-link system hardening
4. Phase 4 — Retrieval QA expansion
5. Phase 5 — Docs Sync
6. Phase 6 — AI-ready docs reflection and next-plan handoff
7. Phase 7 — Docs-only Simulation Drill
8. Phase 8 — Rollout Eval & Health Score

## Success Criteria

- Spec-first checklist embedded in kanban templates and used for new items.
- New governance doc is indexed, routed, and linked.
- Retrieval smoke tests include spec-first/kanban prompts and pass.
- Each rollout captures `Docs Needed` and per-decision evidence.
- Docs insufficiencies found during work are converted into same-rollout doc updates or explicit blockers with owners.
- A docs-only simulation drill demonstrates reproducible assistant outcomes from docs specs.

## Rollback Plan

1. Revert template changes if checklist adoption blocks workflow.
2. Revert governance doc updates if policy conflicts with existing process.
3. Revert routing/index entries if they point to rejected policies.

## Open Questions

1. Should docs-only simulation drills run for every major rollout or on a release cadence (e.g., biweekly)?
  - **Owner:** Eng Productivity Lead
  - **Decision criteria:** Delivery overhead per sprint, defect escape trend, and readiness score stability over 2 cycles.
  - **Target date:** 2026-06-12 (tracked in follow-up rollout).
2. What is the acceptable fallback-code-scan ratio target before we call docs “simulation ready”?
  - **Owner:** AI Governance DRI
  - **Decision criteria:** Median fallback ratio over 3 drills, unresolved-doc-gap count, and false-positive insufficiency rate.
  - **Target date:** 2026-06-12 (tracked in follow-up rollout).

## Handoff Note (Phase 6)

- Follow-up rollout created: `ai_oriented_kanban/10-active/simulation-readiness-ops-cadence.md`.
- Next execution starts at follow-up **Phase 1** to operationalize simulation cadence + fallback ratio policy.
- This rollout remains open for Phase 7 and Phase 8 completion after follow-up decisions are merged.

## Recommendation

Phases 1–8 are now completed for this rollout, with a passing health score (`118/120`) and recorded simulation-drill evidence. Proceed by tracking policy operationalization work in `ai_oriented_kanban/10-active/simulation-readiness-ops-cadence.md`, then archive this rollout after confirming follow-up ownership remains active.
