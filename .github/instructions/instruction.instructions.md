# certifai AI Coding Instructions

Keep this file lightweight. For full project guidance, always check `.github/copilot-instructions.md` first.

## Project context

- `certifai-app`: Next.js frontend
- `certifai-api`: Firebase Functions backend (Express + Prisma)

## Start-here references

- `../../docs/ai/repo-map.md`
- `../../docs/ai/assistant-context-index.md`
- `../../docs/ai/guide.md`

## Core rules

- Follow `.github/copilot-instructions.md` for detailed coding standards and workflows.
- Prefer existing components, services, and utilities over new abstractions.
- Use strict typing (no `any`) and Prisma-generated types where applicable.
- Never reset the database.
- Never run `npm run build` during interactive assistant tasks.
- Never commit credentials, secrets, or Firebase/GCP key files.

## Backend reminders

- API entry: `functions/src/index.ts`
- Route handlers: `functions/src/endpoints/api/`
- Prisma access via service layer: `functions/src/services/prisma/index.ts`

## Frontend reminders

- Reuse UI from `src/components/` (including `src/components/ui/`).
- Keep API responses consistent: `{ success: boolean, data: T, meta?: PaginationMeta }`.

## If uncertain

Default to the simplest safe implementation and refer back to `.github/copilot-instructions.md`.
