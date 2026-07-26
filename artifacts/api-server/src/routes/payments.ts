import { Router } from "express";
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { db, sessionsTable, servicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireInstructor } from "../lib/auth";
import { tryGetStripeClient } from "../lib/stripe";
import { logger } from "../lib/logger";
import rateLimit from "express-rate-limit";
import { applyPaymentIntentSucceeded, applyInvoicePaid } from "../lib/paymentService";

const router = Router();

const ALLOWED_CURRENCIES = new Set([
  "usd", "eur", "gbp", "cad", "aud", "jpy", "chf", "nzd",
]);

const paymentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  // requireInstructor always runs before this limiter, so instructorId is guaranteed.
  // Keying by instructorId (not IP) lets each instructor have their own bucket.
  keyGenerator: (req) => String(req.instructorId!),
  message: { error: "Too many payment requests. Please try again later." },
});

router.post("/create-intent", requireInstructor, paymentLimiter, async (req: Request, res: Response) => {
  const stripe = await tryGetStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const { sessionId, currency } = req.body as {
    sessionId?: number;
    currency?: string;
  };

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const normalizedCurrency = String(currency ?? "usd").toLowerCase();
  if (!ALLOWED_CURRENCIES.has(normalizedCurrency)) {
    res.status(400).json({
      error: `Invalid currency "${normalizedCurrency}". Allowed values: ${[...ALLOWED_CURRENCIES].join(", ")}`,
    });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, Number(sessionId)),
        eq(sessionsTable.instructorId, req.instructorId!)
      )
    )
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  let amount: number;
  if (session.packageCount != null && session.packageTotal != null) {
    amount = Math.round(session.packageTotal ?? session.servicePrice);
  } else {
    amount = session.servicePrice;
  }

  if (amount <= 0) {
    res.status(400).json({ error: "Session has no chargeable amount" });
    return;
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: normalizedCurrency,
    description: `${session.serviceName} for ${session.clientName}`,
    metadata: {
      sessionId: String(session.id),
      instructorId: String(req.instructorId),
    },
  });

  await db
    .update(sessionsTable)
    .set({ paymentIntentId: paymentIntent.id })
    .where(
      and(
        eq(sessionsTable.id, session.id),
        eq(sessionsTable.instructorId, req.instructorId!)
      )
    );

  logger.info(
    { sessionId: session.id, paymentIntentId: paymentIntent.id, amount, currency: normalizedCurrency },
    "PaymentIntent created"
  );

  res.json({ clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
});

router.post("/create-subscription", requireInstructor, paymentLimiter, async (req: Request, res: Response) => {
  const stripe = await tryGetStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const { email, serviceId, sessionId, interval = "monthly" } = req.body as {
    email?: string;
    serviceId?: number;
    sessionId?: number;
    interval?: "weekly" | "monthly";
  };

  if (!email || !serviceId || !sessionId) {
    res.status(400).json({ error: "email, serviceId, and sessionId are required" });
    return;
  }

  const [service] = await db
    .select()
    .from(servicesTable)
    .where(
      and(
        eq(servicesTable.id, Number(serviceId)),
        eq(servicesTable.instructorId, req.instructorId!)
      )
    )
    .limit(1);

  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, Number(sessionId)),
        eq(sessionsTable.instructorId, req.instructorId!)
      )
    )
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const stripeInterval: Stripe.PriceCreateParams.Recurring.Interval =
    interval === "weekly" ? "week" : "month";

  const customers = await stripe.customers.list({ email, limit: 1 });
  let customer: Stripe.Customer;
  if (customers.data.length > 0) {
    customer = customers.data[0];
  } else {
    customer = await stripe.customers.create({ email });
  }

  let priceId: string;
  if (service.stripePriceId) {
    priceId = service.stripePriceId;
  } else {
    const price = await stripe.prices.create({
      unit_amount: service.price,
      currency: "usd",
      recurring: { interval: stripeInterval },
      product_data: { name: service.name },
    });
    priceId = price.id;
    await db
      .update(servicesTable)
      .set({ stripePriceId: priceId })
      .where(
        and(
          eq(servicesTable.id, service.id),
          eq(servicesTable.instructorId, req.instructorId!)
        )
      );
  }

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice", "pending_setup_intent"],
  });

  await db
    .update(sessionsTable)
    .set({ subscriptionId: subscription.id })
    .where(
      and(
        eq(sessionsTable.id, session.id),
        eq(sessionsTable.instructorId, req.instructorId!)
      )
    );

  let clientSecret: string | null = null;

  const latestInvoice = subscription.latest_invoice;
  if (latestInvoice && typeof latestInvoice !== "string") {
    if (latestInvoice.confirmation_secret?.client_secret) {
      clientSecret = latestInvoice.confirmation_secret.client_secret;
    }
  }

  if (!clientSecret) {
    const psi = subscription.pending_setup_intent;
    if (psi && typeof psi !== "string") {
      clientSecret = psi.client_secret;
    }
  }

  logger.info(
    { sessionId: session.id, subscriptionId: subscription.id, hasClientSecret: clientSecret !== null },
    "Subscription created"
  );

  res.json({
    subscriptionId: subscription.id,
    clientSecret,
  });
});

router.post("/webhook", async (req: Request, res: Response) => {
  const stripe = await tryGetStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET is not set — all webhook events will be rejected");
    res.status(503).json({ error: "Webhook secret is not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: "Raw request body unavailable — cannot verify webhook signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.warn({ err: msg }, "Webhook signature verification failed");
    res.status(400).json({ error: `Webhook signature verification failed: ${msg}` });
    return;
  }

  logger.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.id) {
          await applyPaymentIntentSucceeded(pi.id);
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subObj = invoice.parent?.subscription_details?.subscription;
        const subId =
          subObj == null
            ? null
            : typeof subObj === "string"
              ? subObj
              : subObj.id;
        if (subId) {
          await applyInvoicePaid(subId);
        }
        break;
      }
      default:
        logger.info({ eventType: event.type }, "Unhandled Stripe webhook event (ignored)");
        break;
    }
  } catch (err: unknown) {
    logger.error({ err, eventType: event.type }, "Error processing webhook event");
    res.status(500).json({ error: "Internal error processing webhook" });
    return;
  }

  res.json({ received: true });
});

export default router;
