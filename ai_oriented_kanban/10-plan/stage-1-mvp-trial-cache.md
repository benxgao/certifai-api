# Rollout: Stage 1 MVP Public Demo Cache

## Summary

This rollout defines the execution plan for **Stage 1** of cached questions (The full plan of the 4 stages can be found in `ai_oriented_kanban/00-intake/trial-cert-questions-from-cache.md`): ship a fast, public, no-login trial experience using pre-generated question pools on top certification pages. The intent is to minimize time-to-market while preserving architecture boundaries, response-contract consistency, and rollback safety.

The Stage 1 release focuses on a minimal vertical slice: public trial creation, question fetch from `DEMO_PUBLIC` cache, trial submission with immediate score response, summary-only trial persistence in Firestore, deterministic trial IDs derived from visitor IP-based hashes, and instrumentation for baseline conversion events. Advanced restrictions, scheduler automation, and registered-user starter cache are intentionally deferred to later stages.

## Current Evaluation

### What already exists

- Existing Express API routing conventions under `functions/src/endpoints/api/`.
- Standard `ApiResponse<T>` envelope and metadata conventions.
- Service layer boundaries for Redis, Firestore, Cloud Tasks, and Genkit.
- Redis key and TTL guidance via centralized cache patterns.

### What is not centralized / stable / complete yet

#### 1. Public trial cache API contract is not explicitly formalized

- Stage 1 needs public trial routes with clear payload/metadata shape.
- `cache_hit` and fallback metadata are required for observability from day one.

Representative files:

- `functions/src/endpoints/api/` (new public-trial routes expected)
- `functions/src/types/express.ts`

#### 2. Stage 1 trial domain boundaries are not codified as an implementation plan

- Trial-domain isolation exists at product-plan level, but execution sequence and verification gates are not yet defined.
- Need explicit hotfix-first slicing and rollback path.

Representative files:

- `ai_oriented_kanban/00-intake/trial-cert-questions-from-cache.md`
- `docs/services/service-catalog.md`

### Risks in the current state

- [ ] Scope creep from Stage 1 into Stage 2/3/4 features.
- [ ] Cache key inconsistency causing hard-to-debug misses.
- [ ] Public endpoint behavior divergence from envelope/auth conventions.
- [ ] Unclear fallback UX contract when cache pool is empty/stale.

## Scope

- Estimated files to create: 3
- Estimated files to modify: 8
- Risk level: Medium

### In scope

- Stage 1 public-trial backend contract and delivery plan.
- `DEMO_PUBLIC` cached question retrieval for top certifications.
- Trial submit flow with immediate score response.
- Stage 1 summary-only trial persistence in Firestore.
- Baseline analytics instrumentation requirements (`demo_started`, `demo_completed`, `signup_clicked`).
- Friendly unavailable-state contract when no valid cache exists.

### Out of scope

- Scheduler/auto-refresh infrastructure (Stage 2).
- Restriction/anti-abuse and explanation lock logic (Stage 3).
- Registered-user cached starter pool (`REGISTERED_SHARED`, Stage 4).
- Percentile band in Stage 1 score response (deferred to Stage 3).
- Personalization, adaptive difficulty, and advanced linking.

### Assumptions

- Public trial routes can remain unauthenticated while following API envelope rules.
- Pre-generated pools are available for initial top certifications before release.
- Frontend integration will consume the Stage 1 contracts in parallel but is tracked in app-side planning lane.

### Constraints

- Must follow response envelope and endpoint conventions.
- Must route all cache operations through Redis/cache services.
- Must preserve service-layer boundaries (no direct infra SDK logic in route handlers).
- Stage 1 submission persistence is summary-only in Firestore (no per-question answer persistence).
- Firestore write path must remain idempotent for duplicate submit requests.
- Trial ID must be generated server-side as a hashed identifier from visitor IP composition (never persist raw IP in trial summary records).
- Trial ID hash generation must use a secret salt/pepper from environment configuration.
- Must keep rollback possible via feature flag (`public_demo_cache_enabled`).

### Acceptance Criteria

