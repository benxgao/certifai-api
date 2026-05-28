# Assistant Context Index: Complete Documentation Map

> **Source of truth**: Canonical docs in `docs/`
> **Last reviewed**: 2026-05-29
> **Owner**: Engineering Team / AI Assistants

## Purpose

This index provides a machine-friendly list of all canonical documentation files, organized by domain. Use this to locate relevant docs when starting an assistant task. Each entry includes a brief description and the file path.

## Quick Start

1. **New to this codebase?** Start with [Repository Map](./repo-map.md) for system boundaries and critical invariants.
2. **Have a specific task?** Use [Assistant Guide](./guide.md) to route to the right docs.
3. **Need reference material?** Browse this index by domain below.

## Documentation Index by Domain

### 🏗️ Architecture & System Design

| Doc                | Purpose                                                                    | File                                                                                                 |
| ------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **System Context** | High-level overview of certifai-api, system diagram, and boundaries        | [docs/architecture/firebase-functions-structure.md](../architecture/firebase-functions-structure.md) |
| **Repository Map** | System boundaries, critical invariants, and dangerous areas for AI context | [docs/ai/repo-map.md](./repo-map.md)                                                                 |

### 🔌 API & Response Contracts

| Doc                      | Purpose                                                                  | File                                                               |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Endpoint Conventions** | REST naming, versioning, auth, and request/response patterns             | [docs/api/endpoint-conventions.md](../api/endpoint-conventions.md) |
| **Response Envelope**    | Full `ApiResponse<T>` contract, pagination, error codes, success/failure | [docs/api/response-envelope.md](../api/response-envelope.md)       |

### 🗄️ Database & ORM

| Doc                 | Purpose                                                                    | File                                                               |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Prisma Patterns** | Prisma client conventions, migrations, type-safe queries, query guidelines | [docs/database/prisma-patterns.md](../database/prisma-patterns.md) |

### 💾 Caching (Redis)

| Doc                | Purpose                                                                     | File                                                       |
| ------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Redis Patterns** | Redis key naming, TTL strategies, Upstash configuration, invalidation rules | [docs/cache/redis-patterns.md](../cache/redis-patterns.md) |

### 🔐 Authentication & Authorization

| Doc                            | Purpose                                                                         | File                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Auth Patterns**              | Auth invariants, middleware entry points, token shape, `req.user` contract      | [docs/auth/auth-patterns.md](../auth/auth-patterns.md)                                   |
| **Auth Verification Workflow** | Step-by-step: token receipt → authCheck → jwtAuth → verifyUserAccess → req.user | [docs/workflow/auth-verification-workflow.md](../workflow/auth-verification-workflow.md) |

### 🤖 AI Services (Genkit/Vertex AI)

| Doc                          | Purpose                                                                                      | File                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **AI Services Conventions**  | Genkit/Vertex AI invariants: model selection, rate-limiting rules, cost controls             | [docs/ai-services/exam-generation.md](../ai-services/exam-generation.md)             |
| **Exam Generation Workflow** | Step-by-step: request → rate limit check → Cloud Tasks enqueue → Genkit generation → polling | [docs/workflow/exam-generation-workflow.md](../workflow/exam-generation-workflow.md) |

### 🧩 Services Layer

| Doc                 | Purpose                                                                         | File                                                               |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Service Catalog** | Inventory of 20+ services in `functions/src/services/`, usage rules, boundaries | [docs/services/service-catalog.md](../services/service-catalog.md) |

### 🧪 Testing

| Doc                  | Purpose                                                                                | File                                               |
| -------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Testing Strategy** | Unit test patterns, fixture conventions, Cloud Tasks local dev shims, coverage targets | [docs/testing/strategy.md](../testing/strategy.md) |

### 🚀 Operations & Deployment

| Doc                          | Purpose                                                                      | File                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Deployment Guide**         | GitHub Actions workflow, Firebase Functions config, environment variables    | [docs/operations/deployment.md](../operations/deployment.md)                             |
| **Docs Maintenance**         | Layering contract, archive policy, update cadence, quarterly topology review | [docs/operations/docs-maintenance.md](../operations/docs-maintenance.md)                 |
| **AI Retrieval Smoke Tests** | Manual prompt-based QA protocol for verifying key assistant context paths    | [docs/operations/ai-retrieval-smoke-tests.md](../operations/ai-retrieval-smoke-tests.md) |
| **Spec-First Kanban Policy** | Docs-first rollout contract: docs needed, decision evidence, remediation     | [docs/operations/spec-first-kanban-integration.md](../operations/spec-first-kanban-integration.md) |

### 📋 Process & Governance

| Doc                               | Purpose                                 | File                                                                           |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| **Architecture Decision Records** | Formal decisions impacting the codebase | [docs/adr/0001-docs-architecture-mvp.md](../adr/0001-docs-architecture-mvp.md) |

### 📚 Shared Terminology

| Doc                  | Purpose                                                       | File                                               |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| **Product Glossary** | Shared terminology for product, engineering, and AI retrieval | [docs/product/glossary.md](../product/glossary.md) |

### 🧭 AI Documentation Entry Points

| Doc                           | Purpose                                            | File                                                   |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| **Assistant Context Index**   | Canonical map of all docs (this document)          | [docs/ai/assistant-context-index.md](./assistant-context-index.md) |
| **Assistant Guide**           | Task routing for common implementation/debug tasks | [docs/ai/guide.md](./guide.md)                         |
| **Repository Map**            | Boundaries, invariants, and dangerous areas        | [docs/ai/repo-map.md](./repo-map.md)                  |
| **Project Simulation Readiness** | Docs-only planning/execution readiness rubric   | [docs/ai/project-simulation-readiness.md](./project-simulation-readiness.md) |

