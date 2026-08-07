---
name: password-reset-flow
description: Add a complete email-based password reset feature to the Let's Roll client portal. Use when the user asks to add "forgot password", "reset password", or "password recovery" for clients (email+password auth). Covers DB schema columns, rate-limited API endpoints with anti-enumeration, Resend HTML email, and two Wouter portal pages (forgot-password + reset-password).
---

# Password Reset Flow

## Stack

Express 5 + Drizzle ORM + PostgreSQL + Resend (email) + React/Vite + Wouter (base `/book/`)

## 1. DB Schema (`lib/db/src/schema/clients.ts`)

Add two nullable columns — no `.notNull()` so existing rows stay valid:

```typescript
resetToken: text("reset_token"),
resetTokenExpiresAt: timestamp("reset_token_expires_at"),
```

Then push: `cd lib/db && pnpm run push`

## 2. API Endpoints (`artifacts/api-server/src/routes/clients.ts`)

### Imports to add
```typescript
import { sendPasswordResetEmail } from "../lib/email";
```

### Rate limiter (share one for both routes)
```typescript
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
```

### POST /forgot-password

**Critical**: always return 200 — never reveal if an email exists (anti-enumeration).

```typescript
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const [client] = await db
      .select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable)
      .where(eq(clientsTable.email, normalizedEmail))
      .limit(1);

    if (client) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await db.update(clientsTable)
        .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
        .where(eq(clientsTable.id, client.id));

      const scheme = process.env.REPLIT_DEV_DOMAIN ? "https" : "http";
      const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080";
      const resetUrl = `${scheme}://${domain}/book/reset-password?token=${token}`;
      void sendPasswordResetEmail({ to: normalizedEmail, name: client.name, resetUrl });
    }
    // Always 200 — don't reveal whether account exists
    res.json({ message: "If an account exists for that email, a reset link has been sent." });
  } catch {
    res.status(500).json({ error: "Failed to process request" });
  }
});
```

### POST /reset-password

```typescript
router.post("/reset-password", forgotPasswordLimiter, async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  try {
    const [client] = await db
      .select({ id: clientsTable.id, resetTokenExpiresAt: clientsTable.resetTokenExpiresAt })
      .from(clientsTable)
      .where(eq(clientsTable.resetToken, token))
      .limit(1);

    if (!client || !client.resetTokenExpiresAt || client.resetTokenExpiresAt < new Date()) {
      res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
      return;
    }

    const passwordHash = await hashPassword(newPassword); // use project's existing hashPassword helper
    await db.update(clientsTable)
      .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
      .where(eq(clientsTable.id, client.id));

    res.json({ message: "Password updated successfully" });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});
```

## 3. Email (`artifacts/api-server/src/lib/email.ts`)

See the `sendPasswordResetEmail` export already in this file — it follows the project's standard `getResend()` / `getFromAddress()` / `escapeHtml()` pattern. Copy the structure from that function when adding new email types.

## 4. Portal Pages

### Route registration (`artifacts/client-portal/src/App.tsx`)
```typescript
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";

const NO_HEADER_PATHS = new Set([..., "/forgot-password", "/reset-password"]);

// Inside <Switch>:
<Route path="/forgot-password" component={ForgotPassword} />
<Route path="/reset-password" component={ResetPassword} />
```

### forgot-password.tsx

Email form → shows success state after submit. Always shows success (mirrors anti-enumeration). Link back to `/login`.

Key: `fetch("/api/clients/forgot-password", { method: "POST", ... })` — absolute path, no base prefix needed.

### reset-password.tsx

Reads token from query string:
```typescript
import { useSearch } from "wouter";
const search = useSearch();
const token = new URLSearchParams(search).get("token") ?? "";
```

Shows "Invalid reset link" if token is empty. On success: green check + "Sign In" button → `/login`. On expired token error: link to `/forgot-password` to request a new one.

### "Forgot password?" link on login page

Add inline with the Password label (right-aligned):
```tsx
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
  <label htmlFor="password">Password</label>
  <Link href="/forgot-password" style={{ fontSize: 12, color: ACCENT, fontWeight: 500 }}>Forgot password?</Link>
</div>
```

## Key decisions

- Token is 32 random bytes as hex (64 chars) — cryptographically secure, no JWT needed
- 1-hour expiry stored in DB alongside token
- Token is cleared on successful reset (single-use)
- Rate limiter shared across both endpoints (5 requests / 15 min)
- Reset URL uses `REPLIT_DEV_DOMAIN` env var for both dev and production on Replit
