import app from "./app";
import { logger } from "./lib/logger";
import { startAuthFailureCleanup } from "./lib/authAudit";
import { startCrossAccountArchiver } from "./lib/crossAccountArchiver";
import { isWebhookSecretConfigured } from "./lib/stripe";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// Safety nets — log unexpected errors instead of crashing.
// The pg-pool 'error' handler in lib/db covers the primary crash vector;
// these catch anything else that slips through.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — process will continue");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function backfillCancellationTokens() {
  try {
    const result = await db.execute(
      sql`UPDATE sessions SET cancellation_token = gen_random_uuid() WHERE cancellation_token IS NULL`
    );
    const count = (result as { rowCount?: number }).rowCount ?? 0;
    if (count === 0) {
      logger.info("Cancellation token backfill: all sessions already have tokens");
    } else {
      logger.info({ count }, "Cancellation token backfill: updated sessions");
    }
  } catch (err) {
    logger.error({ err }, "Cancellation token backfill failed — non-fatal");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Archive cross-account windows BEFORE starting the auth-failure cleanup so
  // the startup cleanup pass does not delete expired rows before they are
  // captured in cross_account_history.
  startCrossAccountArchiver()
    .then(() => startAuthFailureCleanup())
    .catch((err) => {
      logger.error({ err }, "Cross-account archiver startup failed — starting cleanup anyway");
      startAuthFailureCleanup();
    });
  void backfillCancellationTokens();

  if (isWebhookSecretConfigured()) {
    logger.info("Stripe webhook secret is configured — signature verification enabled");
  } else {
    logger.warn("STRIPE_WEBHOOK_SECRET is not set — webhook signature verification will be disabled");
  }
});