- **Given** Stage 1 public trial APIs are enabled, **when** a visitor starts a trial, **then** first questions load from `DEMO_PUBLIC` cache and response uses `{ success, data, meta? }`. **Evidence**: endpoint integration tests + response snapshot assertions.
- **Given** a valid trial submission, **when** answers are posted, **then** score summary is returned immediately with deterministic scoring fields. **Evidence**: submission contract tests.
- **Given** a public trial is created/submitted, **when** the API composes `trial_id`, **then** it is deterministic for the same hashed-IP composition window and no raw IP is persisted to Firestore trial summary documents. **Evidence**: unit tests for trial-id generator + Firestore payload assertions.
- **Given** no valid pool exists, **when** question fetch is requested, **then** API returns a friendly unavailable contract (not on-demand generation). **Evidence**: cache-miss integration tests.
- **Given** Stage 1 is live, **when** trial lifecycle events occur, **then** baseline events are emitted/recorded. **Evidence**: telemetry assertions or log grep in non-prod validation.

## Minimum Viable Hotfix

- Phase 0, Phase 1, and Phase 2 below constitute the hotfix path: baseline verification + contract + read-only cache retrieval with strict fallback.
- These are minimal because they avoid scheduler complexity, restrictions, and registered-user flows while delivering immediate GTM value.

## Docs Impact

> Complete this section at planning time — before writing any code.

### Docs checked during planning

| Doc                                                               | Relevant finding                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `docs/ai/guide.md`                                                | Confirms docs-first routing and rollout governance path for planning tasks.      |
| `docs/ai/assistant-context-index.md`                              | Confirms canonical docs to cite for API, cache, service boundaries, and testing. |
| `docs/operations/spec-first-kanban-integration.md`                | Requires Docs Needed + Decision Evidence + mandatory closing phases.             |
| `docs/api/endpoint-conventions.md`                                | Establishes REST/public route patterns and status code expectations.             |
| `docs/api/response-envelope.md`                                   | Confirms strict `{ success, data, meta? }` envelope contract.                    |
| `docs/cache/redis-patterns.md`                                    | Requires centralized key prefixes/TTL and Redis service usage.                   |
| `docs/services/service-catalog.md`                                | Confirms handler-thin/service-heavy boundary.                                    |
| `docs/testing/strategy.md`                                        | Defines contract-first tests and idempotency-focused verification.               |
| `ai_oriented_kanban/00-intake/trial-cert-questions-from-cache.md` | Provides approved Stage 1 business scope and exit criteria.                      |

### Docs-First Retrieval Checklist

- [x] Loaded all primary docs for this task type from `docs/ai/guide.md`.
- [x] Declared `Docs Needed` list with a reason for each required doc before implementation starts.
- [x] Assessed sufficiency — docs were **sufficient**.
- [x] Recorded decision evidence for all major decisions.
- [x] Post-task docs update required: `[x] Yes` | `[ ] No` — public trial identifier and Firestore service-boundary docs updated.

### Spec-First Readiness Checklist (required)

- [x] Spec includes explicit `Scope` (in/out boundaries).
- [x] Spec includes `Assumptions` with cited docs.
- [x] Spec includes `Constraints` (technical/process guardrails).
- [x] Spec includes `Decision Log` entries for major decisions.
- [x] Spec includes measurable `Acceptance Criteria` with independent verification.

### Graph-Link Checklist (required)

- [x] No new governance docs introduced in this planning artifact.
- [x] Existing governance docs referenced are already indexed and routed.
- [x] No new docs created that require additional graph-link registration.
- [x] No orphan-doc risk introduced by this plan.

### Docs Needed (required before implementation)

| Doc                                                               | Why it is needed for this rollout                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `docs/api/endpoint-conventions.md`                                | Define route shape, status codes, and public endpoint conventions. |
| `docs/api/response-envelope.md`                                   | Keep response schema stable for `certifai-app` integration.        |
| `docs/cache/redis-patterns.md`                                    | Ensure key naming, TTL, and invalidation behavior are canonical.   |
| `docs/services/service-catalog.md`                                | Enforce service-layer orchestration boundary in handlers.          |
| `docs/testing/strategy.md`                                        | Define verification gates for contract and cache-miss behavior.    |
| `docs/operations/spec-first-kanban-integration.md`                | Keep rollout governance compliant.                                 |
| `ai_oriented_kanban/00-intake/trial-cert-questions-from-cache.md` | Anchor implementation to approved Stage 1 scope and exits.         |

### Decision Evidence Log (required)

