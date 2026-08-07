---
name: express-rate-limit-by-user
description: Rate-limit Express routes by authenticated user ID (not by IP). Use when adding rate limiting to any endpoint that runs after an auth middleware that sets a user/instructor ID on the request. Covers the express-rate-limit v8 IPv6 validation gotcha, keying by user ID, and applying different limiters to different endpoint categories.
---

# Express Rate Limiting by Authenticated User ID

## Why key by user ID instead of IP

Keying by IP punishes users behind NAT (entire office gets blocked when one user trips the limit) and is bypassable via IPv6 rotation. When an auth middleware has already identified the user, keying by their ID gives each user their own independent bucket and is not bypassable.

## The express-rate-limit v8 IPv6 gotcha

In express-rate-limit v8, if your `keyGenerator` function references `req.ip` at all — even as a fallback — it throws a `ValidationError` at startup:

```
ERR_ERL_KEY_GEN_IPV6: Custom keyGenerator appears to use request IP without
calling the ipKeyGenerator helper function for IPv6 addresses.
```

**Solution**: do NOT use `req.ip` in your keyGenerator when you have a user ID available. If your auth middleware runs before the rate limiter (it always should), the user ID is guaranteed to be set, so the IP fallback is unreachable anyway.

```typescript
// ❌ WRONG — triggers ERR_ERL_KEY_GEN_IPV6 at startup in express-rate-limit v8
keyGenerator: (req) => String(req.instructorId ?? req.ip ?? "unknown"),

// ✅ CORRECT — auth middleware guarantees instructorId is set; no IP needed
keyGenerator: (req) => String(req.instructorId!),
```

## Full pattern

```typescript
import rateLimit from "express-rate-limit";

const paymentLimiter = rateLimit({
  windowMs: 60_000,   // 1 minute
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.instructorId!),
  message: { error: "Too many payment requests. Please try again later." },
});

// Apply AFTER the auth middleware, BEFORE the async handler
router.post("/create-intent", requireInstructor, paymentLimiter, async (req, res) => {
  // req.instructorId is guaranteed set here
});
```

## Middleware ordering rule

The auth middleware **must** appear before the rate limiter in the chain:

```
requireInstructor → paymentLimiter → async handler
```

If the rate limiter runs before auth, `req.instructorId` is undefined and you need the IP fallback (which triggers the v8 warning). Reorder to fix.

## Different limiters for different risk levels

```typescript
// Tight limit for money-moving endpoints
const paymentLimiter = rateLimit({ windowMs: 60_000, limit: 20, ... });

// Moderate limit for auth endpoints (keyed by IP since user not yet identified)
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, ... });

// Loose limit for read-heavy APIs
const apiLimiter = rateLimit({ windowMs: 60_000, limit: 100, ... });
```

Note: for unauthenticated routes (login, register, forgot-password), keying by IP is necessary since there is no user ID yet. Use `validate: { ip: false }` to suppress the v8 warning if you intentionally use `req.ip` there with a known IPv6 limitation:

```typescript
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  validate: { ip: false },  // we know about IPv6; acceptable for login pages
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
```

## Existing limiters in this project

- `clients.ts`: `loginLimiter` (10/15min), `registerLimiter` (5/15min), `forgotPasswordLimiter` (5/15min) — all IP-keyed with `validate: { ip: false }` suppression recommended
- `payments.ts`: `paymentLimiter` (20/60s) — keyed by `instructorId`
