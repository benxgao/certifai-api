# ADR 0001: Documentation Architecture MVP

**Status**: Accepted

**Date**: 2026-05-26

**Author**: Engineering Team

## Context

The certifai-api codebase had useful but fragmented documentation distributed across `docs/ARCHITECTURE.md`, `docs/architecture/`, `docs/operations/`, `.github/instructions/`, and inline comments. This fragmentation made it difficult for:

1. AI assistants to reliably locate and load the right context for code generation tasks
2. Human contributors to find canonical documentation for a given domain
3. The team to enforce consistent conventions and prevent documentation drift
4. New team members to efficiently onboard by reading a single source of truth

Additionally, there was no clear separation between:
- **Invariant docs** (rules that change rarely): auth patterns, database conventions, API contracts
- **Workflow docs** (step-by-step procedures that change often): exam generation lifecycle, auth verification flow

This coupling made both types harder to maintain and update independently.

## Decision

Implement a layered documentation structure with 13 canonical domains, each with a `_template.md` template file to ensure consistency:

### Structure

1. **AI Retrieval Layer** (`docs/ai/`)
   - `repo-map.md` – System boundaries, critical invariants, dangerous areas
   - `assistant-context-index.md` – Machine-friendly index of all canonical docs
   - `guide.md` – Task routing map

2. **Domain Invariant Docs** (one per domain in `docs/<domain>/`)
   - `docs/product/` – Shared terminology and glossary
   - `docs/architecture/` – System design and boundaries
   - `docs/api/` – API contracts and endpoint conventions
   - `docs/database/` – Database and ORM patterns
   - `docs/cache/` – Caching strategies
   - `docs/auth/` – Authentication and authorization invariants
   - `docs/ai-services/` – AI integration invariants (NOT workflows)
   - `docs/services/` – Service layer catalog and boundaries
   - `docs/testing/` – Test patterns and coverage targets
   - `docs/operations/` – Deployment and operations

3. **Workflow Docs** (`docs/workflow/`)
   - Separated from invariant docs to prevent mixing stable rules with changeable procedures
   - Examples: `exam-generation-workflow.md`, `auth-verification-workflow.md`

4. **ADR Docs** (`docs/adr/`)
   - Architecture decision records using MADR format

### Key Principles

- **AI-first, human-friendly**: Every doc has a `Source of truth` field linking to source code
- **Template-enforced consistency**: Each section has a `_template.md` defining required headings
- **Index-driven discoverability**: Docs are registered in `assistant-context-index.md` and routed through `guide.md`
- **Cross-linked graph**: Every doc includes `## Related Docs` creating a navigable knowledge graph
- **Layered growth**: Start with MVP (13 templates + 20 core docs), expand incrementally per domain

## Rationale

### Why Layered Docs?

Separating invariants (rarely change) from workflows (change frequently) because:
- Invariant readers only need to know "what rules apply"
- Workflow readers need to know "what happens when"
- Mixing them causes maintenance burden: changing a procedure updates the file, but readers looking for rules have to skip procedure text

### Why AI-First Design?

AI assistants are now a significant contributor class:
- They need machine-friendly indexes and routing maps
- They benefit from explicit `Source of truth` links (reduces hallucination)
- They should load the minimum necessary context (prevents token overflow)

### Why Section Templates?

Templates ensure:
- New docs follow the same structure (machine-readable headings)
- Team members know what's expected when contributing
- AI assistants can parse docs with consistent heading patterns
- Growing documentation set remains navigable

## Consequences

### Positive

1. **AI assistants get consistent, structured context** – No more hallucinated details or missed invariants
2. **New contributors onboard faster** – Canonical docs provide clear mental model of system
3. **Documentation maintenance is simplified** – Templates and routing maps make it clear where to add/update content
4. **Procedures stay in sync with invariants** – Separated layers prevent drift between rules and step-by-step docs
5. **Documentation graph is enforced** – Backlinks and `## Related Docs` sections prevent orphan docs

### Negative

1. **Initial effort required** – Creating 13 templates + 20 core MVP docs takes time
2. **Team training needed** – Contributors need to learn section structure and discoverability rules
3. **Review overhead** – New docs require registration in index and routing map before merge
4. **Living document maintenance** – Docs must be refreshed quarterly to stay current (added to ops calendar)

### Mitigation

- Make templates simple (8-10 headings each)
- Provide examples in this ADR and `guide.md`
- Automate link audits (quarterly `grep` checks)
- Make docs maintenance an explicit team task (quarterly review cadence)

## Alternatives Considered

### 1. Flat Structure (No Layering)
All docs in one flat `docs/` directory. **Dismissed** because:
- No separation between stable invariants and changing workflows
- Hard to find docs (no index)
- AI assistants can't easily prioritize what to load

### 2. MkDocs / Docusaurus Site
Build a full documentation platform with search and navigation. **Dismissed** because:
- Over-complicated for current needs (MVP can be Markdown in Git)
- High maintenance burden
- Doesn't solve the core problem (fragmented context for AI assistants)

### 3. Single Monolithic Doc
Combine all architecture docs into one giant file. **Dismissed** because:
- Token limits prevent loading full context for complex queries
- Violates separation of concerns
- Makes updates risky (one change affects entire file)

## Related Decisions

- Architecture Decision Records are kept in `docs/adr/` using MADR format (this record)
- All domain docs include `Source of truth` linking to source code or config
- Workflows go in `docs/workflow/` and are linked from (not embedded in) invariant docs

## Implementation Timeline

- **Phase 1**: Create all 13 templates + 20 MVP docs (AI context, product glossary, architecture, API, database, cache, auth, AI services, services, testing, operations)
- **Phase 2**: Wire canonical links in `.github/instructions/instruction.instructions.md` and `README.md`
- **Phase 3**: Add governance (PR checklist, docs maintenance protocol, smoke tests)

## References

- [Documents-as-Code: MVP Rollout Plan](./documents-as-code.md)
- [Repository Map](../ai/repo-map.md) – System boundaries for AI context
- [Assistant Context Index](../ai/assistant-context-index.md) – Complete docs index
- [Assistant Guide](../ai/guide.md) – Task routing examples

---

## Sign-Off

- **Proposed by**: Engineering Team  
- **Accepted by**: Technical Leadership  
- **Date accepted**: 2026-05-26
