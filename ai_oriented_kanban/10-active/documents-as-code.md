# Rollout: Certifai API AI-Ready Documentation MVP

## Summary

`certifai-api` already has useful architectural docs (`docs/ARCHITECTURE.md`, `docs/architecture/`, `docs/operations/`), but the information is distributed and not optimized for assistant-first retrieval. The immediate goal is to introduce a small, stable, machine-friendly documentation skeleton that AI assistants can use for high-quality context assembly.

This rollout starts with an MVP that prioritizes fast usefulness over full docs-platform setup. We will create a compact layered structure, define a canonical repo map and conventions index, and wire references from Copilot instructions so agents can locate project overview, constraints, and rules with minimal prompt overhead.

## Current Evaluation

### What already exists

- Root-level architecture overview in `docs/ARCHITECTURE.md` and `docs/FEATURES.md`.
- Deep architecture docs in `docs/architecture/` (adaptive exam generation, database design, redis cache, knowledge pooling, prisma conventions).
- Operations docs in `docs/operations/prisma-migrate.md`.
- Feature planning docs in `docs/plans/` and `functions/src/docs/`.
- Compliance reports in `docs/compliance/`.
- Copilot instructions at `.github/instructions/instruction.instructions.md`.

### What is not centralized / stable / complete yet

#### 1. AI-retrieval context is fragmented

- Overview, service patterns, auth conventions, type safety rules, and testing guidance are spread across multiple locations with no canonical index.
- Copilot instructions define behavior rules but do not point to a machine-friendly repo map and doc index.

Representative files:

- `.github/instructions/instruction.instructions.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `functions/src/types/` — types not linked to API contract docs

#### 2. No canonical service-layer and endpoint convention docs

- No central reference for `ApiResponse<T>` envelope conventions.
- No documented patterns for the auth middleware chain (`authCheck.ts`, `jwtAuth.ts`, `verifyUserAccess.ts`).
- No formal conventions guide for Prisma service usage, Redis caching, or Genkit/Vertex AI integration.

Representative files:

- `functions/src/endpoints/api/` — routes undocumented beyond inline comments
- `functions/src/services/` — service patterns not described for onboarding
- `functions/src/middlewares/` — middleware chain not documented for AI context

#### 3. Service catalog and types inventory are absent

- `functions/src/services/` has 20+ subdirectories (genkit, redis, prisma, cloudTasks, jwt, resend, etc.) with no catalog doc.
- No guidance on which service to call for a given task, or what pattern to follow when adding a new service.
- `functions/src/types/` contains enums, errors, and express extensions but these are not linked to any API contract docs.

Representative files:

- `functions/src/services/` (20+ subdirectories: genkit, redis, prisma, cloudTasks, cache, jwt, resend, monitoring, performance, etc.)
- `functions/src/types/enums.ts`, `errors.ts`, `express.ts`, `api/`

#### 4. No canonical workflow docs for multi-step procedures

- The exam generation lifecycle (request → Cloud Tasks enqueue → generation → polling → completion) is a complex multi-step domain with no single workflow doc.
- The auth verification chain (token receipt → `authCheck` → `jwtAuth` → `verifyUserAccess` → `req.user`) is documented only through inline middleware comments.
- Placing step-by-step procedures inside invariant domain docs (e.g. auth/api/ai-services) conflates stable rules with changeable sequencing — a pitfall that caused drift in a related project.

Representative files:

- `functions/src/services/cloudTasks/`, `functions/src/services/genkit/` — generation pipeline undocumented as a lifecycle
- `functions/src/middlewares/authCheck.ts`, `jwtAuth.ts`, `verifyUserAccess.ts` — chain undocumented end-to-end

#### 5. No explicit MVP documentation contract for phased growth

- No clear "MVP now, hardening later" structure with ownership and verification gates.
- Documentation changes are not consistently tied to PR-level impact checks.

### Risks in the current state

- [ ] AI assistants pull incomplete context, producing inconsistent code and type-safety violations.
- [ ] AI assistants add Cloud Tasks calls without understanding the local dev shim behavior (tasks execute immediately locally but async in production).
- [ ] AI assistants bypass the service layer and use the Prisma client directly, violating the service boundary rule.
- [ ] Auth middleware chain is misunderstood, leading to public-endpoint security regressions.
- [ ] Onboarding quality varies by which architecture doc a contributor reads first.
- [ ] Documentation drift increases as features evolve without a clear source hierarchy.
- [ ] Docs graph is not enforced — dead links possible, orphan docs exist with no `## Related Docs` section, making them unreachable from doc-to-doc traversal.

