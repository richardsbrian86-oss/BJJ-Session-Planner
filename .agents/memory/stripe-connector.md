---
name: Stripe Replit Connector Wiring
description: How the Replit Stripe integration is wired into the API server and all clients.
---

## The Rule
Never read `STRIPE_SECRET_KEY` or `STRIPE_PUBLISHABLE_KEY` env vars directly. Use the Replit connector helper functions from `artifacts/api-server/src/lib/stripe.ts`.

**Why:** The Replit Stripe connector auto-rotates credentials and switches between test (development) and production keys based on `REPLIT_DEPLOYMENT`. Manual env vars would break this.

**How to apply:** Import from `../lib/stripe` in any api-server route that needs Stripe.

## Key exports from `artifacts/api-server/src/lib/stripe.ts`
- `getUncachableStripeClient()` — fresh Stripe instance (never cache)
- `tryGetStripeClient()` — returns `null` instead of throwing (use in routes where Stripe is optional)
- `getStripePublishableKey()` — for serving to clients
- `isStripeConfigured()` — boolean check (used in profile endpoint's `stripeEnabled` field)

## Publishable Key Delivery
All clients fetch the key from `GET /api/public/stripe-key` at runtime — NOT from env vars:
- **Client portal:** `booking-flow.tsx` fetches on mount via `useEffect`, passes `stripePromise` down; `client-details.tsx` checks `stripePromise !== null`
- **Mobile:** `api.public.getStripeKey()` in `apiClient.ts`; `ClientBookingFlow.tsx` and `ConditionalStripeProvider.native.tsx` fetch on mount

## What still needs env var
`STRIPE_WEBHOOK_SECRET` — must be set manually from the Stripe dashboard webhook endpoint config (value starts with `whsec_...`). The webhook handler in `payments.ts` reads this from `process.env.STRIPE_WEBHOOK_SECRET`. In development it's optional (skips signature verification).

## Stripe package version
`stripe@^22.0.2` is installed in `artifacts/api-server`. Do NOT downgrade to stripe@20 — v22-specific types are used throughout (`confirmation_secret`, `parent.subscription_details`, etc.).

## Connector Binding Can Go Stale
The Replit Stripe connector (`conn_stripe_...`) can show `status: added` in `searchIntegrations` but return `[]` from `listConnections` and fail at runtime with "Stripe development connection not found". `proposeIntegration` re-binds but may not resolve it. If `listConnections` still returns empty after re-binding, fall back to direct secrets (see stripe-secrets-recovery skill).

## Both Keys Required for /api/public/stripe-key
`getStripePublishableKey()` throws if `STRIPE_PUBLISHABLE_KEY` is null — even when `STRIPE_SECRET_KEY` is valid. Both must be set in Replit Secrets for the public endpoint to work.

## Key Format Validation
- Stripe secret key: `sk_test_51...` or `sk_live_51...`
- Stripe publishable key: `pk_test_51...` or `pk_live_51...`
- OpenAI keys (`sk-proj-...`) have been mistakenly entered in place of Stripe keys — always verify prefix in process env before diagnosing further.

## Restart Timing
Always wait for Replit's "secrets have been added" confirmation message before restarting workflows. Restarting before the secret is saved means the process inherits the old value.
