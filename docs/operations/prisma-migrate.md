# Prisma Database Operations

## Database Seeding

### Prerequisites
Ensure these are in place before seeding:
- `.env` file configured with valid `DATABASE_URL` (in `functions/`)
- Database schema is up to date (migrations applied)
- Node.js types available in TypeScript config

**Check schema status:**
```bash
cd functions
npx prisma migrate status
```

Expected: `Database schema is up to date!`

### Seed Firms & Certifications

Restores 23 firms and 115+ certifications to the database.

```bash
cd functions
./node_modules/.bin/ts-node src/db_seeds/certs.ts
```

**Expected output (last lines):**
```
📊 Certification Seeding Summary:
✅ Successfully created: 115 certifications
➡️  Skipped (existing/errors): 7 certifications
📈 Total processed: 122 certifications

✅ Comprehensive seeding completed successfully!
```

### Verify Seeding Results

Check firms and certification counts in database:

```bash
cd functions
./node_modules/.bin/ts-node src/db_seeds/verify_firms.ts
```

**Expected:** Table output showing 23 firms and 115+ certifications with firm associations.

---

## Troubleshooting

### Issue 1: TypeScript Compilation Error
**Error:** `Cannot find name 'console'` / `Cannot find name 'process'`

**Root cause:** Missing Node.js type definitions in `tsconfig.json`

**Fix:**
```json
// functions/tsconfig.json
{
  "compilerOptions": {
    "lib": ["es2020"],
    "types": ["node"]  // ← ADD THIS
  }
}
```

Then retry seeding command.

---

### Issue 2: Broken/Incomplete Migration
**Error:** `Could not find the migration file at migration.sql`

**Root cause:** Empty migration directory exists

**Fix - Remove broken migration:**
```bash
cd functions
rm -rf prisma/migrations/<TIMESTAMP>_broken_migration_name/
npx prisma migrate status  # Verify resolution
```

Then retry seeding.

---

### Issue 3: Missing Database Column
**Error:** `The column 'Certification.slug' does not exist in the current database`

**Root cause:** Schema has diverged from database

**Fix - Create & apply migration:**
```bash
cd functions
npx prisma migrate dev --name add_slug_to_certification
```

This auto-generates and applies the migration. Then retry seeding.

---

### Issue 4: Database Connection Failed
**Error:** `Can't reach database server` or timeout

**Check:**
```bash
# Verify DATABASE_URL in .env
cat functions/.env | grep DATABASE_URL

# Test connection (requires PostgreSQL client)
psql $DATABASE_URL -c "SELECT 1"
```

If connection string is invalid or DB is unreachable, update `.env` and retry.

---

### Issue 5: Certifications Already Exist
**Behavior:** Some certifications marked as "already exists" (skipped)

**Root cause:** Normal behavior on re-runs; script is idempotent

**Action:** None needed. Script safely handles duplicates and updates existing records.

---

## Optional: Individual Seed Scripts

### Seed Users (Test Data)
```bash
cd functions
./node_modules/.bin/ts-node src/db_seeds/users.ts
```
Creates two test users with hardcoded Firebase IDs and 300 credit tokens.

### Link Users to Certifications
```bash
cd functions
./node_modules/.bin/ts-node src/db_seeds/user_cert.ts
```
Assigns test users to certifications with IN_PROGRESS status.

### Update Certification Question Counts
```bash
cd functions
./node_modules/.bin/ts-node src/db_seeds/certs.ts update-question-counts
```
Updates min/max quiz question ranges for all certifications.

### Update Certification URLs
```bash
cd functions
./node_modules/.bin/ts-node src/db_seeds/certs.ts update-urls
```
Adds/updates exam guide URLs for certifications.

---

## Reference

- **Seed scripts location:** `functions/src/db_seeds/`
- **Firms seeded:** AWS, GCP, Azure, Kubernetes, Docker, Cisco, CompTIA, Oracle, Salesforce, VMware, Red Hat, Linux, HashiCorp, Databricks, PMI, ITIL, TOGAF, ISC2, Scrum Alliance, Scrum.org, Scaled Agile, Generic
- **Certifications:** 115+ across all firms with exam URLs and pass scores
- **Prisma config:** `functions/prisma/schema.prisma`, `functions/prisma/migrations/`