## Scope

- Estimated files to create: ~35 (13 section templates + domain docs + AI/ops/ADR/workflow files)
- Estimated files to modify: 2
- Risk level: Low

### In scope

Thirteen documentation domains, each with a `_template.md` so AI assistants can add new domain files consistently:

| #   | Domain           | Scope                                                                                       |
| --- | ---------------- | ------------------------------------------------------------------------------------------- |
| 02  | **Architecture** | Firebase Functions structure, Express.js routing, module boundaries, system context         |
| 04  | **API**          | `ApiResponse<T>` envelope, endpoint naming, request/response shapes, error handling         |
| 05  | **Database**     | Prisma schema conventions, migration patterns, query guidelines, PostgreSQL rules           |
| 06  | **Cache**        | Redis caching patterns, TTL strategies, Upstash configuration, invalidation rules           |
| 07  | **Auth**         | Firebase Auth entry points, JWT verification chain invariants — NOT step-by-step procedures |
| 08  | **AI Services**  | Genkit/Vertex AI conventions and rate-limiting rules — NOT generation lifecycle procedures  |
| 09  | **Services**     | Service layer conventions, catalog, Prisma/Redis/Resend/Stripe/GCP integration rules        |
| 10  | **Testing**      | Unit tests (`__tests__/`), fixture patterns, coverage targets, Cloud Tasks local behavior   |
| 11  | **AI**           | Repo map, assistant context index, guide (task routing), invariants, dangerous areas        |
| 03  | **ADR**          | Architecture decision record template and log                                               |
| 01  | **Product**      | Shared terminology for product, engineering, and AI retrieval                               |
| 12  | **Operations**   | Deployment, Firebase Functions config, Cloud Tasks, environment setup                       |
| 13  | **Workflow**     | Step-by-step lifecycle procedures separated from invariant domain docs                      |

Also in scope:

- `_template.md` in every section directory — ensures AI and humans follow consistent structure when adding new domain files.
- `docs/workflow/README.md` — naming and placement convention for all lifecycle/procedure docs.
- Link canonical docs from `.github/instructions/instruction.instructions.md` and `README.md`.
- Lightweight PR docs-impact checklist with new-doc registration requirements.
- AI retrieval smoke-test protocol (`docs/operations/ai-retrieval-smoke-tests.md`).
- Quarterly topology review cadence in `docs/operations/docs-maintenance.md`.

### Out of scope

- Full MkDocs/Docusaurus deployment.
- Automated OpenAPI/Prisma doc generation pipelines.
- Search infrastructure and analytics.
- `docs/plans/` feature planning docs — independent planning artifacts, not part of the doc structure.

## Minimum Viable Hotfix

- Phase 1 + Phase 2 are the MVP hotfix path.
- These phases are safe/minimal because they only add documentation structure and instruction links, with no runtime code or API behavior changes.

## Context Map

### Files to modify first

| File                                               | Purpose                                       | Why it matters                                          |
| -------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `.github/instructions/instruction.instructions.md` | Add canonical documentation reference section | Makes assistant context loading consistent and explicit |
| `README.md`                                        | Add short "Documentation Map" section         | Gives contributors and AI a single jumping-off point    |

### Likely files to create

