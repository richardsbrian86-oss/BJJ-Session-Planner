---
name: auth_failures schema drift
description: The auth_failures table was missing the slug column after task agents applied migrations inconsistently; fixed via direct SQL.
---

## Rule
After task agent merges involving `auth_failures`, verify the `slug` column exists and that a UNIQUE constraint on `(slug, ip)` is present. Drizzle-kit push was blocked multiple times by pre-existing schema drift, so task agents applied changes via raw SQL — but the dev DB was not always updated.

## What to check
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'auth_failures';
-- Must include: ip, count, window_start, alerted_at, slug
```

**Why:** The `slug` column was added to the schema code across multiple tasks (#54, #68) but the dev database never received a successful migration for it. The column was added manually in production SQL but skipped in the dev environment, causing `column "slug" does not exist` errors on every login attempt and cleanup job run.

**How to apply:** If you see `column "slug" does not exist` errors in API logs after a security-related task merge, run:
```sql
ALTER TABLE auth_failures ADD COLUMN slug TEXT NOT NULL DEFAULT '';
ALTER TABLE auth_failures ALTER COLUMN slug DROP DEFAULT;
ALTER TABLE auth_failures ADD CONSTRAINT auth_failures_slug_ip_key UNIQUE (slug, ip);
```