| Decision                                                        | Docs cited                                                             | Sufficiency verdict | Fallback code scan used? | Doc update action                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------- | ------------------------ | --------------------------------------- |
| Keep Stage 1 limited to public demo cache + submit + analytics  | `ai_oriented_kanban/00-intake/trial-cert-questions-from-cache.md`      | Sufficient          | No                       | None                                    |
| Persist only final score summary in Stage 1                     | `ai_oriented_kanban/00-intake/trial-cert-questions-from-cache.md`      | Sufficient          | No                       | None                                    |
| Persist Stage 1 trial summaries in Firestore (not Prisma)       | `docs/services/service-catalog.md`                                     | Sufficient          | No                       | None                                    |
| Use server-generated hashed IP-composed value as `trial_id`     | `docs/api/endpoint-conventions.md`, `docs/services/service-catalog.md` | Sufficient          | No                       | Update docs with public trial ID policy |
| Defer percentile-band response fields to Stage 3                | `ai_oriented_kanban/00-intake/trial-cert-questions-from-cache.md`      | Sufficient          | No                       | None                                    |
| Use standard envelope for all new trial endpoints               | `docs/api/response-envelope.md`, `docs/api/endpoint-conventions.md`    | Sufficient          | No                       | None                                    |
| Route cache access through service layer with centralized keys  | `docs/cache/redis-patterns.md`, `docs/services/service-catalog.md`     | Sufficient          | No                       | None                                    |
| Use one shared unavailable message contract across API/frontend | `docs/api/response-envelope.md`                                        | Sufficient          | No                       | None                                    |
| Use contract-first tests for fallback and score submission      | `docs/testing/strategy.md`                                             | Sufficient          | No                       | None                                    |

### Docs Insufficiency Remediation Workflow (non-optional)

No insufficiency found at planning time; remediation section not triggered.

### Docs to create

| File   | Reason                                                                         |
| ------ | ------------------------------------------------------------------------------ |
| _None_ | Stage 1 rollout plan is sufficient without introducing new canonical docs yet. |

### Docs to update

| File                               | What changes                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `docs/api/endpoint-conventions.md` | Add public-trial identifier rule: server-side hashed IP composition only, no raw IP persistence.          |
| `docs/services/service-catalog.md` | Add Firestore-service responsibility for Stage 1 trial summary persistence and trial-id hashing boundary. |

### Docs to delete or archive

| File   | Reason                                                |
| ------ | ----------------------------------------------------- |
| _None_ | No deprecations introduced by this planning artifact. |

### No docs affected

- [ ] Confirmed: this plan introduces no new patterns, changes no existing conventions, and removes no documented features.

## Context Map

### Files to modify first

| File                                               | Purpose                                      | Why it matters                               |
| -------------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| `functions/src/endpoints/api/index.ts`             | Register Stage 1 public trial routes         | Entry-point wiring and route discoverability |
| `functions/src/endpoints/api/public/` (new router) | Define public trial endpoints                | Main Stage 1 API surface                     |
| `functions/src/services/cache/`                    | Add semantic helpers for demo pool retrieval | Prevent ad hoc key logic in handlers         |

### Likely files to create

| File                                                           | Purpose                             |
| -------------------------------------------------------------- | ----------------------------------- |
| `functions/src/endpoints/api/public/trials.ts`                 | Stage 1 public trial route handlers |
| `functions/src/services/trialExam/Stage1PublicTrialService.ts` | Stage 1 trial orchestration service |
| `functions/__tests__/stage1-public-trial-contract.test.ts`     | API contract and fallback tests     |

### Dependencies / related patterns

| File                                    | Relationship                                      |
| --------------------------------------- | ------------------------------------------------- |
| `functions/src/types/express.ts`        | Shared response/request typing                    |
| `functions/src/services/redis/index.ts` | Redis data access boundary                        |
| `functions/src/services/cache/index.ts` | Cache manager + semantic invalidation conventions |
| `functions/src/services/firestore/`     | Trial summary persistence boundary                |

### Risks

- [ ] If scoring writes are added too early, Stage 1 complexity rises beyond MVP target.
- [ ] Missing fixture coverage for empty/stale pools can regress fallback UX.
- [ ] Firestore document growth and retention policy may be undefined for anonymous trial data.
- [ ] IP-based identifier collisions can occur for shared/NAT networks; collision handling must be deterministic and safe.
- [ ] Incorrect proxy trust configuration can produce unstable or spoofable client IP extraction.