| File                                                | Purpose                                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `docs/ai/repo-map.md`                               | Canonical system boundary, critical invariants, and dangerous areas                    |
| `docs/ai/assistant-context-index.md`                | Fast index of where to find architecture, auth, database, and service patterns         |
| `docs/ai/guide.md`                                  | Task-routing guide: which doc to load for which assistant task                         |
| `docs/architecture/system-context.md`               | Human/AI readable high-level architecture for `certifai-api`                           |
| `docs/architecture/firebase-functions-structure.md` | Functions entry point, route organization, middleware chain, Express.js patterns       |
| `docs/api/endpoint-conventions.md`                  | REST naming, versioning, `ApiResponse<T>` envelope, HTTP status codes                  |
| `docs/api/response-envelope.md`                     | `ApiResponse<T>` shape, pagination `meta`, error codes, success/failure contract       |
| `docs/database/prisma-patterns.md`                  | Prisma client usage, migration workflow, query conventions, safe `any`-free type usage |
| `docs/cache/redis-patterns.md`                      | Redis keys, TTL conventions, Upstash setup, cache invalidation rules                   |
| `docs/auth/auth-patterns.md`                        | Auth invariants: middleware chain entry points, token shape, `req.user` contract       |
| `docs/ai-services/exam-generation.md`               | Genkit/Vertex AI conventions, rate-limiting rules — invariants only                    |
| `docs/services/service-catalog.md`                  | Inventory of all services in `functions/src/services/`, usage rules, boundaries        |
| `docs/workflow/README.md`                           | Naming and placement convention for all `*-workflow.md` lifecycle procedure docs       |
| `docs/workflow/exam-generation-workflow.md`         | Full lifecycle: request → Cloud Tasks → Genkit generation → polling → completion       |
| `docs/workflow/auth-verification-workflow.md`       | Full chain: token receipt → `authCheck` → `jwtAuth` → `verifyUserAccess` → `req.user`  |
| `docs/testing/strategy.md`                          | Unit test patterns, fixture conventions, Cloud Tasks local dev shims, coverage targets |
| `docs/adr/0001-docs-architecture-mvp.md`            | Record why this docs structure was adopted                                             |
| `docs/operations/deployment.md`                     | GitHub Actions deploy workflow, Firebase Functions config, environment variables       |
| `docs/operations/ai-retrieval-smoke-tests.md`       | Manual prompt-based retrieval QA protocol for key assistant tasks                      |
| `.github/pull_request_template.md`                  | Docs impact assessment + new-doc registration checkboxes                               |
| `docs/product/glossary.md`                          | Shared terminology for product + engineering + AI retrieval                            |

### Dependencies / related patterns

| File                                 | Relationship                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `docs/ARCHITECTURE.md`               | Source for system context referenced in `docs/architecture/system-context.md`                    |
| `docs/architecture/`                 | Source for deep architecture docs; canonical domain docs link back to these                      |
| `functions/src/endpoints/api/`       | Source-of-truth for endpoint conventions documented in `docs/api/`                               |
| `functions/src/services/prisma/`     | Source-of-truth for Prisma service patterns in `docs/database/prisma-patterns.md`                |
| `functions/src/services/redis/`      | Source-of-truth for Redis patterns in `docs/cache/redis-patterns.md`                             |
| `functions/src/middlewares/`         | Source-of-truth for auth **invariants** in `docs/auth/auth-patterns.md`                          |
| `functions/src/middlewares/`         | Source-of-truth for auth **lifecycle** in `docs/workflow/auth-verification-workflow.md`          |
| `functions/src/services/genkit/`     | Source-of-truth for AI generation **conventions** in `docs/ai-services/exam-generation.md`       |
| `functions/src/services/cloudTasks/` | Source-of-truth for exam generation **lifecycle** in `docs/workflow/exam-generation-workflow.md` |
| `functions/src/types/`               | Source-of-truth for type conventions referenced by API and Database docs                         |
| `functions/__tests__/`               | Source-of-truth for testing strategy sections                                                    |
| `.github/workflows/`                 | Source-of-truth for deployment docs in `docs/operations/deployment.md`                           |

### Risks

- [ ] Over-documenting too early and losing momentum.
- [ ] Introducing duplicate guidance that conflicts with existing `docs/architecture/` content.
- [ ] Mixing step-by-step workflow procedures into invariant domain docs (repeat of drift pattern observed in `certifai-app`).
- [ ] Dead links accumulating after migrations if no link audit is enforced.

## Recommended Architecture

### Principle 1: AI-first entrypoint, human-friendly depth

