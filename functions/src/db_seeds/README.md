# Prisma seeding

## Certification Management

The `certs.ts` script handles all certification-related database operations:

```sh
# Seed certifications (default operation)
npx ts-node src/db_seeds/certs.ts

# Update certification question counts
npx ts-node src/db_seeds/certs.ts update-question-counts

# Update certification URLs and create new certifications
npx ts-node src/db_seeds/certs.ts update-urls

# Explicitly run seeding
npx ts-node src/db_seeds/certs.ts seed
```

## Other Scripts

```sh
npx ts-node src/db_seeds/exams.ts
```

## Order

- certs
- users
- user_cert
