---
name: stripe-webhook-raw-body
description: Correctly preserve and verify Stripe webhook signatures in Express. Use when adding or debugging a Stripe webhook endpoint. Covers the raw body preservation pattern, the hard guard against JSON re-serialization fallback, and the correct constructEvent call.
---

# Stripe Webhook Raw Body Pattern

## The problem

Stripe webhook signature verification (`stripe.webhooks.constructEvent`) requires the **exact raw bytes** of the request body. Express's `express.json()` middleware parses the body and discards the original bytes. If you call `constructEvent` with re-serialized JSON (`JSON.stringify(req.body)`), the signature will always fail because:
- JSON key order may differ
- Whitespace is not preserved
- Numbers may be formatted differently

A common but broken pattern:
```typescript
// ❌ WRONG — JSON.stringify(req.body) never matches the original bytes
event = stripe.webhooks.constructEvent(
  rawBody ?? Buffer.from(JSON.stringify(req.body)),  // fallback always fails
  sig,
  webhookSecret
);
```

## Fix: preserve raw body in the json middleware verify callback

In `app.ts` / server setup, capture the raw body before parsing:

```typescript
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf: Buffer) => {
      req.rawBody = buf;   // store raw bytes before parsing
    },
  }),
);
```

Extend the `Request` type if needed:
```typescript
// In the route file or a types file
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}
```

## Fix: hard guard in the webhook handler — no fallback

In the webhook route, guard before constructEvent. If rawBody is missing, the signature cannot be verified — fail hard:

```typescript
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    // This means express.json() verify callback was not set up correctly.
    // Fail immediately — do not fall back to re-serialized JSON.
    res.status(400).json({ error: "Raw request body unavailable — cannot verify webhook signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: `Webhook signature verification failed: ${msg}` });
    return;
  }

  // handle event...
});
```

## Development fallback (when webhookSecret is not set)

In development you may not have a webhook secret. Gate the raw body check on whether `webhookSecret` is configured:

```typescript
if (webhookSecret) {
  // full verification path — rawBody guard + constructEvent
  ...
} else {
  // dev-only: trust the body as-is, no signature check
  event = req.body as Stripe.Event;
}
```

## Webhook route mount order matters

The webhook route must be mounted **before** any body-parsing middleware if you want to use a different approach (e.g. `express.raw()`). The `verify` callback approach (above) is preferred because it works with the single middleware chain.

## Reference implementation

`artifacts/api-server/src/routes/payments.ts` — `POST /webhook` handler  
`artifacts/api-server/src/app.ts` — `express.json({ verify: ... })` setup