Create one canonical AI index (`docs/ai/assistant-context-index.md`) that points to deeper docs, rather than duplicating long-form content.

### Principle 2: Layered growth with strict SSOT boundaries

Use a numbered 12-section layout covering all domains but only populate one high-value MVP file per section first. Every document must declare its source-of-truth (code path, config, or policy file).

### Principle 3: Template-enforced consistency

Each section directory contains a `_template.md` that defines the required headings, metadata fields, and SSOT declaration for that domain. When AI assistants or contributors add new files, they must copy and fill the section's `_template.md`. This prevents free-form drift and makes new docs machine-retrievable by consistent heading patterns.

Template anatomy (all sections share this skeleton, with domain-specific heading sets):

```markdown
# <Title>

> **Source of truth**: `<path/to/source/file.ts>`
> **Last reviewed**: YYYY-MM-DD
> **Owner**: <team or role>

## Purpose

## Key Concepts

## Conventions / Rules

## Examples

## Dangerous Areas / Anti-patterns

## Related Docs
```

### Principle 4: Layered docs contract — invariants vs. workflows

Domain docs (e.g. `docs/auth/`, `docs/api/`, `docs/ai-services/`) hold **invariants and guardrails only**: rules that change rarely and apply to all code in that domain. Step-by-step lifecycle procedures go in `docs/workflow/` under a `*-workflow.md` file. This prevents invariant docs from growing into mixed-concern documents that are hard to maintain as procedures change.

| Layer     | Location                      | Content type                                             |
| --------- | ----------------------------- | -------------------------------------------------------- |
| Invariant | `docs/<domain>/*.md`          | Rules, constraints, type contracts, entry points         |
| Procedure | `docs/workflow/*-workflow.md` | Lifecycle sequencing, state transitions, troubleshooting |

Consequence: never put a numbered step sequence like "1. Call `authCheck`, 2. Call `jwtAuth`..." inside `docs/auth/auth-patterns.md`. Write it in `docs/workflow/auth-verification-workflow.md` and link from the invariant doc.

### Principle 5: Index-first discoverability and graph-network linking

A doc is **not complete** until it is:

1. Registered in `docs/ai/assistant-context-index.md` (makes it findable from the AI entrypoint).
2. Routable from `docs/ai/guide.md` (maps assistant tasks to the correct doc).
3. Cross-linked to at least one sibling doc via a `## Related Docs` section (prevents isolated islands).

Every relative link inside `docs/` must point to a real file. A quarterly link-audit and topology review (see Phase 3) enforces this with a `find`/`grep` check.

## Dependency Rule

> **Each phase must touch exactly one dependency layer unless the user explicitly asks for a looser plan.**

Dependency chain for this rollout:

1. Docs structure and AI docs (`docs/`)
2. Instruction references (`.github/instructions/instruction.instructions.md`, `README.md`)
3. Governance checks (`.github/pull_request_template.md`, operations docs)

## Phase Sequencing Rule

> **Default sequencing: root-cause fix → data recovery/backfill → contract hardening → UX/message polish → tests.**

Adapted for documentation rollout:

1. Root-cause fix = fragmented AI context (create canonical docs)
2. Contract hardening = ensure instructions and README link to canonical docs
3. Governance/testing = PR checklist + doc freshness checks

## Commit Slicing Rule

> **A phase may be split into sub-subphases when the file count, review surface, or QA burden is too large for one safe commit.**

### Rules for sub-subphases

- Each sub-subphase should be independently reviewable and revertible.
- Each sub-subphase should end with a local verification step.
- If a missing prerequisite appears, add or revise an earlier-layer sub-subphase instead of patching around it downstream.
- Do not split a phase in a way that creates temporary broken links between docs and references.

## Progress Markers

- `[ ]` — not started
- `[~]` — in progress
- `[x]` — completed and verified
- `[!]` — blocked

## Progress Dashboard

- [ ] Phase 1 — Establish AI docs skeleton (1.1–1.9)
- [ ] Phase 2 — Wire canonical links in instructions and README
- [ ] Phase 3 — Add governance, smoke-tests, and freshness checks