## Resolved Design Decisions (2026-06-06)

- [x] **Trial ID strategy resolved**: use server-generated hashed identifier composed from visitor IP for Stage 1 public trials.
- [x] **Idempotency key resolved**: use `trial_id` as primary idempotency key for Firestore summary upsert in Stage 1.
- [x] **Persistence model resolved**: single Firestore summary document per `trial_id` for Stage 1 MVP (no per-attempt append collection).
- [x] **Collection naming resolved**: use dedicated Firestore collection for Stage 1 trial summaries (`trial_exam_summaries`).

## Open Questions / Concerns

- [ ] **Retention + cleanup**: what is the required TTL/archival policy for anonymous trial summaries?
  - **Concern**: indefinite retention may increase cost and compliance risk.
- [ ] **Security rules and access surface**: any Firestore rules updates needed if data is only server-written but queried for analytics?
  - **Concern**: future read paths could accidentally broaden access if rules are not explicit now.
- [ ] **Regional consistency**: does Firestore region align with Functions runtime and expected write latency?
  - **Concern**: cross-region writes may impact submit P95 in public demo traffic spikes.

## Recommended Architecture

### Principle 1: Thin handler, domain service orchestration

Endpoint handlers parse request + return envelope; Stage 1 selection/fallback/scoring logic lives in dedicated trial service(s).

### Principle 2: Read-mostly cache path for MVP

Keep Stage 1 primarily read-focused against pre-generated pools; avoid introducing scheduler regeneration or dynamic on-demand generation.

### Principle 3: Feature-flagged release and hard fallback

Protect release behind `public_demo_cache_enabled`; if no valid pool, return deterministic unavailable contract.

## Dependency Rule

Each phase in this Stage 1 rollout touches one primary layer only:

0. Discovery/evidence layer (existing-solution verification + drift check)
1. Contract layer (types + route contract)
2. Cache/service layer (pool selection + fallback)
3. Trial domain persistence/scoring layer
4. Test + observability validation layer

This reduces mixed-layer failures and keeps rollback scope narrow.

## Phase Sequencing Rule

Default sequence for Stage 1: baseline verification/drift detection → API contract → cache retrieval/fallback → trial submit/scoring → telemetry/tests.

## Commit Slicing Rule

Each phase should ship in one or two safe commits maximum, with independent verification gates.

## Progress Markers

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — completed and verified
- `[!]` — blocked

## Progress Dashboard

- [ ] Phase 0 — Baseline verification + drift detection
- [ ] Phase 1 — Public API contract + flag gates
- [ ] Phase 2 — Demo pool selection + fallback behavior
- [ ] Phase 3 — Trial submission + immediate scoring
- [ ] Phase 4 — Stage 1 analytics + test hardening
- [ ] Phase 5 — Docs Sync
- [ ] Phase 6 — AI-ready docs reflection and next-plan handoff
- [ ] Phase 7 — Docs-only Simulation Drill
- [ ] Phase 8 — Rollout Eval & Health Score

## Phases

### Phase 0: Baseline verification + architecture evidence

**Progress**: `[ ]`

**Layer**: discovery/evidence layer

**Goal**: Verify existing solutions, detect doc drift before coding, confirm architectural boundaries, and provide codebase evidence for design decisions.

**Files**:

- `docs/api/endpoint-conventions.md` — read/verify — confirm route and status-code expectations
- `docs/api/response-envelope.md` — read/verify — confirm stable envelope contract
- `docs/cache/redis-patterns.md` — read/verify — confirm canonical key/TTL patterns
- `docs/services/service-catalog.md` — read/verify — confirm handler/service boundaries
- `functions/src/endpoints/api/` — inspect — collect evidence of current routing patterns
- `functions/src/services/cache/` — inspect — collect evidence of existing cache helper conventions

**Verification gate**:

- Existing route/cache/service implementations are inventoried with file-level evidence.
- Drift table records any mismatch between docs and code before implementation starts.
- Stage 1 assumptions are explicitly marked as `confirmed` or `open` with owner/action.

**Sub-subphase checklist**:

- [ ] **0.1 — Verify existing solutions**: identify reusable route handlers, cache helpers, and trial-domain primitives already in the codebase.
  - **Independent verification**: evidence table includes concrete file paths + symbols.
