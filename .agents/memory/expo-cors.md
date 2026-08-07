---
name: Expo CORS fix
description: The Expo web preview runs on a different subdomain than REPLIT_DEV_DOMAIN; the API server needs a subdomain wildcard CORS check to allow it.
---

The Expo web preview is served at `*.expo.janeway.replit.dev` but `REPLIT_DEV_DOMAIN` is `*.janeway.replit.dev` — a different subdomain. The API server's CORS allowlist only included the exact `REPLIT_DEV_DOMAIN` value, so every API call from the Expo preview returned a 500 CORS error.

**Why:** Replit routes the Expo dev server through a separate `expo.*` subdomain. Native Expo (on device) sends no `Origin` header so CORS doesn't apply there — but the in-browser web preview does.

**Fix (in `artifacts/api-server/src/app.ts`):**
Extract the base domain from `REPLIT_DEV_DOMAIN` (everything after the first `.`, e.g. `janeway.replit.dev`) and accept any origin ending with `.${baseDomain}`:

```typescript
const dotIdx = devDomain.indexOf(".");
if (dotIdx !== -1) {
  replitBaseDomain = devDomain.slice(dotIdx + 1); // "janeway.replit.dev"
}
// In cors origin callback:
if (replitBaseDomain && origin.endsWith(`.${replitBaseDomain}`)) {
  callback(null, true);
  return;
}
```

**How to apply:** Any time you add a new API server or tighten CORS on this project, make sure this subdomain wildcard is present. The exact REPLIT_DEV_DOMAIN value alone is not sufficient for the Expo web preview.