## Phases

### Phase 1: Establish AI docs skeleton

**Progress**: `[ ]`

**Layer**: `docs/` content layer

**Goal**: Create the minimum documentation set that lets assistants quickly understand project overview, boundaries, service patterns, auth chain, and testing strategy.

**Files** — section templates (commit 1 of Phase 1):

- `docs/product/_template.md` — create
- `docs/architecture/_template.md` — create
- `docs/adr/_template.md` — create (MADR-format skeleton)
- `docs/api/_template.md` — create
- `docs/database/_template.md` — create
- `docs/cache/_template.md` — create
- `docs/auth/_template.md` — create
- `docs/ai-services/_template.md` — create
- `docs/services/_template.md` — create
- `docs/testing/_template.md` — create
- `docs/ai/_template.md` — create
- `docs/operations/_template.md` — create
- `docs/workflow/_template.md` — create

**Files** — MVP domain docs (commits 2–9 of Phase 1, one commit per sub-subphase 1.2–1.9):

| Sub-subphase | File                                                | Content                                                                        |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1.2          | `docs/ai/repo-map.md`                               | System boundary, entrypoints, invariants, dangerous areas                      |
| 1.2          | `docs/ai/assistant-context-index.md`                | Fast retrieval index of all canonical docs                                     |
| 1.2          | `docs/ai/guide.md`                                  | Task-routing guide: which doc to load for which assistant task                 |
| 1.3          | `docs/product/glossary.md`                          | Shared terminology for product, engineering, and AI                            |
| 1.3          | `docs/adr/0001-docs-architecture-mvp.md`            | Decision record: why this docs structure was adopted                           |
| 1.4          | `docs/architecture/firebase-functions-structure.md` | Entry point, route registration, middleware chain, Express.js conventions      |
| 1.5          | `docs/api/endpoint-conventions.md`                  | REST naming, `ApiResponse<T>` envelope, HTTP status codes                      |
| 1.5          | `docs/api/response-envelope.md`                     | Full `ApiResponse<T>` contract, pagination `meta`, error codes                 |
| 1.6          | `docs/database/prisma-patterns.md`                  | Prisma client conventions, migration workflow, type-safe queries               |
| 1.6          | `docs/cache/redis-patterns.md`                      | Redis key naming, TTL rules, Upstash config, invalidation                      |
| 1.7          | `docs/auth/auth-patterns.md`                        | Auth **invariants**: middleware entry points, token shape, `req.user` contract |
| 1.7          | `docs/ai-services/exam-generation.md`               | Genkit/Vertex AI **invariants**: conventions and rate-limiting rules           |
| 1.7          | `docs/services/service-catalog.md`                  | Inventory of all services, usage rules, which to call for what                 |
| 1.8          | `docs/workflow/README.md`                           | Naming and placement convention for all `*-workflow.md` docs                   |
| 1.8          | `docs/workflow/exam-generation-workflow.md`         | Request → Cloud Tasks → Genkit → polling → completion lifecycle                |
| 1.8          | `docs/workflow/auth-verification-workflow.md`       | Token receipt → `authCheck` → `jwtAuth` → `verifyUserAccess` → `req.user`      |
| 1.9          | `docs/testing/strategy.md`                          | Unit test patterns, Cloud Tasks local shims, coverage targets                  |
| 1.9          | `docs/operations/deployment.md`                     | GitHub Actions workflow, Firebase config, environment variables                |

**Verification gate** (must pass before Phase 2 starts):

- All section `_template.md` files exist: `ls docs/*/_template.md` shows 13 files.
- All domain docs exist and cross-links resolve (manual link pass in editor preview).
- `grep -r "TODO" docs/` returns no unresolved placeholder content.
- Every domain doc contains a `Source of truth:` field: `grep -rl "Source of truth" docs/` shows one match per domain doc.
- Every domain doc has a `## Related Docs` section: no orphan docs without outbound links.
- All docs in Phase 1 are registered in `docs/ai/assistant-context-index.md` before the phase closes.

**Sub-subphase checklist**:

