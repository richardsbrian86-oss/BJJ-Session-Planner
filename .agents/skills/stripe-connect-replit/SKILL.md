---
name: stripe-connect-replit
description: Set up Stripe Connect for per-instructor (or per-user) payouts on a Replit project using the Replit Stripe connector — no manual STRIPE_SECRET_KEY needed. Use when building a marketplace/platform where sub-accounts need to receive payments.
---

# Stripe Connect on Replit

## How it works

Replit's Stripe connector provides an authenticated Stripe client via the integrations system — no `STRIPE_SECRET_KEY` env var needed. Each instructor (or seller) gets a Stripe Express account. Payments route directly to their bank via `transfer_data.destination`.

## Prerequisites

The Replit Stripe integration must be installed (check `.local/skills/integrations/`). Do NOT set `STRIPE_SECRET_KEY` manually — the connector manages credentials.

## Getting the Stripe client

```typescript
// lib/stripe.ts
import { getStripeClient } from "@replit/agent-integrations/stripe";

export async function tryGetStripeClient() {
  try {
    return await getStripeClient();
  } catch {
    return null;
  }
}
```

## DB schema additions

```typescript
// In instructorsTable (Drizzle)
stripeAccountId: text("stripe_account_id"),
stripeAccountEnabled: boolean("stripe_account_enabled").default(false),
```

Run: `pnpm --filter @workspace/db run push`

## Connect onboarding routes

```typescript
// routes/connect.ts
import { Router } from "express";
import { requireInstructor } from "../lib/auth";
import { tryGetStripeClient } from "../lib/stripe";
import { db, instructorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
router.use(requireInstructor);

// Start onboarding — returns a URL the instructor opens in browser
router.post("/onboard", async (req, res) => {
  const stripe = await tryGetStripeClient();
  if (!stripe) return res.status(503).json({ error: "Stripe unavailable" });

  const [instructor] = await db.select()
    .from(instructorsTable)
    .where(eq(instructorsTable.id, req.instructorId!))
    .limit(1);

  let accountId = instructor.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "express" });
    accountId = account.id;
    await db.update(instructorsTable)
      .set({ stripeAccountId: accountId })
      .where(eq(instructorsTable.id, req.instructorId!));
  }

  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/api/instructor/connect/refresh`,
    return_url: `${origin}/api/instructor/connect/return`,
    type: "account_onboarding",
  });

  res.json({ url: link.url });
});

// Check status
router.get("/status", async (req, res) => {
  const stripe = await tryGetStripeClient();
  const [instructor] = await db.select()
    .from(instructorsTable)
    .where(eq(instructorsTable.id, req.instructorId!))
    .limit(1);

  if (!instructor.stripeAccountId || !stripe) {
    return res.json({ connected: false });
  }

  const account = await stripe.accounts.retrieve(instructor.stripeAccountId);
  const enabled = account.charges_enabled && account.payouts_enabled;

  await db.update(instructorsTable)
    .set({ stripeAccountEnabled: enabled })
    .where(eq(instructorsTable.id, req.instructorId!));

  res.json({ connected: true, enabled, accountId: instructor.stripeAccountId });
});

export default router;
```

## Routing payments to the instructor's account

Always fetch `stripeAccountId` and `stripeAccountEnabled` alongside the instructor lookup, then conditionally add `transfer_data`:

### One-time payment intent

```typescript
const intentParams: Stripe.PaymentIntentCreateParams = {
  amount: Math.round(price * 100),
  currency: "usd",
  // ...
};
if (instructor.stripeAccountId && instructor.stripeAccountEnabled) {
  intentParams.transfer_data = { destination: instructor.stripeAccountId };
}
const intent = await stripe.paymentIntents.create(intentParams);
```

### Subscription

```typescript
const subscriptionParams: Stripe.SubscriptionCreateParams = {
  customer: customerId,
  items: [{ price: priceId }],
  // ...
};
if (instructor.stripeAccountId && instructor.stripeAccountEnabled) {
  subscriptionParams.transfer_data = { destination: instructor.stripeAccountId };
}
const subscription = await stripe.subscriptions.create(subscriptionParams);
```

> **Important:** Add `transfer_data` to BOTH payment intents and subscriptions. It's easy to add it to one and forget the other.

## Mobile UI pattern

```typescript
// Fetch status on mount
const status = await api.connect.getStatus();

// Show connect button if not yet connected
if (!status.connected) {
  return <Button onPress={async () => {
    const { url } = await api.connect.onboard();
    Linking.openURL(url); // opens Stripe's hosted onboarding
  }}>Connect Stripe Account</Button>;
}

// Show status badge when connected
return status.enabled
  ? <Badge color="green">Payouts Active</Badge>
  : <Badge color="yellow">Verification Pending</Badge>;
```

## Webhook secret

Set `STRIPE_WEBHOOK_SECRET` as a Replit secret. Use `req.rawBody` (set in express.json verify callback) for signature verification:

```typescript
const event = stripe.webhooks.constructEvent(
  req.rawBody!, 
  req.headers["stripe-signature"]!, 
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

## Publishable key endpoint

Clients need the publishable key without hardcoding it:

```typescript
router.get("/stripe-key", async (_req, res) => {
  const stripe = await tryGetStripeClient();
  if (!stripe) return res.status(503).json({ error: "Stripe unavailable" });
  // The publishable key is available from the integration config
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "" });
});
```
