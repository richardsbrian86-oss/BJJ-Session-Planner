---
name: drizzle-schema-drift
description: Diagnose and fix Drizzle ORM schema drift where the database is out of sync with the TypeScript schema — especially after task agent merges that applied migrations via raw SQL instead of drizzle-kit push. Use when you see "column does not exist" or "relation does not exist" errors in API logs after a merge.
---

# Drizzle Schema Drift Recovery

## Why this happens

Task agents sometimes cannot run `drizzle-kit push` because of pre-existing drift. They apply schema changes via raw SQL instead. This fixes the isolated environment's DB but not the main dev environment's DB — so after a merge, the code expects columns that don't exist yet.

The post-merge stderr containing `ATExecSetNotNull` / `routine: 'ATExecSetNotNull'` is a reliable signal that schema drift is present but the push still partially ran.

## Diagnostic pattern

When you see errors like `column "slug" does not exist` or `relation "table_name" does not exist` in API logs:

### Step 1 — Identify the gap
```javascript
// In code_execution:
const result = await executeSql({ 
  sqlQuery: `SELECT column_name, data_type, is_nullable 
             FROM information_schema.columns 
             WHERE table_name = 'your_table_name' 
             ORDER BY ordinal_position` 
});
console.log(result.output);
```

Compare against the Drizzle schema file in `lib/db/src/schema/`.

### Step 2 — Check constraints
```javascript
const constraints = await executeSql({ 
  sqlQuery: `SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu 
               ON tc.constraint_name = kcu.constraint_name
             WHERE tc.table_name = 'your_table_name'
             ORDER BY tc.constraint_name, kcu.ordinal_position` 
});
console.log(constraints.output);
```

### Step 3 — Check row count before altering
```javascript
const rows = await executeSql({ sqlQuery: `SELECT COUNT(*) FROM your_table` });
```

If rows > 0 and the new column is NOT NULL, you must add it with a DEFAULT first, then drop the default:

```javascript
// With existing rows — safe pattern
await executeSql({ sqlQuery: `ALTER TABLE t ADD COLUMN slug TEXT NOT NULL DEFAULT ''` });
await executeSql({ sqlQuery: `ALTER TABLE t ALTER COLUMN slug DROP DEFAULT` });
// Update existing rows if needed before dropping default
```

If rows = 0, just add NOT NULL directly.

### Step 4 — Add missing constraints
```javascript
// UNIQUE constraint
await executeSql({ 
  sqlQuery: `ALTER TABLE t ADD CONSTRAINT t_col1_col2_key UNIQUE (col1, col2)` 
});
```

### Step 5 — Restart the API server
```javascript
// After SQL fixes, restart to clear prepared statement cache
await restartWorkflow({ name: "artifacts/api-server: API Server" });
```

### Step 6 — Verify fix in logs
Check that startup errors are gone and the affected endpoint returns correct status codes (not 500).

## After-merge checklist

Run `drizzle-kit push` after every task agent merge to catch drift early:

```bash
pnpm --filter @workspace/db run push
```

If it shows `[✓] Changes applied` — drift was present and now fixed.  
If it shows `[i] No changes detected` — schema is in sync.  
If it shows errors — use the diagnostic pattern above to fix manually.

## Common drift patterns seen in this project

| Table | Missing element | Fix |
|---|---|---|
| `auth_failures` | `slug` column + `UNIQUE(slug,ip)` | See Step 3 (0 rows safe) |
| `auth_failures` | Unique constraint only | `ALTER TABLE ADD CONSTRAINT` |
| `ip_ban_history` | `unbanned_at`, `reason`, `lifted_early` columns | Add with `DEFAULT NULL` / `DEFAULT false` |
