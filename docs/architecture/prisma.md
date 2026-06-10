# Prisma

## Set up

```sh
cd functions
npm install prisma --D
npm install @prisma/client -S

npx prisma init --datasource-provider postgresql
npx prisma generate
npx prisma migrate reset

npx prisma migrate dev --name init
npx prisma migrate deploy # use this in dev/uat to prevent from new migration files
```

## Related Docs

- [docs/database/prisma-patterns.md](../database/prisma-patterns.md) — Canonical Prisma usage and migration patterns. Ref: `functions/prisma/schema.prisma`
- [docs/architecture/database-design.md](./database-design.md) — Current relational and document storage model mapped from Prisma. Ref: `functions/prisma/schema.prisma`
- [docs/architecture/exam_data.md](./exam_data.md) — Exam state transitions that depend on Prisma records. Ref: `functions/src/utils/examQuestionAssociation.ts`
- [docs/architecture/overview.md](./overview.md) — High-level architecture guide that points into the data layer. Ref: `functions/src/services/prisma/index.ts`
