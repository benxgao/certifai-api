# Auth Patterns

> **Source of truth**: `functions/src/middlewares/authCheck.ts`, `functions/src/middlewares/jwtAuth.ts`, `functions/src/middlewares/verifyUserAccess.ts`, `functions/src/types/express.ts`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Document authentication and authorization invariants for `certifai-api`.

> This document contains **invariants only**. Step-by-step execution sequence belongs in [Auth Verification Workflow](../workflow/auth-verification-workflow.md).

## Key Concepts

- **Firebase JWT verification**: primary auth for protected API routes.
- **Public JWT verification**: dedicated path for public/service JWT usage.
- **Verified user context**: ownership-validated user object attached to request.
- **Typed auth request contracts**: `AuthenticatedRequest`, `AuthenticatedRequestHandler`.

## Conventions / Rules (Invariants Only)

### 1) Protected route gate

Protected routes must require token verification before handler execution.

Primary middleware entry point:
- `verifyFirebaseToken` (`authCheck.ts`)

### 2) Ownership gate for `:user_id` routes

Routes that carry `:user_id` must enforce ownership validation.

Ownership middleware entry point:
- `verifyUserAccess` (`verifyUserAccess.ts`)

Invariant:
- `req.params.user_id` must match the authenticated Firebase user mapping in DB.

### 3) Request context fields

Auth middleware populates these request fields:

- `req.firebase_user_info` (decoded Firebase token)
- `req.verified_user` (DB user context after ownership verification)

For public JWT routes (`jwtAuth.ts`):
- `req.user` with `{ sub, scope }` for public/service token flow

### 4) Error envelope consistency

Auth middleware should return envelope-based failures with HTTP semantics:

- Missing token: 401
- Invalid token: 401 or 403 (existing code paths differ)
- Ownership mismatch: 403
- Missing `user_id`: 400

### 5) Type safety invariants

- Use typed request handlers (`AuthenticatedRequestHandler`) on protected routes.
- Do not cast request auth fields to `any`.
- Do not rely on unverified user IDs from request body/query for authorization.

### 6) Service boundary invariant

Auth middleware must not implement business logic for domain actions; it only verifies identity/access and enriches request context.

## Dangerous Areas / Anti-patterns

- Trusting `req.params.user_id` without `verifyUserAccess`.
- Reading user identity from request body/query in place of token-derived context.
- Mixing public JWT flow and Firebase JWT flow unintentionally.
- Assuming `req.verified_user` exists on routes that skipped ownership middleware.
- Returning custom/non-standard error payload shapes from auth middleware.

## Related Docs

- [Auth Verification Workflow](../workflow/auth-verification-workflow.md) – lifecycle sequence and transitions
- [API Endpoint Conventions](../api/endpoint-conventions.md) – route-level auth usage
- [Response Envelope](../api/response-envelope.md) – standard error/success contract
- [Firebase Functions Structure](../architecture/firebase-functions-structure.md) – middleware placement in routing
