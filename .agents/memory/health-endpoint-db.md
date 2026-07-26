---
name: Health endpoint DB overhead fixed
description: banCheckMiddleware was running a DB query on every /api healthcheck ping — root cause of the Jun 24 production outage alerts.
---

## Rule
The `/api` and `/api/healthz` health routes must never trigger a database call. `banCheckMiddleware` is exempt for these two paths.

## What was fixed
- `artifacts/api-server/src/app.ts`: wrapped `banCheckMiddleware` in a path-check so `/api` and `/api/healthz` skip it entirely.
- `lib/db/src/index.ts`: added `keepAlive: true`, `keepAliveInitialDelayMillis: 10000`, `idleTimeoutMillis: 60000`, `connectionTimeoutMillis: 10000`, `max: 10` to the Pool config.

**Why:** Before the fix, every healthcheck ping (every ~155s) hit the `ip_bans` table. When Postgres recycled an idle connection, the reconnect added 4+ seconds to the response — tripping external uptime monitors and recording a false outage. With the fix, health endpoints respond in ~5ms with no DB access.

## How to apply
If a new middleware is added globally in `app.ts`, check whether it queries the DB. If yes, either exempt the health paths or mount it after a fast health-only sub-router. Never add DB work to the hot path of a healthcheck.
