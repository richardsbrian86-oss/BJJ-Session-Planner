# Expo Deployment Health Check

## When to use this skill
- Adding any Expo / React Native mobile artifact to a production deployment
- Debugging a mobile artifact that is unhealthy or slow to pass health checks after a deploy
- Any time `artifact.toml` for a mobile artifact lacks `[services.production.health.startup]`

---

## Problem

Expo mobile artifacts' `serve.js` returns HTTP 302 for `/` (redirect to `/book/`). Without an
explicit health endpoint, the deployment platform either has no defined probe path or hits the
redirect and may treat it as unhealthy, causing a slow or failed traffic switchover.

---

## Fix A — serve.js

Add the following block **before all other route handling** in the HTTP server callback (i.e.
before the `pathname === "/"` redirect block) so it responds immediately regardless of whether
`static-build/` exists:

```js
if (pathname === "/healthz") {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
  return;
}
```

---

## Fix B — artifact.toml

Add to the `[services.production]` section:

```toml
[services.production.health.startup]
path = "/healthz"
```

Without this, the platform has no defined startup health probe for the mobile service.

---

## Context

The mobile `build` step (Metro bundler + iOS/Android bundle download) takes 3–5 minutes.
Replit autoscale deployments keep the old instance alive during the build phase, so build time
alone doesn't cause downtime — only the health check startup window matters. With `/healthz`
in place, the serve process is marked healthy within milliseconds of starting, minimising the
switchover window.

---

## Verification

After adding both fixes, curl the deployed mobile port:

```
curl -s https://<your-app>.replit.app/healthz
# → {"status":"ok"}
```
