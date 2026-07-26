/**
 * paymentService — handles the database side-effects of Stripe payment events.
 *
 * Extracted from the webhook route so the logic can be unit/integration tested
 * independently of HTTP concerns and Stripe signature verification.
 *
 * Events handled:
 *   payment_intent.succeeded  → marks session(s) matching paymentIntentId as paid
 *   invoice.paid              → marks session(s) matching subscriptionId as paid
 */
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Mark all sessions whose paymentIntentId matches as paid.
 * Returns the number of sessions updated.
 */
export async function applyPaymentIntentSucceeded(
  paymentIntentId: string
): Promise<number> {
  const result = await db
    .update(sessionsTable)
    .set({ paymentStatus: "paid" })
    .where(eq(sessionsTable.paymentIntentId, paymentIntentId))
    .returning({ id: sessionsTable.id });

  logger.info(
    { paymentIntentId, sessionsUpdated: result.length },
    "Session(s) marked paid via payment_intent.succeeded"
  );

  return result.length;
}

/**
 * Mark all sessions whose subscriptionId matches as paid.
 * Returns the number of sessions updated.
 */
export async function applyInvoicePaid(
  subscriptionId: string
): Promise<number> {
  const result = await db
    .update(sessionsTable)
    .set({ paymentStatus: "paid" })
    .where(eq(sessionsTable.subscriptionId, subscriptionId))
    .returning({ id: sessionsTable.id });

  logger.info(
    { subscriptionId, sessionsUpdated: result.length },
    "Session(s) marked paid via invoice.paid"
  );

  return result.length;
}