- [ ] **1.1 — All `_template.md` files**: create 13 section templates with the standard skeleton and domain-specific heading notes. No real content — structure only.
  - **Files**: `docs/{product,architecture,adr,api,database,cache,auth,ai-services,services,testing,ai,operations,workflow}/_template.md`
  - **Independent verification**: `ls docs/*/_template.md | wc -l` outputs `13`; all render in Markdown preview.

- [ ] **1.2 — AI context docs**: author `docs/ai/repo-map.md`, `docs/ai/assistant-context-index.md`, and `docs/ai/guide.md` from live repo inspection.
  - **Files**: `docs/ai/repo-map.md`, `docs/ai/assistant-context-index.md`, `docs/ai/guide.md`
  - **Independent verification**: manual QA prompt "summarize certifai-api boundaries" yields answer grounded in repo map only; no invented details. `guide.md` maps at least 5 common assistant tasks to specific docs.

- [ ] **1.3 — Product and ADR docs**: author glossary and first decision record.
  - **Files**: `docs/product/glossary.md`, `docs/adr/0001-docs-architecture-mvp.md`
  - **Independent verification**: glossary covers all terms used in `docs/ARCHITECTURE.md` and `docs/ai/`; ADR status is `Accepted`.

- [ ] **1.4 — Architecture docs**: document Firebase Functions structure and Express.js routing from `functions/src/`.
  - **Files**: `docs/architecture/firebase-functions-structure.md`
  - **Independent verification**: `grep -r "router\|app\.use\|endpoint" functions/src/endpoints/ | head -10` matches at least 3 conventions in the doc.

- [ ] **1.5 — API docs**: document `ApiResponse<T>` envelope and endpoint conventions from `functions/src/endpoints/api/` and `functions/src/types/`.
  - **Files**: `docs/api/endpoint-conventions.md`, `docs/api/response-envelope.md`
  - **Independent verification**: `grep -r "ApiResponse\|success.*boolean\|data.*T" functions/src/types/ | head -20` matches all patterns documented; nothing invented.

- [ ] **1.6 — Database and Cache docs**: document Prisma service patterns and Redis caching conventions.
  - **Files**: `docs/database/prisma-patterns.md`, `docs/cache/redis-patterns.md`
  - **Independent verification**: `docs/database/prisma-patterns.md` references `functions/src/services/prisma/`; `docs/cache/redis-patterns.md` references at least one real key pattern from `functions/src/services/redis/`.

- [ ] **1.7 — Auth, AI Services, and Services docs**: document auth **invariants** from `functions/src/middlewares/`, generation **conventions** from `functions/src/services/genkit/`, and service catalog from `functions/src/services/`.
  - **Files**: `docs/auth/auth-patterns.md`, `docs/ai-services/exam-generation.md`, `docs/services/service-catalog.md`
  - **Important**: `docs/auth/auth-patterns.md` must contain invariants ONLY — no step-by-step middleware call sequence (that goes in `docs/workflow/auth-verification-workflow.md`).
  - **Independent verification**: `docs/auth/auth-patterns.md` references `authCheck.ts` and `jwtAuth.ts` entry points; `docs/ai-services/exam-generation.md` references `functions/src/services/genkit/`; `docs/services/service-catalog.md` lists at least 8 services matching `ls functions/src/services/`.

- [ ] **1.8 — Workflow docs**: author the two key lifecycle procedure docs and the workflow README.
  - **Files**: `docs/workflow/README.md`, `docs/workflow/exam-generation-workflow.md`, `docs/workflow/auth-verification-workflow.md`
  - **Important**: workflow docs contain numbered step sequences and state transitions. Domain docs must link to these rather than embed procedures inline.
  - **Independent verification**: `docs/workflow/exam-generation-workflow.md` traces lifecycle from `POST /exams/generate` through Cloud Tasks queue to completion; `grep -r "exam-generation-workflow\|auth-verification-workflow" docs/` shows backlinks from at least the relevant auth and ai-services docs.

- [ ] **1.9 — Testing and Operations docs**: document test patterns from `functions/__tests__/` and deployment from `.github/workflows/`.
  - **Files**: `docs/testing/strategy.md`, `docs/operations/deployment.md`
  - **Independent verification**: `docs/testing/strategy.md` cites actual test file patterns matching `grep -r "describe\|it(" functions/__tests__/`; `docs/operations/deployment.md` references actual workflow file names.

