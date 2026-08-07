import { Router } from "express";
import { requireInstructor } from "../lib/auth";
import { instructorLimiter } from "../lib/rateLimiters";
import type Stripe from "stripe";
import { tryGetStripeClient } from "../lib/stripe";
import { logger } from "../lib/logger";

const router = Router();

router.use(requireInstructor);
router.use(instructorLimiter);

/**
 * POST /api/admin/stripe-webhook
 *
 * One-time setup: registers the Stripe webhook endpoint so that payment events
 * (payment_intent.succeeded, invoice.paid) are delivered to this server and
 * sessions are automatically marked as paid.
 *
 * On success, the response contains `signingSecret` (starts with whsec_).
 * Save that value as the STRIPE_WEBHOOK_SECRET secret in Replit Secrets.
 *
 * Safe to call multiple times — if the URL is already registered it returns
 * the existing endpoint details (without the secret, which Stripe only reveals
 * at creation time; delete and re-create if you need a fresh secret).
 *
 * Optional request body:
 *   { "url": "https://your-domain.replit.app/api/payments/webhook" }
 * If omitted, the URL is derived from the REPLIT_DOMAINS env var.
 */
router.post("/stripe-webhook", async (req, res) => {
  const stripe = await tryGetStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const deployedDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  const deployedDomain = deployedDomains[0] ?? null;
  const defaultUrl = deployedDomain ? `https://${deployedDomain}/api/payments/webhook` : null;
  const webhookUrl = (typeof req.body?.url === "string" && req.body.url.length > 0)
    ? req.body.url as string
    : defaultUrl;

  if (!webhookUrl) {
    res.status(400).json({
      error: "Could not determine webhook URL. Either REPLIT_DOMAINS is not set or pass { url } in the request body.",
      example: "https://bjj-session-planner.replit.app/api/payments/webhook",
    });
    return;
  }

  const REQUIRED_EVENTS = ["payment_intent.succeeded", "invoice.paid"] as const;

  try {
    const existing = await stripe.webhookEndpoints.list({ limit: 100 });
    const match = existing.data.find((ep) => ep.url === webhookUrl);

    if (match) {
      const missingEvents = REQUIRED_EVENTS.filter(
        (e) => !match.enabled_events.includes(e)
      );

      if (missingEvents.length > 0) {
        const updated = await stripe.webhookEndpoints.update(match.id, {
          enabled_events: [
            ...new Set([...match.enabled_events, ...REQUIRED_EVENTS]),
          ] as Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
        });
        logger.info(
          { webhookId: updated.id, addedEvents: missingEvents },
          "Stripe webhook updated — added missing events"
        );
        res.json({
          alreadyExists: true,
          updated: true,
          id: updated.id,
          url: updated.url,
          status: updated.status,
          enabledEvents: updated.enabled_events,
          note: "Webhook already existed but was missing required events — they have been added. Stripe only reveals the signing secret at creation time. If you need a new secret, delete this endpoint in the Stripe Dashboard (Developers → Webhooks) and call this API again.",
        });
      } else {
        logger.info({ webhookId: match.id, url: match.url }, "Stripe webhook already registered with correct events");
        res.json({
          alreadyExists: true,
          updated: false,
          id: match.id,
          url: match.url,
          status: match.status,
          enabledEvents: match.enabled_events,
          note: "Webhook already registered with all required events. Stripe only reveals the signing secret at creation time. If you need a new secret, delete this endpoint in the Stripe Dashboard (Developers → Webhooks) and call this API again.",
        });
      }
      return;
    }

    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [...REQUIRED_EVENTS],
    });

    logger.info({ webhookId: endpoint.id, url: endpoint.url }, "Stripe webhook registered");

    res.json({
      alreadyExists: false,
      id: endpoint.id,
      url: endpoint.url,
      status: endpoint.status,
      enabledEvents: endpoint.enabled_events,
      signingSecret: endpoint.secret,
      nextStep: "Copy the signingSecret value (starts with whsec_) and save it as the STRIPE_WEBHOOK_SECRET secret in Replit Secrets (Tools → Secrets).",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err, webhookUrl }, "Failed to register Stripe webhook");
    res.status(500).json({ error: `Failed to register Stripe webhook: ${msg}` });
  }
});

export default router;
