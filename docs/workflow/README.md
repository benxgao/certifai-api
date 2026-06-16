# Workflow Documentation Guide

> **Source of truth**: `docs/workflow/*-workflow.md` conventions in this repository
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Define where and how to document step-by-step procedures.

## Placement Rule

- Put lifecycle procedures in `docs/workflow/` only.
- File naming must be `*-workflow.md`.

Examples:
- `exam-generation-workflow.md`
- `auth-verification-workflow.md`
- `exam-token-workflow.md`

## Layering Contract

- **Invariant docs** (`docs/auth/`, `docs/api/`, `docs/ai-services/`, etc.) contain stable rules/constraints only.
- **Workflow docs** contain ordered steps, state transitions, and operational troubleshooting.

Do not embed numbered procedural sequences in invariant domain docs.

## Required Structure for Workflow Docs

1. Purpose
2. Entry points / triggers
3. Numbered workflow steps
4. State transitions (success + failure)
5. Failure handling and retries
6. Related docs

## Authoring Checklist

- Uses real source paths as SSOT references.
- Includes explicit trigger and completion conditions.
- Describes local-vs-production behavior differences when relevant.
- Links back to corresponding invariant docs.
- Includes `## Related Docs` with outbound links.

## Related Docs

- [Auth Patterns](../auth/auth-patterns.md) – auth invariants
- [Exam Generation (AI Services Invariants)](../ai-services/exam-generation.md) – AI guardrails
- [Service Catalog](../services/service-catalog.md) – service ownership
- [Token Economy](../product/token-economy.md) – credit/energy balance model used by exam submission flows