- [ ] **0.2 — Detect doc drift pre-coding**: compare canonical docs vs current implementation behavior.
  - **Independent verification**: drift findings logged as `none` or tracked deltas with resolution path.
- [ ] **0.3 — Confirm architecture boundaries**: validate thin-handler/service-heavy boundary and no direct infra calls in handlers.
  - **Independent verification**: code scan evidence confirms boundary compliance or lists required remediation.
- [ ] **0.4 — Capture decision evidence**: map each major Stage 1 design choice to doc citations plus codebase proof.
  - **Independent verification**: Decision Evidence Log contains doc citation + file reference for each decision.
- [ ] **0.5 — AI-assisted plan refresh**: require AI assistants to update this Stage 1 plan using Phase 0 findings before any code implementation begins.
  - **Independent verification**: plan diff includes explicit updates to scope/risks/files/phases tied to Phase 0 evidence entries.

---

### Phase 1: Public API contract + flag gates

**Progress**: `[ ]`

**Layer**: API contract layer

**Goal**: Define and expose Stage 1 public trial endpoints with feature-flag guard and stable envelope.

**Files**:

- `functions/src/endpoints/api/index.ts` — modify — route registration
- `functions/src/endpoints/api/public/trials.ts` — create — public trial endpoints
- `functions/src/types/express.ts` — modify (if needed) — explicit Stage 1 response typing

**Verification gate**:

- Route registration grep confirms Stage 1 router is wired.
- Contract tests assert `{ success, data, meta? }` for success and `{ success:false, error }` for failures.

**Sub-subphase checklist**:

- [ ] **1.1 — Define endpoint contracts**: request/response schema for create/fetch/submit.
  - **Independent verification**: compile-time type checks + response snapshots.
- [ ] **1.2 — Add feature-flag gate**: gate public routes behind `public_demo_cache_enabled`.
  - **Independent verification**: tests for enabled vs disabled behaviors.

---

### Phase 2: Demo pool selection + fallback behavior

**Progress**: `[ ]`

**Layer**: cache/service layer

**Goal**: Resolve Stage 1 question retrieval from `DEMO_PUBLIC` cache with strict unavailable fallback using one shared unavailable message contract.

**Files**:

- `functions/src/services/trialExam/Stage1PublicTrialService.ts` — create — pool selection orchestration
- `functions/src/services/cache/index.ts` — modify — helper extension for Stage 1 keys/TTL usage
- `functions/src/services/redis/index.ts` — modify (if needed) — key helper reuse only

**Verification gate**:

- Cache hit path returns questions with `meta.cache_hit = true`.
- Empty/stale path returns friendly unavailable response and no generation side effects.

**Sub-subphase checklist**:

- [ ] **2.1 — Implement pool lookup**: certification + `DEMO_PUBLIC` selection logic.
  - **Independent verification**: unit tests for valid pool selection.
- [ ] **2.2 — Implement fallback contract**: deterministic unavailable response for miss/stale.
  - **Independent verification**: integration tests for miss/stale cases.

---

### Phase 3: Trial submission + immediate scoring

**Progress**: `[ ]`

**Layer**: trial domain/persistence layer (Firestore-backed)

**Goal**: Add Stage 1 answer submission and immediate score summary response while persisting only final summary fields in Firestore.

**Files**:

- `functions/src/endpoints/api/public/trials.ts` — modify — submit endpoint wiring
- `functions/src/services/trialExam/Stage1PublicTrialService.ts` — modify — scoring orchestration
- `functions/src/services/firestore/` (relevant module) — modify/create — minimal persistence/read path for trial summary results

**Verification gate**:

- Submit endpoint returns score summary fields consistently.
- Duplicate submit behavior is deterministic and non-destructive.

**Sub-subphase checklist**:

- [ ] **3.1 — Add submit contract**: validate payload and response shape.
  - Generate `trial_id` server-side from hashed IP composition (do not accept raw `trial_id` from client).
  - **Independent verification**: endpoint contract tests for valid/invalid payloads.
- [ ] **3.2 — Add scoring summary**: compute `%`, correct count, completion timestamp.
  - Stage 1 explicitly excludes percentile-band fields.
  - Persist summary-only fields via Firestore service boundary (no direct SDK in handler).
  - Upsert Firestore summary by `trial_id` for deterministic duplicate-submit behavior.
  - **Independent verification**: deterministic scoring test fixtures.

