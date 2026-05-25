# certifai AI Coding Instructions

## Architecture

- `certifai-app`: Next.js 15 frontend with shadcn/ui, Tailwind CSS, Firebase Auth
- `certifai-api`: Firebase Functions backend with Express.js, Prisma, PostgreSQL, Redis

## Canonical Documentation References

Load these first for project context (keep this section as links-only; details live in docs):

- Repository map: `../../docs/ai/repo-map.md`
- Assistant context index: `../../docs/ai/assistant-context-index.md`
- Assistant task-routing guide: `../../docs/ai/guide.md`

## Frontend Patterns

- Use shadcn/ui components from `src/components/ui/`, custom components in `src/components/custom/`
- Use `STYLE_GUIDE.md` for styling conventions
- Use existing reusable components from `src/components/` if possible
- Always include dark mode variants
- Use SWR hooks from `src/swr/` for API calls
- API format: `{success: boolean, data: T, meta?: PaginationMeta}`

## Backend Patterns

- Entry: `functions/src/index.ts`, routes in `src/endpoints/api/`
- Prisma client in `src/services/prisma/index.ts`
- Auth middleware: `src/middlewares/authCheck.ts`
- Use `req.user` for authenticated user data

## Development Workflows

```bash
# Frontend
cd certifai-app && npm run dev

# Backend
cd certifai-api/functions && npm run serve

# Database migrations
cd certifai-api/functions
npx prisma migrate dev --name "description"
npx prisma generate
```

## Key Rules

- Use absolute imports: `@/src/components/ui/button`
- Never reset database or run `npm run build` during interaction
- Use Prisma generated types, avoid `any`; use enums as single source of truth for fixed string values
- Conservative, clean solutions following best practices
- Leverage existing libraries over custom implementations
- Run `npx tsc --noEmit 2>&1 | grep "^(src|functions/src)/"` after major type changes to verify compilation
- When migrating DB columns, always provide default values or nullable constraints to avoid breaking changes

## Anti-Patterns to Avoid

- Don't run `npm run build` during interaction
- Don't bypass the `cn()` utility for className merging
- Avoid direct Prisma client usage outside service layer
- Don't hardcode API endpoints — use environment variables
- Never commit Firebase config or credentials
- Never use `any` types — leverage Prisma generated types and explicit interfaces
- Never reset the database
- Avoid using Firebase's default JWT verification for public endpoints; implement custom verification logic
- Don't add error handling, fallbacks, or abstractions beyond what the task requires

## Type Safety Notes (from experience)

- `useSWRMutation` needs 4 generic params when passing extra args: `<Data, Error, Key, ExtraArg>`
- Avoid `data?.data` nesting if the response type has no `.data` field — return `data` directly
- Use enums for status comparisons (e.g., `ExamStatus.READY` not `'READY'`)
- Express auth middleware: keep `req.user` optional (`AuthRequest`) for public routes, required for protected ones
- Create custom error classes (extending `Error`) when callers need context (e.g., which item failed)

## Rollout Instruction Skill

**Trigger**: Any task that involves creating or modifying more than 5 files.

**Action**: Before writing any code, generate a rollout instruction document in `kanban/WIP/` using the filename format `YYMMDD-<short-kebab-title>.md`.

**Document structure**:

```markdown
# Rollout: <Feature/Task Title>

## Summary

One paragraph description of what this change does and why.

## Scope

- Estimated files to create: N
- Estimated files to modify: N
- Risk level: Low / Medium / High

## Phases

### Phase 1: <Name> (independently testable)

**Goal**: ...
**Files**:

- `path/to/file.ts` — create/modify — reason
  **Verification**: how to test this phase in isolation

### Phase 2: ...

## Rollback Plan

Steps to revert each phase safely.

## Open Questions

Any unknowns that need product/architect input before or during implementation.
```

This document must be created **before** any implementation starts. It serves as the audit trail for product managers and solution architects.

After completing all phases, move the document from `kanban/WIP/` to `kanban/_completed/`.
