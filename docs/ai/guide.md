# Assistant Guide: Task Routing

> **Source of truth**: Canonical docs in `docs/`
> **Last reviewed**: 2026-05-29
> **Owner**: Engineering Team / AI Assistants

## Purpose

This guide routes common assistant tasks to the most relevant canonical documentation. Use this when you start working on a specific feature or bugfix to load the right context documents.

## Docs-First Execution Rule (Required)

For planning and implementation decisions:

1. Use docs specs as the primary source of truth.
2. Use code scanning only as a fallback when docs are missing, ambiguous, or outdated for a specific decision.
3. If fallback code scan is used, record the insufficiency and update the impacted docs in the same rollout whenever possible.

This prevents assistant behavior from depending on implicit tribal knowledge and keeps future docs-only execution reliable.

## Task Routing Map

### 🔌 API Development

**Task: Add a new protected endpoint**
→ Start with: [API Endpoint Conventions](../api/endpoint-conventions.md)
→ Then review: [Response Envelope](../api/response-envelope.md) | [Auth Patterns](../auth/auth-patterns.md) | [Service Catalog](../services/service-catalog.md)

**Task: Modify an existing endpoint's response format**
→ Start with: [Response Envelope](../api/response-envelope.md)
→ Then review: [API Endpoint Conventions](../api/endpoint-conventions.md) | [Repository Map](./repo-map.md) (System Boundaries section)

**Task: Add API versioning or deprecation**
→ Start with: [API Endpoint Conventions](../api/endpoint-conventions.md)
→ Then review: [Deployment Guide](../operations/deployment.md) for rollout strategy

**Task: Handle API errors gracefully**
→ Start with: [Response Envelope](../api/response-envelope.md)
→ Then review: [API Endpoint Conventions](../api/endpoint-conventions.md)

---

### 🗄️ Database & ORM

**Task: Add a Prisma migration**
→ Start with: [Prisma Patterns](../database/prisma-patterns.md)
→ Then review: [Testing Strategy](../testing/strategy.md) (for migration testing) | [Repository Map](./repo-map.md) (Data Storage section)

