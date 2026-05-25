# [Auth Topic]

> **Source of truth**: `[path/to/middleware or auth service]`
> **Last reviewed**: YYYY-MM-DD
> **Owner**: [team or role]

## Purpose

[Brief statement of authentication and authorization invariants covered]

## Key Concepts

[Auth token shape, verification chain, user context]

## Conventions / Rules (Invariants Only)

[Hard rules about middleware entry points, token validation, `req.user` contract. Do NOT put step-by-step procedures here — those belong in `docs/workflow/auth-verification-workflow.md`]

## Examples

[Middleware usage, token verification patterns]

## Dangerous Areas / Anti-patterns

[Security vulnerabilities, missing token validation, authorization bypass risks]

## Related Docs

- See [docs/workflow/auth-verification-workflow.md](../workflow/auth-verification-workflow.md) for step-by-step auth verification lifecycle.
- Add at least one sibling-domain link here (for example: `../api/endpoint-conventions.md`).
