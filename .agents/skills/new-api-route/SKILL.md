---
name: new-api-route
description: Add a new Express route file to the Let's Roll API server. Use whenever adding a new resource or feature area (e.g. /api/notifications, /api/reports). Covers file creation, middleware wiring, mounting in the routes index, and DB access patterns.
---

# New API Route — Scaffolding Pattern

## Files to touch

| File | Action |
|------|--------|
| `artifacts/api-server/src/routes/<name>.ts` | Create |
| `artifacts/api-server/src/routes/index.ts` | Add import + mount |

## 1. Create the route file

```typescript
// artifacts/api-server/src/routes/<name>.ts
import { Router } from "express";
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { myTable } from "@workspace/db/schema";
import { requireInstructor } from "../middleware/requireInstructor";
// import { requireClient } from "../middleware/requireClient";   // for client-auth routes

const router = Router();

// Public endpoint (no auth)
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(myTable);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Protected endpoint (instructor JWT required)
router.post("/", requireInstructor, async (req, res) => {
  const instructorId = req.instructorId!;   // set by requireInstructor middleware
  const body = req.body as { field?: string };

  if (!body.field || typeof body.field !== "string") {
    res.status(400).json({ error: "field is required" });
    return;
  }

  try {
    const [row] = await db
      .insert(myTable)
      .values({ instructorId, field: body.field })
      .returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

## 2. Mount in the routes index

`artifacts/api-server/src/routes/index.ts`:

```typescript
import myRouter from "./<name>";

// Add inside the router.use() block:
router.use("/<name>", myRouter);
```

Full URL becomes: `GET /api/<name>/`

## Middleware reference

| Middleware | Import | Effect |
|-----------|--------|--------|
| `requireInstructor` | `"../middleware/requireInstructor"` | Validates instructor JWT; sets `req.instructorId` |
| `requireClient` | `"../middleware/requireClient"` | Validates client session cookie; sets `req.clientId` |
| `rateLimit(...)` | `"express-rate-limit"` | Apply per-route for sensitive endpoints |
| `banCheckMiddleware` | Applied globally in `app.ts` | Already runs on all routes |

## TypeScript: accessing req.instructorId

The `instructorId` is attached by middleware. TypeScript knows about it via the declaration in `src/types/express.d.ts` (or similar augmentation). Always use non-null assertion (`req.instructorId!`) inside a route guarded by `requireInstructor`.

## DB access patterns

```typescript
import { db } from "@workspace/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { myTable } from "@workspace/db/schema";

// Select with filter
await db.select().from(myTable).where(eq(myTable.instructorId, instructorId));

// Insert + return
const [row] = await db.insert(myTable).values({ ... }).returning();

// Update
await db.update(myTable).set({ field: value }).where(eq(myTable.id, id));

// Delete
await db.delete(myTable).where(and(eq(myTable.id, id), eq(myTable.instructorId, instructorId)));
```

Always scope writes to the authenticated user's `instructorId` or `clientId` — never trust an ID from the request body for ownership checks.

## After adding the route

Restart the API server workflow — no restart needed for route changes in dev (pino-http hot reloads), but restart if you add new middleware or change app.ts.

```
Workflow: artifacts/api-server: API Server → Restart
```

Smoke test with curl:
```bash
curl -s https://$REPLIT_DEV_DOMAIN/api/<name>/ | jq .
```
