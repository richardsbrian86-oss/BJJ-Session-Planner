import Stripe from "stripe";
import { logger } from "./logger";

type Credentials = { secretKey: string; publishableKey: string | null };

async function getCredentialsFromConnector(): Promise<{ secretKey: string; publishableKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Replit connector environment not available");
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = (await response.json()) as {
    items?: Array<{ settings: { publishable?: string; secret?: string } }>;
  };

  const settings = data.items?.[0]?.settings;

  if (!settings?.publishable || !settings?.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    secretKey: settings.secret,
    publishableKey: settings.publishable,
  };
}

/**
 * Returns Stripe credentials.
 *
 * Resolution order:
 *   1. Replit Stripe connector (provides both secret + publishable; auto-rotates; test↔live via REPLIT_DEPLOYMENT)
 *   2. STRIPE_SECRET_KEY env secret (required for server-side operations)
 *      + STRIPE_PUBLISHABLE_KEY env secret (required only for serving the key to clients)
 *
 * Server-side operations (create-intent, create-subscription, webhook) only require the secret key.
 * Serving /api/public/stripe-key to clients requires the publishable key (either source).
 *
 * WARNING: Never cache the result — connector tokens expire on every call.
 */
async function getCredentials(): Promise<Credentials> {
  try {
    return await getCredentialsFromConnector();
  } catch (connectorErr) {
    logger.warn(
      { err: connectorErr instanceof Error ? connectorErr.message : String(connectorErr) },
      "Stripe connector unavailable — falling back to environment variables"
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Stripe is not configured. Set the STRIPE_SECRET_KEY secret, or connect the Replit Stripe integration."
    );
  }

  return {
    secretKey,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
  };
}

// WARNING: Never cache this client. Tokens expire. Call fresh on every request.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns the Stripe publishable key for use by client-side apps.
 * Requires either the Replit connector or both STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY to be set.
 */
export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  if (!publishableKey) {
    throw new Error(
      "Stripe publishable key is not configured. Set the STRIPE_PUBLISHABLE_KEY secret, or connect the Replit Stripe integration."
    );
  }
  return publishableKey;
}

// Returns null instead of throwing — use where Stripe is optional.
export async function tryGetStripeClient(): Promise<Stripe | null> {
  try {
    return await getUncachableStripeClient();
  } catch {
    return null;
  }
}

export async function isStripeConfigured(): Promise<boolean> {
  try {
    await getCredentials();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns whether the Stripe webhook signing secret is configured.
 * The secret (STRIPE_WEBHOOK_SECRET, starting with whsec_...) must match
 * the signing secret of the registered Stripe webhook endpoint:
 *   https://bjj-session-planner.replit.app/api/payments/webhook
 *
 * Events subscribed: payment_intent.succeeded, invoice.paid
 *
 * Without this secret the webhook route returns 503 and Stripe events are ignored.
 */
export function isWebhookSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}
