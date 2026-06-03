# Copilot Instructions (`certifai-api`)

> Last reviewed: 2026-06-03  
> Canonical knowledge lives in `docs/`; this file is the fast-start map.

## Start of every task (mandatory)

1. Read `docs/ai/guide.md` (task routing), then `docs/ai/repo-map.md` (boundaries/invariants).
2. Load only relevant domain docs via `docs/ai/assistant-context-index.md`.
3. Use code scanning only when docs are insufficient, then update docs in the same change.

## Big picture architecture (what talks to what)

- Runtime entrypoints: `functions/src/index.ts` exports `endpoints` (HTTP API) and `delegators` (Cloud Tasks handlers).
- HTTP app wiring: `functions/src/endpoints/index.ts` mounts `/api`, `/stripe`, `/healthcheck` with `helmet` + CORS + compression.
- API router: `functions/src/endpoints/api/index.ts` (user/cert/exam/auth/public routes).
- Service boundary: endpoints orchestrate; business logic lives in `functions/src/services/*` (`prisma`, `redis`, `cache`, `cloudTasks`, `genkit`, `optimizedRateLimit`, etc.).
- Data flow: Next.js app (`certifai-app`) → REST API → Prisma/Postgres + Firestore + Redis + Genkit/Vertex.

## Project-specific invariants (do not break)

- Response contract is envelope-only: `{ success: true, data, meta? }` or `{ success: false, error, code? }` (see `docs/api/response-envelope.md`).
- Protected `:user_id` routes must chain `verifyFirebaseToken` then `verifyUserAccess`; handlers use `req.verified_user` (not request body/query identity).
- Reuse singleton Prisma from `functions/src/services/prisma/index.ts`; never instantiate `PrismaClient` in handlers.
- Use Prisma enums (`ExamStatus`, `CertificationStatus`, `DifficultyLevel`) instead of string literals.
- Redis access goes through `RedisService`/`CacheManager`; use `CACHE_CONFIG.KEYS` helpers for key format + invalidation.
- Exam generation lifecycle must preserve status transitions (e.g., `QUESTIONS_GENERATING -> READY` or failure path).

## Developer workflows that matter here

- Local backend dev: run `npm run serve` in `functions/` (Firebase emulator flow).
- Tests: `npm test` (or targeted Jest files in `functions/__tests__/`).
- Type checks after type-heavy changes: `npx tsc --noEmit` (from `functions/`).
- Deploy behavior: GitHub Actions deploy UAT on `uat` branch and production on `master`; workflows create runtime `.env` and credentials from GitHub secrets.

## Cloud Tasks + async behavior

- Exam/report/knowledge tasks route through `functions/src/delegators/tasks/*` and services in `functions/src/services/cloudTasks/`.
- Local behavior may appear synchronous/immediate; production is queue-driven async. Write idempotent handlers and test duplicate deliveries.

## Guardrails

- Never run `npm run build` manually during assistant sessions.
- Never reset the database.
- Never commit service-account files or secrets (`functions/gcp_credentials*.json`, `.env` values).
- Keep changes scoped; avoid opportunistic refactors.

## Response style at task completion

- Do not end with a paragraph summary.
- Keep final completion output very short: 1-3 bullet points only.
- Include only: (1) files changed, (2) verification run status, (3) optional next step if needed.
- If there is nothing else needed, end after the bullets (no trailing recap text).
- Avoid repeating context already shown earlier in the conversation.

## Rollout/docs policy

- For rollout/migration plans, use `ai_oriented_kanban/templates/rollout-plan-template.md`.
- Follow `docs/operations/spec-first-kanban-integration.md` (`Docs Needed` + `Decision Evidence Log` for non-trivial decisions).
