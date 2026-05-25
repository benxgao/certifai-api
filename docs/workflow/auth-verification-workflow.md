# Auth Verification Workflow

> **Source of truth**: `functions/src/middlewares/authCheck.ts`, `functions/src/middlewares/verifyUserAccess.ts`, `functions/src/middlewares/jwtAuth.ts`, `functions/src/endpoints/api/index.ts`
> **Last reviewed**: 2026-05-26
> **Owner**: Backend Team

## Purpose

Describe the procedure that validates incoming identity and binds verified user context to request handling.

## Entry Points

- Protected API routes mounted in `functions/src/endpoints/api/index.ts`
- Public JWT routes that use `verifyJWTToken` when applicable

## Workflow Steps

1. **Request arrives with Authorization header**
   - Header expected: `Authorization: Bearer <token>`.

2. **Primary token verification**
   - Protected routes call `verifyFirebaseToken`.
   - Middleware extracts token, verifies signature/expiry, and sets `req.firebase_user_info`.

3. **Ownership verification for user-scoped routes**
   - For `:user_id` routes, `verifyUserAccess` runs after Firebase verification.
   - Middleware loads DB user by `user_id` and confirms token identity matches mapped Firebase user.
   - On success, sets `req.verified_user`.

4. **Handler execution with verified context**
   - Route handler reads identity from `req.verified_user`/`req.firebase_user_info`.
   - Business logic executes only with verified identity context.

5. **Error return path**
   - Missing/invalid token or ownership mismatch returns auth error response and short-circuits handler.

## State/Context Transitions

Request context enrichment sequence:

- Initial request: no verified context
- After token verification: `req.firebase_user_info` available
- After ownership verification: `req.verified_user` available
- Handler stage: uses verified fields only

## Public JWT Path (when used)

For public/service JWT routes:

- `verifyJWTToken` validates token with JWT service
- attaches `req.user = { sub, scope }`
- this path is separate from Firebase identity path and should not be mixed accidentally

## Failure Handling

Typical failure outcomes:

- Missing token/header format issue → 401
- Invalid/expired token → 401 or 403 (existing route conventions)
- Missing `user_id` parameter for user-scoped route → 400
- Ownership mismatch → 403
- Internal verification error → 500

## Troubleshooting

- Confirm middleware order in route registration.
- Confirm `user_id` path parameter is present where expected.
- Confirm DB mapping between `user_id` and `firebase_user_id`.
- Confirm token issuer/flow (Firebase vs public JWT) matches route expectation.

## Related Docs

- [Auth Patterns](../auth/auth-patterns.md) – auth invariants and guardrails
- [API Endpoint Conventions](../api/endpoint-conventions.md) – route conventions
- [Response Envelope](../api/response-envelope.md) – expected error/success payloads
- [Firebase Functions Structure](../architecture/firebase-functions-structure.md) – middleware placement