---

### Phase 2: Wire canonical links in instructions and README

**Progress**: `[ ]`

**Layer**: instruction and onboarding layer

**Goal**: Ensure assistants and humans are guided to the same canonical docs.

**Files**:

- `.github/instructions/instruction.instructions.md` — modify — add "Canonical Documentation References" section with links to `docs/ai/repo-map.md`, `docs/ai/assistant-context-index.md`, and `docs/ai/guide.md`.
- `README.md` — modify — add concise "Documentation Map" and AI docs links.

**Verification gate** (must pass before Phase 3 starts):

- Both files link to `docs/ai/repo-map.md`, `docs/ai/assistant-context-index.md`, and `docs/ai/guide.md`.
- Link targets exist and open correctly in editor.
- No conflicting guidance introduced relative to existing instruction rules.

**Sub-subphase checklist**:

- [ ] **2.1 — Add instruction references**: append deterministic doc pointers for AI assistants.
  - **Independent verification**: manual read-through confirms no conflicting guidance with existing instruction rules.
- [ ] **2.2 — Add README map**: provide short map without duplicating full content.
  - **Independent verification**: README remains concise and points to canonical docs.

---

### Phase 3: Add governance and freshness checks

**Progress**: `[ ]`

**Layer**: process/governance layer

**Goal**: Prevent drift by making docs impact explicit in review workflow, enforcing discoverability standards, and establishing a retrieval quality baseline.

**Files**:

- `.github/pull_request_template.md` — create — add docs impact assessment block and new-doc registration requirements.
- `docs/operations/docs-maintenance.md` — create — docs layering contract, archive retirement policy, update cadence, freshness SLA, quarterly topology review.
- `docs/operations/ai-retrieval-smoke-tests.md` — create — manual prompt-based retrieval QA protocol for key assistant tasks.

**Verification gate**:

- PR template includes docs-impact checkboxes AND new-doc registration checklist (index + guide + metadata + Related Docs).
- `docs-maintenance.md` includes layering contract, archive retirement policy, update cadence, and quarterly topology review procedure.
- `ai-retrieval-smoke-tests.md` includes at least 5 representative prompts covering auth, exam generation, database, API envelope, and Cloud Tasks behavior.

**Sub-subphase checklist**:

- [ ] **3.1 — Introduce PR checklist**: codify when docs updates are required, including new-doc registration requirements.
  - **New-doc registration gate**: a new doc is not merge-ready unless `docs/ai/assistant-context-index.md` and `docs/ai/guide.md` are updated and the doc has a `## Related Docs` section.
  - **Independent verification**: open a PR draft and confirm checklist appears.

- [ ] **3.2 — Define maintenance protocol**: document the docs layering contract, archive retirement policy, and monthly freshness review process.
  - **Layering contract**: add explicit rule that procedures go in `docs/workflow/` and invariants stay in domain docs. PRs adding step-by-step sequences to non-workflow domain docs require an explicit reviewer sign-off.
  - **Archive retirement policy**: `docs/plans/` planning docs are independent artifacts — never the canonical source for live patterns. Any rule found only in a plans doc must be migrated to its domain doc before the plans doc is trusted as reference.
  - **Independent verification**: protocol can be executed by any maintainer without additional tribal knowledge.

- [ ] **3.3 — AI retrieval smoke-test protocol**: create manual QA prompts that verify key assistant context paths.
  - **Covered tasks**: (1) "add a new protected endpoint", (2) "implement exam generation rate limiting", (3) "add a Redis-cached query", (4) "debug a Cloud Tasks local dev issue", (5) "add a Prisma migration safely".
  - **Independent verification**: each prompt answered correctly by assistant using only linked canonical docs; no invented details.

## Dependency Graph

```text
docs content skeleton (Phase 1)
  ↓
instruction + README linking (Phase 2)
  ↓
governance, smoke-tests, and freshness policy (Phase 3)
```

## Suggested Implementation Order

