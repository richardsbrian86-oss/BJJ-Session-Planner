---
name: stripe-secrets-recovery
description: Diagnose and fix Stripe "not configured" errors in the Let's Roll API server. Use when /api/public/stripe-key returns 503, payment flows return "Stripe is not configured", the Replit Stripe connector stops serving credentials, or after adding/changing STRIPE_SECRET_KEY or STRIPE_PUBLISHABLE_KEY secrets. Covers connector re-binding, key format validation, both-keys requirement, and restart timing.
---

# Stripe Secrets Recovery

## When to Use

- `GET /api/public/stripe-key` returns `{"error":"Stripe is not configured"}`
- Payment intent or subscription endpoints return 503
- API logs show `"Stripe development connection not found"` or `"Stripe connector unavailable — falling back to environment variables"`
- After adding or rotating Stripe secrets in Replit
- After a `proposeIntegration` for the Stripe connector

---

## How Stripe Credentials Are Resolved

The API server (`artifacts/api-server/src/lib/stripe.ts`) tries two sources in order:

1. **Replit Stripe connector** — fetches live credentials from the connector proxy (`REPLIT_CONNECTORS_HOSTNAME`). Switches test↔live based on `REPLIT_DEPLOYMENT`. No manual key management needed when working.
2. **Environment variable fallback** — reads `STRIPE_SECRET_KEY` (server ops) and `STRIPE_PUBLISHABLE_KEY` (serving `/api/public/stripe-key` to clients). **Both must be set** for the public key endpoint to work — setting only the secret key is not enough.

**Critical:** The `/api/public/stripe-key` endpoint calls `getStripePublishableKey()` which throws if `STRIPE_PUBLISHABLE_KEY` is null, even when `STRIPE_SECRET_KEY` is valid.

---

## Diagnostic Steps

### Step 1 — Check what the live process actually has

```bash
NEW_PID=$(pgrep -f "dist/index.mjs" | head -1)
cat /proc/$NEW_PID/environ | tr '\0' '\n' | grep -i stripe | sed 's/=.*/=.../' 
```

This shows which STRIPE_* keys exist in the running process without revealing full values. If any key is missing here, the process started before the secret was saved — restart the workflow.

### Step 2 — Validate key format

Peek at the first ~15 chars of the value:

```bash
cat /proc/$NEW_PID/environ | tr '\0' '\n' | grep "STRIPE_SECRET_KEY" | sed 's/STRIPE_SECRET_KEY=//' | cut -c1-15
```

Valid formats:
- Secret key: `sk_test_51...` or `sk_live_51...`
- Publishable key: `pk_test_51...` or `pk_live_51...`

**Wrong formats to watch for:**
- `sk-proj-...` — this is an **OpenAI** key, not Stripe
- `rk_...` — Stripe restricted key (won't work for most ops)
- `whsec_...` — that's the webhook secret, wrong field

### Step 3 — Test the endpoint

```bash
curl -s http://localhost:8080/api/public/stripe-key
```

Expected success: `{"publishableKey":"pk_test_51..."}`

---

## Fix Paths

### Path A — Connector binding is stale (listConnections returns empty)

The Replit Stripe connector can show `status: added` in `searchIntegrations` but still fail at runtime. This means the credential proxy isn't bound to this Repl's dev environment.

```javascript
// In code_execution:
const results = await searchIntegrations("stripe");
// If status is "added":
await addIntegration("connection:conn_stripe_...");   // re-wires code side
await proposeIntegration("connection:conn_stripe_..."); // re-binds platform side
```

If `proposeIntegration` succeeds but `listConnections('stripe')` still returns `[]` after restart, the connector proxy isn't recovering — move to Path B.

### Path B — Set secrets directly (reliable fallback)

1. Go to **Replit → Tools → Secrets**
2. Set `STRIPE_SECRET_KEY` → value from [dashboard.stripe.com → Developers → API Keys → Secret key](https://dashboard.stripe.com/apikeys)
3. Set `STRIPE_PUBLISHABLE_KEY` → value from the same page (Publishable key)
4. Wait for the Replit confirmation message before restarting
5. Restart the API server workflow **after** confirmation

---

## Restart Timing — Critical Rule

**Always wait for the Replit "secrets have been added" confirmation before restarting any workflow.**

Restarting before the secret is fully saved means the new process inherits the old (wrong) value. The confirmation message looks like:
> "The following secrets have been added to Replit Secrets. They are available as environment variables: STRIPE_SECRET_KEY"

Only after seeing this should you call `restart_workflow` for the API server.

---

## After Fixing

Verify with:
```bash
curl -s http://localhost:8080/api/public/stripe-key
# Expected: {"publishableKey":"pk_test_51..."}
```

Also confirm in logs that the connector fallback warning is gone or that the env var path succeeded silently.

`STRIPE_WEBHOOK_SECRET` (starts with `whsec_...`) is separate and not affected by these steps — it was already configured and controls webhook signature verification only.
