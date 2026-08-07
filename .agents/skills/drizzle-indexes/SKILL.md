---
name: drizzle-indexes
description: Add performance indexes to Drizzle ORM table schemas in this project. Use when adding new tables, when queries are slow, or after a code audit identifies missing FK indexes. Covers the pgTable second-argument syntax, common index patterns (FK columns, composite, lookup columns), and pushing to the database.
---

# Drizzle ORM Index Pattern

## Key rule
PostgreSQL does **not** automatically create indexes on foreign key columns — only on `PRIMARY KEY` and `UNIQUE` columns. Every FK column that appears in a `WHERE` clause needs an explicit index or queries do a full table scan.

## Syntax — second argument to `pgTable()`

```typescript
import { pgTable, integer, text, index } from "drizzle-orm/pg-core";

export const myTable = pgTable(
  "my_table",
  {
    id: serial("id").primaryKey(),
    instructorId: integer("instructor_id").notNull().references(() => instructorsTable.id),
    paymentIntentId: text("payment_intent_id"),
    date: text("date").notNull(),
    time: text("time").notNull(),
  },
  (t) => [
    index("my_table_instructor_id_idx").on(t.instructorId),
    index("my_table_instructor_date_time_idx").on(t.instructorId, t.date, t.time),
    index("my_table_payment_intent_id_idx").on(t.paymentIntentId),
  ],
);
```

- `index` must be imported from `"drizzle-orm/pg-core"` — it is NOT in the default import
- The second argument is a function `(t) => [...]` returning an array of index definitions
- Index names must be globally unique across all tables in the DB — use `tablename_column_idx` convention
- Composite indexes (multiple columns) accelerate queries that filter on all those columns together

## Index decision guide

| Situation | Add index? |
|-----------|-----------|
| FK column used in `WHERE` | ✅ Always |
| Column used in `WHERE` for lookups (token, email) | ✅ Yes |
| Column only used in `SELECT` output | ❌ No |
| Column with `.unique()` already | ❌ Already has one |
| `PRIMARY KEY` column | ❌ Already has one |
| Column rarely queried | ❌ Skip — indexes cost write performance |

## Common indexes needed in this project

Every table with an `instructorId` FK needs at minimum `index("tablename_instructor_id_idx").on(t.instructorId)`.

Tables with compound lookup patterns need composite indexes:
```typescript
// sessions: most queries filter by instructor + date range
index("sessions_instructor_date_time_idx").on(t.instructorId, t.date, t.time)

// Webhook lookups — Stripe sends paymentIntentId / subscriptionId
index("sessions_payment_intent_id_idx").on(t.paymentIntentId)
index("sessions_subscription_id_idx").on(t.subscriptionId)

// Password reset lookup
index("clients_reset_token_idx").on(t.resetToken)
```

## After changing schema — push to DB

```bash
cd lib/db && pnpm run push
# Expected output: [✓] Changes applied
```

If the output says `[i] No changes detected`, the index already exists or the schema file wasn't saved correctly.

## Applying to existing tables with data

`drizzle-kit push` creates indexes with `CREATE INDEX IF NOT EXISTS` — safe to run on tables with existing rows. Postgres builds the index in the background for large tables. No downtime required.

## Schema file location in this project

All schema files live in `lib/db/src/schema/`. After editing, the `@workspace/db` package must be rebuilt before the API server picks up changes (the dev workflow handles this automatically on restart).