1. Phase 1.1 → Phase 1.2 → Phase 1.3 → ... → Phase 1.9
2. Phase 2.1 → Phase 2.2
3. Phase 3.1 → Phase 3.2 → Phase 3.3

If any gap is found in Phase 2/3, add it back to Phase 1 docs content rather than duplicating information in instruction/governance files.

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

- Use machine-readable section headers in AI docs (e.g., `## System Boundary`, `## Critical Invariants`, `## Dangerous Areas`).
- Keep Copilot instructions short; they should point to canonical docs, not restate them.
- For any rule duplicated across docs, keep one canonical owner file and link from others.
- Extend existing `docs/architecture/` docs with cross-links rather than duplicating; new docs should reference them.
- **Layering rule**: invariant docs hold rules and type contracts; `docs/workflow/*-workflow.md` docs hold numbered lifecycle steps and state-transition tables. Mixing them was the main drift source observed in `certifai-app`.
- **Index-first**: a doc that is not indexed is invisible to assistants. Always update `docs/ai/assistant-context-index.md` and `docs/ai/guide.md` in the same commit as the new doc.
- **No orphan docs**: every doc must have a `## Related Docs` section with at least one outbound link to a sibling doc in the same or adjacent domain.
- If future DB schema or infra docs are added, define SSOT and generation method in `docs/operations/docs-maintenance.md`.

## Success Criteria

- AI assistants can answer "project overview + service patterns + auth chain + endpoint conventions" using only canonical docs links — verified by smoke tests in Phase 3.3.
- "Procedure vs. invariant" is unambiguous: no numbered step sequences live inside domain docs; all procedures resolve to a `docs/workflow/*-workflow.md` file.
- Every doc in `docs/` is reachable from `docs/ai/assistant-context-index.md` and has a `## Related Docs` outbound link.
- New contributors can locate architecture/auth/database/testing references within 5 minutes.
- Documentation updates become reviewable via explicit PR checklist impact markers and new-doc registration gate.

## Rollback Plan

1. Revert Phase 3 governance changes if checklist/process introduces review friction.
2. Revert Phase 2 link changes if they conflict with existing instruction rules.
3. Keep Phase 1 docs as non-invasive reference assets; archive under `docs/` if partial rollback is needed.

## Resolved Decisions

1. **ADR numbering scope**: Local per repo. `certifai-api` ADRs are numbered independently (e.g., `0001-...`). `certifai-app` maintains its own ADR sequence when that repo adopts the same structure.

2. **AI docs index structure**: Single file (`docs/ai/assistant-context-index.md`) for now, supported by a task-routing `docs/ai/guide.md`. Split into "overview" and "retrieval map" only if the file grows too large or sections benefit from independent retrieval.

3. **Copilot instructions style**: Concise with links only — no inline summaries. All details live in canonical docs. A "Key Points" section can be added to canonical docs if common questions arise.

4. **Existing architecture docs**: Do not replace or move `docs/architecture/*.md` — these are already high-quality deep-dives. New domain docs should link to them and declare SSOT pointers.

5. **Workflow doc placement**: All step-by-step lifecycle procedures go in `docs/workflow/` under a `*-workflow.md` filename. Domain docs (e.g. `docs/auth/`, `docs/ai-services/`) hold invariants only — no numbered steps. This is the most critical structural lesson from the `certifai-app` rollout.

6. **Archive retirement policy**: `docs/plans/` planning docs are independent forward-looking artifacts and are never treated as the canonical source for live conventions. Any rule found only there must be migrated to its domain doc before being used as a reference. No new pattern guidance should be added to `docs/plans/`.

7. **New-doc registration gate**: A doc is not complete until it is registered in both `docs/ai/assistant-context-index.md` and `docs/ai/guide.md`, and has a `## Related Docs` section. This gate is enforced by the PR checklist introduced in Phase 3.1.

## Recommendation

Execute Phase 1 and Phase 2 immediately as the safest MVP path: they deliver the highest AI-context value with minimal operational risk and zero runtime impact. Treat Phase 3 as the stabilization step that prevents drift once the new structure proves useful in active development.