---

### Phase 4: Stage 1 analytics + test hardening

**Progress**: `[ ]`

**Layer**: observability/testing layer

**Goal**: Guarantee measurable Stage 1 impact and regression safety before rollout.

**Files**:

- `functions/__tests__/stage1-public-trial-contract.test.ts` — create — contract/fallback coverage
- `functions/__tests__/stage1-public-trial-events.test.ts` — create — event emission checks
- `functions/src/services/monitoring/` (or logging wrapper) — modify — baseline event hooks

**Verification gate**:

- Tests pass for `demo_started`, `demo_completed`, `signup_clicked` event hooks.
- Contract + fallback + submit tests pass in CI.

**Sub-subphase checklist**:

- [ ] **4.1 — Add contract/fallback test suite**: include cache hit, miss, stale, and submit.
  - **Independent verification**: targeted jest run passes.
- [ ] **4.2 — Add event assertions**: verify baseline event fields and firing conditions.
  - **Independent verification**: event test suite passes with stable fixtures.

---

### Phase 5: Docs Sync _(mandatory closing phase)_

**Progress**: `[ ]`

**Layer**: documentation layer

**Goal**: Update canonical docs only if implementation diverges from currently sufficient docs.

**Pre-condition check**:

- Reassess `Docs Impact` after implementation.
- If no canonical docs changed, mark phase `[!]` with reason `skipped: no docs affected`.

**Verification gate**:

- Any changed canonical docs are updated and indexed/routed as required.

---

### Phase 6: AI-ready docs reflection and next-plan handoff _(mandatory closing phase)_

**Progress**: `[ ]`

**Layer**: planning/documentation improvement layer

**Goal**: Convert Stage 1 execution learnings into Stage 2 scheduler/infra rollout plan.

**Files**:

- `ai_oriented_kanban/10-plan/stage-1-mvp-trial-cache.md` — modify — summarize which docs/actions were validated by Phase 0 and carried through implementation
- `ai_oriented_kanban/10-plan/` (new Stage 2 plan file) — create/modify — include implementation-ready next steps grounded in Stage 1 evidence
- Relevant canonical docs under `docs/` — update-plan list only — generate actionable doc tasks with scope, owner, and expected change detail

**Verification gate**:

- New Stage 2 plan exists in `ai_oriented_kanban/10-plan/` and is linked from Stage 1 artifact.
- AI assistants produce a docs action backlog derived from Phase 0 verification outputs, with per-doc change details.

**Sub-subphase checklist**:

- [ ] **6.1 — Generate docs update backlog**: AI assistants enumerate all docs needing updates based on Phase 0 drift/evidence and Stage 1 implementation learnings.
  - **Independent verification**: backlog lists each doc path, why update is needed, and specific sections to modify.
- [ ] **6.2 — Attach actionable doc tasks**: for each doc, define concrete update steps, owner, priority, and done criteria.
  - **Independent verification**: each task includes measurable acceptance criteria and cross-links to evidence.
- [ ] **6.3 — Link docs tasks to next implementation wave**: ensure Stage 2 plan references docs backlog items as prerequisites or parallel tracks.
  - **Independent verification**: Stage 2 plan contains explicit links to generated docs tasks and dependency notes.

---

### Phase 7: Docs-only Simulation Drill _(mandatory closing phase)_

**Progress**: `[ ]`

**Layer**: validation and reproducibility layer

**Goal**: Validate docs-first reproducibility for similar cache-feature rollouts.

**Verification gate**:

- Drill output includes Docs Needed + Decision Evidence + any insufficiency remediation.

---

### Phase 8: Rollout Eval & Health Score _(mandatory closing phase)_

**Progress**: `[ ]`

**Layer**: rollout quality/evaluation layer

**Goal**: Produce a scored Stage 1 readiness report (0–120 rubric) before archive/move.

**Verification gate**:

- Score computed with evidence and pass/fail decision recorded.

## Rollback Plan

- Disable `public_demo_cache_enabled` to hard-stop Stage 1 API surface.
- Revert public trial route registration commit.
- Revert Stage 1 trial service changes without touching scheduler/restriction/registered-cache layers.
- Preserve Firestore trial summary records created during trial runs for audit; do not destructive-reset in rollback.
