---
name: pg-pool-resilience
description: Prevent idle-connection crash loops in pg-pool on Replit. Adds pool.on('error') handler and process-level safety nets so Postgres connection resets don't kill the Node process. Use when the API crashes with "terminating connection due to administrator command" or after any Postgres idle-timeout outage.
---

# pg-pool Resilience — Preventing Idle-Connection Crash Loops

## Problem

Replit's managed PostgreSQL periodically terminates idle connections (roughly every 2–3 hours). When this happens, `pg-pool` emits an `'error'` event on the pool instance. If no listener is registered, Node.js treats it as an **uncaught exception** and kills the process — triggering a crash loop and deployment outage.

Stack trace signature to recognise this crash:
```
Emitted 'error' event on BoundPool instance at:
error: terminating connection due to administrator command
    at Client2.idleListener (pg-pool/index.js:62:10)
    ...
throw er; // Unhandled 'error' event
```

This root-caused **two separate production outages** on this project. The fix was not deployed after the first diagnosis, causing the second.

## Fix — Two layers required

### Layer 1: Pool error handler (`lib/db/src/index.ts` or wherever the pool is created)

```typescript
import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// CRITICAL: without this, idle-connection resets crash the Node process
pool.on('error', (err) => {
  console.error('[pg-pool] idle client error — connection will be recycled', err.message);
  // Do NOT re-throw. Pool handles reconnection automatically.
});
```

### Layer 2: Process-level safety nets (`artifacts/api-server/src/index.ts` or entry point)

```typescript
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException — keeping process alive:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection — keeping process alive:', reason);
});
```

**Both layers are needed.** Layer 1 catches the pool-specific event before it becomes uncaught. Layer 2 is a backstop for any other unhandled event.

## Deployment gotcha

After adding the fix to source code, you **must build and redeploy**. The production deployment runs a pre-built binary (`dist/index.mjs`), not the source. The fix will not take effect until:
1. `pnpm --filter @workspace/api-server run build`
2. Click Publish (or trigger deployment)

Failing to redeploy after the code fix will cause the crash to recur — this happened once in this project.

## Verification

After deploying, the next Postgres idle-connection reset will produce a **warning log line** instead of a crash:
```
[pg-pool] idle client error — connection will be recycled terminating connection due to administrator command
```

The process stays alive and pg-pool reconnects automatically.