**Task: Write a type-safe database query**
→ Start with: [Prisma Patterns](../database/prisma-patterns.md)
→ Then review: [Service Catalog](../services/service-catalog.md#prisma-service) | [Repository Map](./repo-map.md) (Type Safety section)

**Task: Optimize a slow database query**
→ Start with: [Prisma Patterns](../database/prisma-patterns.md)
→ Then review: [Redis Patterns](../cache/redis-patterns.md) (to add caching) | [Testing Strategy](../testing/strategy.md) (for query profiling)

**Task: Debug a Prisma type error**
→ Start with: [Repository Map](./repo-map.md) (Type Safety section) | [Prisma Patterns](../database/prisma-patterns.md)

---

### 💾 Caching

**Task: Add a cache layer to an existing query**
→ Start with: [Redis Patterns](../cache/redis-patterns.md)
→ Then review: [Service Catalog](../services/service-catalog.md#redis-service) | [Prisma Patterns](../database/prisma-patterns.md) (for which queries benefit from caching)

**Task: Invalidate cache when a record updates**
→ Start with: [Redis Patterns](../cache/redis-patterns.md)
→ Then review: [Repository Map](./repo-map.md) (Data Consistency section)

**Task: Debug stale or missing cache**
→ Start with: [Redis Patterns](../cache/redis-patterns.md)
→ Then review: [Testing Strategy](../testing/strategy.md) (for cache mocking in tests)

---

### 🔐 Authentication & Authorization

**Task: Understand the auth middleware chain**
→ Start with: [Auth Patterns](../auth/auth-patterns.md)
→ Then follow: [Auth Verification Workflow](../workflow/auth-verification-workflow.md) (step-by-step flow) | [Repository Map](./repo-map.md) (Critical Invariants section)

**Task: Add a new auth-required endpoint**
→ Start with: [Auth Patterns](../auth/auth-patterns.md)
→ Then review: [API Endpoint Conventions](../api/endpoint-conventions.md) | [Auth Verification Workflow](../workflow/auth-verification-workflow.md)

**Task: Debug authentication failure**
→ Start with: [Auth Patterns](../auth/auth-patterns.md)
→ Then review: [Auth Verification Workflow](../workflow/auth-verification-workflow.md) | [Testing Strategy](../testing/strategy.md) (for mocking auth in tests)

**Task: Verify user permissions for a resource**
→ Start with: [Auth Patterns](../auth/auth-patterns.md)
→ Then review: [API Endpoint Conventions](../api/endpoint-conventions.md) (for permission checks in handlers)

---

### 🤖 AI Services & Exam Generation

**Task: Implement exam generation rate-limiting**
→ Start with: [AI Services Conventions](../ai-services/exam-generation.md)
→ Then follow: [Exam Generation Workflow](../workflow/exam-generation-workflow.md) | [Service Catalog](../services/service-catalog.md#examRateLimit-service)

**Task: Add a new Genkit model call**
→ Start with: [AI Services Conventions](../ai-services/exam-generation.md)
→ Then review: [Service Catalog](../services/service-catalog.md#genkit-service) | [Exam Generation Workflow](../workflow/exam-generation-workflow.md)

**Task: Debug an exam generation failure**
→ Start with: [Exam Generation Workflow](../workflow/exam-generation-workflow.md)
→ Then review: [AI Services Conventions](../ai-services/exam-generation.md) | [Testing Strategy](../testing/strategy.md) (for Cloud Tasks local behavior)

**Task: Optimize exam generation cost or latency**
→ Start with: [AI Services Conventions](../ai-services/exam-generation.md)
→ Then review: [Exam Generation Workflow](../workflow/exam-generation-workflow.md) | [Redis Patterns](../cache/redis-patterns.md) (for caching generated data)

---

### 🧩 Services & Architecture

**Task: Find the right service for a task**
→ Start with: [Service Catalog](../services/service-catalog.md)
→ Then review: [Repository Map](./repo-map.md) (Service Layer Boundary section) | The specific service doc (Prisma, Redis, Genkit, etc.)

**Task: Add a new service**
→ Start with: [Service Catalog](../services/service-catalog.md)
→ Then review: [Repository Map](./repo-map.md) (System Boundaries section) | Relevant domain docs (Prisma, Redis, Genkit, etc.)

**Task: Integrate a third-party service (API, SDK)**
→ Start with: [Service Catalog](../services/service-catalog.md)
→ Then review: [Repository Map](./repo-map.md) (System Boundaries section)

---

### 🧪 Testing

**Task: Write a unit test for an API endpoint**
→ Start with: [Testing Strategy](../testing/strategy.md)
→ Then review: [API Endpoint Conventions](../api/endpoint-conventions.md) (for handler signature) | [Auth Patterns](../auth/auth-patterns.md) (for mocking auth)

**Task: Test async behavior (Cloud Tasks, Genkit)**
→ Start with: [Testing Strategy](../testing/strategy.md)
→ Then review: [Repository Map](./repo-map.md) (Cloud Tasks local behavior section) | [Exam Generation Workflow](../workflow/exam-generation-workflow.md)

**Task: Mock Prisma queries in a test**
→ Start with: [Testing Strategy](../testing/strategy.md)
→ Then review: [Prisma Patterns](../database/prisma-patterns.md) (for query shapes)

**Task: Mock Redis in a test**
→ Start with: [Testing Strategy](../testing/strategy.md)
→ Then review: [Redis Patterns](../cache/redis-patterns.md) (for key patterns)

**Task: Improve test coverage**
→ Start with: [Testing Strategy](../testing/strategy.md)
→ Coverage targets section provides guidance on what to prioritize

**Task: Validate assistant retrieval quality**
→ Start with: [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md)
→ Then review: [Assistant Context Index](./assistant-context-index.md) | [Docs Maintenance Protocol](../operations/docs-maintenance.md)

---

### 📘 Docs-First Rollout Governance

**Task: Create a rollout plan with docs-first decisions**
→ Start with: [Spec-First + Kanban Integration Policy](../operations/spec-first-kanban-integration.md)
→ Then review: [Docs Maintenance Protocol](../operations/docs-maintenance.md) | [Rollout Plan Template](../../ai_oriented_kanban/templates/rollout-plan-template.md)

**Task: Verify whether docs are sufficient before implementation**
→ Start with: [Assistant Context Index](./assistant-context-index.md)
→ Then review: [Assistant Guide](./guide.md) | [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md)

**Task: Handle insufficient docs during rollout**
→ Start with: [Docs Maintenance Protocol](../operations/docs-maintenance.md)
→ Then review: [Spec-First + Kanban Integration Policy](../operations/spec-first-kanban-integration.md) | [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md)

**Task: Run a docs-only project simulation drill**
→ Start with: [Project Simulation Readiness](./project-simulation-readiness.md)
→ Then review: [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md) | [Spec-First + Kanban Integration Policy](../operations/spec-first-kanban-integration.md)

**Task: Define simulation cadence and fallback-scan ratio policy**
→ Start with: [Project Simulation Readiness](./project-simulation-readiness.md)
→ Then review: [Docs Maintenance Protocol](../operations/docs-maintenance.md) | [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md)

**Task: Reconcile doc/code divergence found during rollout**
→ Start with: [Docs Maintenance Protocol](../operations/docs-maintenance.md)
→ Then review: [Spec-First + Kanban Integration Policy](../operations/spec-first-kanban-integration.md) | [Project Simulation Readiness](./project-simulation-readiness.md)

---

### 🚀 Operations & Deployment

**Task: Deploy changes to production**
→ Start with: [Deployment Guide](../operations/deployment.md)
→ Then review: [Repository Map](./repo-map.md) (System Boundaries section) if deploying infrastructure changes

**Task: Add an environment variable**
→ Start with: [Deployment Guide](../operations/deployment.md)
→ Then review: GitHub Actions workflows in `.github/workflows/`

**Task: Monitor or debug production logs**
→ Start with: [Deployment Guide](../operations/deployment.md)
→ Then check: Cloud Logging dashboard for specific service logs

**Task: Roll back a broken deployment**
→ Start with: [Deployment Guide](../operations/deployment.md)
→ Rollback procedures section

---

### 📐 Architecture & Design

**Task: Understand the system's overall architecture**
→ Start with: [Repository Map](./repo-map.md)
→ Then review: [Firebase Functions Structure](../architecture/firebase-functions-structure.md) | [Repository Map](./repo-map.md)

**Task: Understand how data flows through the system**
→ Start with: [Repository Map](./repo-map.md) (System Architecture section)
→ Then review: Domain-specific workflow docs ([Exam Generation Workflow](../workflow/exam-generation-workflow.md), [Auth Verification Workflow](../workflow/auth-verification-workflow.md))

**Task: Make an architectural decision**
→ Start with: [Architecture Decision Records](../adr/0001-docs-architecture-mvp.md)
→ Then write: A new ADR following the template

**Task: Resolve a dependency or coupling issue**
→ Start with: [Repository Map](./repo-map.md) (System Boundaries section)
→ Then review: [Service Catalog](../services/service-catalog.md) (for service boundaries)

---

### 🐛 Debugging & Troubleshooting

**Task: Debug a production incident**
→ Start with: [Repository Map](./repo-map.md) (Dangerous Areas section to identify likely culprits)
→ Then review: Specific domain docs (API, Auth, AI Services, etc.) based on incident type

**Task: Find where a bug might be (code location)**
→ Start with: [Repository Map](./repo-map.md) (Project Structure section)
→ Then review: Specific domain docs or workflow docs

**Task: Understand a failing test**
→ Start with: [Testing Strategy](../testing/strategy.md)
→ Then review: The specific domain being tested (API, Prisma, Redis, etc.)

---

## Context Assembly Template

When starting a new task, follow this structure:

1. **Identify your task** above in the routing map and follow the "Start with" link (primary doc)
2. **Read the primary doc** thoroughly (should take 5-15 minutes)
3. **Review secondary docs** listed in "Then review" (each 2-5 minutes as needed)
4. **Cross-reference** using the `## Related Docs` section in each doc if you need more context
5. **Check dangerous areas** in [Repository Map](./repo-map.md) before implementing

This ensures you have the right mental model before writing code.

## Context Limits

For **complex multi-step tasks** (e.g., "refactor exam generation"), start with the list of domain docs involved rather than reading all at once:

- If task involves 3+ domains → review [Assistant Context Index](./assistant-context-index.md) to scope required docs
- Load docs incrementally as you implement each step
- Return to this guide after major changes to verify you're still on track

## AI Retrieval Quality

If an assistant response seems incorrect or incomplete:

1. Check if the right docs were loaded (compare with task routing map above)
2. Check if context limits caused truncation (verify docs loaded completely)
3. If docs are insufficient, record missing/ambiguous docs and propose concrete updates
4. If code scan was used due to insufficiency, update canonical docs so the same decision can be made docs-first next time
5. Open an issue or PR to update the routing map and canonical docs if guidance is missing

---

## Related Docs

- [Repository Map](./repo-map.md) – System boundaries and critical invariants
- [Assistant Context Index](./assistant-context-index.md) – Complete documentation index
- [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md) – QA protocol for verifying good context assembly
- [Project Simulation Readiness](./project-simulation-readiness.md) – docs-only execution readiness rubric