## Workflows (Multi-Step Procedures)

All step-by-step lifecycle procedures live in `docs/workflow/` to keep invariant docs focused on rules:

| Workflow              | Purpose                                                                  | File                                                                                     |
| --------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Exam Generation**   | Request → rate limit check → Cloud Tasks → Genkit → polling → completion | [docs/workflow/exam-generation-workflow.md](../workflow/exam-generation-workflow.md)     |
| **Auth Verification** | Token arrival → authCheck → jwtAuth → verifyUserAccess → req.user        | [docs/workflow/auth-verification-workflow.md](../workflow/auth-verification-workflow.md) |
| **Workflow Template** | Standard structure and naming convention for new `*-workflow.md` docs    | [docs/workflow/README.md](../workflow/README.md)                                         |

## Section Templates

Each section has a standardized template to ensure consistent structure when adding new docs:

| Section        | Template                                                        | Purpose                                      |
| -------------- | --------------------------------------------------------------- | -------------------------------------------- |
| Product        | [docs/product/\_template.md](../product/_template.md)           | Shared terminology and product-specific docs |
| Architecture   | [docs/architecture/\_template.md](../architecture/_template.md) | System design and structural docs            |
| API            | [docs/api/\_template.md](../api/_template.md)                   | API contracts and endpoint docs              |
| Database       | [docs/database/\_template.md](../database/_template.md)         | Database, ORM, and query docs                |
| Cache          | [docs/cache/\_template.md](../cache/_template.md)               | Caching strategies and Redis docs            |
| Auth           | [docs/auth/\_template.md](../auth/_template.md)                 | Auth and authorization docs                  |
| AI Services    | [docs/ai-services/\_template.md](../ai-services/_template.md)   | AI integration docs                          |
| Services       | [docs/services/\_template.md](../services/_template.md)         | Service layer inventory and patterns         |
| Testing        | [docs/testing/\_template.md](../testing/_template.md)           | Test strategy and patterns                   |
| AI / Assistant | [docs/ai/\_template.md](../ai/_template.md)                     | AI retrieval and context docs                |
| Operations     | [docs/operations/\_template.md](../operations/_template.md)     | Deployment and ops docs                      |
| Workflows      | [docs/workflow/\_template.md](../workflow/_template.md)         | Step-by-step procedure template              |
| ADR            | [docs/adr/\_template.md](../adr/_template.md)                   | Architecture Decision Record template        |

## Finding Docs by Use Case

### Common Assistant Tasks

| Use Case                                      | Primary Doc                                                  | Secondary Docs                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Add a protected `/api/users/profile` endpoint | [API Endpoint Conventions](../api/endpoint-conventions.md)   | [Auth Patterns](../auth/auth-patterns.md), [Response Envelope](../api/response-envelope.md)     |
| Fix a Prisma migration issue                  | [Prisma Patterns](../database/prisma-patterns.md)            | [Testing Strategy](../testing/strategy.md) (for local testing)                                  |
| Implement exam generation rate-limiting       | [AI Services Conventions](../ai-services/exam-generation.md) | [Exam Generation Workflow](../workflow/exam-generation-workflow.md)                             |
| Add a caching layer to a query                | [Redis Patterns](../cache/redis-patterns.md)                 | [Service Catalog](../services/service-catalog.md)                                               |
| Debug an async test failure                   | [Testing Strategy](../testing/strategy.md)                   | [Exam Generation Workflow](../workflow/exam-generation-workflow.md) (for Cloud Tasks behavior)  |
| Understand how users authenticate             | [Auth Patterns](../auth/auth-patterns.md)                    | [Auth Verification Workflow](../workflow/auth-verification-workflow.md) (for step-by-step flow) |
| Add a new service                             | [Service Catalog](../services/service-catalog.md)            | [Repository Map](./repo-map.md) (for boundaries)                                                |
| Deploy changes to production                  | [Deployment Guide](../operations/deployment.md)              | [GitHub workflows](../../.github/workflows/) (source)                                           |
| Create docs-first rollout plan                | [Spec-First Kanban Policy](../operations/spec-first-kanban-integration.md) | [Docs Maintenance](../operations/docs-maintenance.md), [Assistant Guide](./guide.md) |
| Validate docs-only simulation readiness       | [Project Simulation Readiness](./project-simulation-readiness.md) | [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md) |

## Linked Reference Graph

Every canonical doc includes a `## Related Docs` section that cross-links to sibling and dependent docs. This creates a navigable graph. Edges point in both directions:

- **Invariant docs** → **Workflow docs** (e.g., Auth Patterns → Auth Verification Workflow)
- **Specific docs** → **General docs** (e.g., Endpoint Conventions → Response Envelope → API overview)
- **Domain docs** → **Service Catalog** (e.g., Prisma Patterns → Service Catalog for Prisma service location)

Use these links to discover related contexts without returning to this index.

## Discoverability Checklist

A doc is **complete and discoverable** if it satisfies all three:

- [ ] **Indexed**: Registered in this index with a brief description
- [ ] **Routed**: Linked from [Assistant Guide](./guide.md) for at least one use case
- [ ] **Linked**: Has a `## Related Docs` section with backlinks from at least one sibling

Orphan docs (not linked anywhere) are hard to find. If you notice one, open an issue or PR to add missing links.

## Related Docs

- [Repository Map](./repo-map.md) – System boundaries and critical invariants
- [Assistant Guide](./guide.md) – Task-based routing to the right docs
- [AI Retrieval Smoke Tests](../operations/ai-retrieval-smoke-tests.md) – QA protocol for verifying good context assembly
- [Spec-First Kanban Policy](../operations/spec-first-kanban-integration.md) – rollout governance contract
- [Project Simulation Readiness](./project-simulation-readiness.md) – docs-only readiness rubric
