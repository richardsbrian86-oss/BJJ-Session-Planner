---
name: Mobile deployment health check
description: Pattern for making Expo mobile serve.js pass production health checks immediately on startup.
---

## Rule
Every Expo mobile artifact's `serve.js` must expose `GET /healthz → 200 {"status":"ok"}`,
and `artifact.toml` must declare `[services.production.health.startup] path = "/healthz"`.

## Why
`serve.js` returns HTTP 302 for `/` (redirect to client portal). Deployment health
checkers that don't follow redirects treat this as a failure. Without an explicit
`[services.production.health.startup]` the platform also has no defined probe path.

## How to apply
When creating or auditing an Expo mobile artifact for production deployment:
1. Add the `/healthz` handler at the TOP of the HTTP server callback, before all other routes.
2. Add `[services.production.health.startup] path = "/healthz"` inside the `[services.production]`
   section of `artifact.toml`.
3. The mobile Metro build (build.js) takes 3–5 min but runs before serve starts; autoscale
   rolling deployment keeps the old instance alive during that window, so only the serve
   startup health check time drives switchover latency.
