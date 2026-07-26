---
name: express-api-security
description: Harden an Express API server on Replit with CORS lockdown, Helmet headers, rate limiting, IP bans, and expiring HMAC tokens. Use when adding security to a new or existing Express backend, or when the user asks if the backend is secure.
---

# Express API Security Hardening

Complete security checklist for Express APIs running on Replit. Apply all steps — each addresses a distinct attack surface.

## 1. APP_SECRET (token signing)

The HMAC token secret must be set as a Replit secret or the server will throw in production.

```typescript
// lib/token.ts
function getSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_SECRET must be set in production");
    }
    return "dev-only-insecure-secret";
  }
  return secret;
}
```

Generate via: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Store as Replit secret `APP_SECRET`.

## 2. Token expiry

Embed `issuedAt` in the payload so stolen tokens expire automatically.

```typescript
// Token format: "<id>.<issuedAt>.<hmac>"
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(id: number): string {
  const issuedAt = Date.now();
  const payload = `${id}.${issuedAt}`;
  const mac = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

function verify(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, issuedAtStr, provided] = parts;
  const payload = `${idStr}.${issuedAtStr}`;
  const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");
  // timing-safe compare...
  const age = Date.now() - Number(issuedAtStr);
  if (age > TOKEN_MAX_AGE_MS) return null;
  const id = parseInt(idStr, 10);
  return isNaN(id) ? null : id;
}
```

## 3. Helmet (security headers)

```bash
pnpm add helmet
```

```typescript
// app.ts — before all routes
import helmet from "helmet";
app.use(helmet());
```

Covers: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and more.

## 4. CORS lockdown

Replit exposes domains via env vars — use them as the allowlist. Requests without an Origin header (server-to-server) are still allowed.

```typescript
import cors from "cors";

const allowedOrigins = new Set<string>();
const devDomain = process.env.REPLIT_DEV_DOMAIN;
const prodDomains = process.env.REPLIT_DOMAINS;
if (devDomain) allowedOrigins.add(`https://${devDomain}`);
if (prodDomains) {
  for (const d of prodDomains.split(",")) {
    allowedOrigins.add(`https://${d.trim()}`);
  }
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) cb(null, true);
    else cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
```

## 5. Rate limiting

```bash
pnpm add express-rate-limit
```

```typescript
import rateLimit from "express-rate-limit";

// On auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
router.post("/login", loginLimiter, loginHandler);

// On public booking/payment endpoints
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
```

Also set `app.set("trust proxy", 1)` in app.ts so `req.ip` resolves correctly behind Replit's proxy.

## 6. IP ban escalation

After N consecutive rate-limit windows exhausted, ban the IP for 1 hour. Store bans in Postgres (not memory) so they survive restarts.

Key tables:
- `ip_bans` — `ip TEXT PRIMARY KEY, until BIGINT`  
- `ip_strikes` — `ip TEXT PRIMARY KEY, count INT, last_window_start BIGINT`

Use atomic `INSERT ... ON CONFLICT DO UPDATE` with CASE expressions — never read-then-write under concurrent traffic.

Expose admin endpoints: `GET /api/admin/bans` and `DELETE /api/admin/bans/:ip` protected by `requireInstructor`.

## 7. Error handling

Add a global error handler as the last middleware to prevent stack traces leaking:

```typescript
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});
```

## Secrets checklist

Before deploying, confirm these are set as Replit secrets:
- `APP_SECRET` — token signing (generate fresh, 64-char hex)
- `DATABASE_URL` — Postgres connection
- `STRIPE_WEBHOOK_SECRET` — Stripe event verification
- `RESEND_API_KEY` — email sending

## Security audit quick check

```bash
# 1. Check no wildcard CORS
grep -n "cors()" artifacts/api-server/src/app.ts  # should return nothing

# 2. Check helmet is mounted
grep -n "helmet" artifacts/api-server/src/app.ts

# 3. Check APP_SECRET is set
# Use: viewEnvVars({ type: "secret" }) in code_execution — APP_SECRET must appear
```
