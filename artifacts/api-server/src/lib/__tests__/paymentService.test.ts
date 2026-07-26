/**
 * Integration tests for paymentService — the DB-update layer that runs when
 * Stripe delivers payment events to /api/payments/webhook.
 *
 * These tests hit the real (dev) database, proving the full path:
 *   Stripe event arrives → paymentStatus transitions to "paid"
 *
 * Run with: pnpm --filter @workspace/api-server test
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { applyPaymentIntentSucceeded, applyInvoicePaid } from "../paymentService";

// Uses instructor that already exists in the dev DB (seeded).
const TEST_INSTRUCTOR_ID = 6;

// Use unique sentinel values so parallel test runs and real data don't collide.
const TEST_PI_ID = `pi_test_paymentservice_${Date.now()}`;
const TEST_SUB_ID = `sub_test_paymentservice_${Date.now()}`;

let testSessionId: number | null = null;
let testSubSessionId: number | null = null;

async function insertTestSession(overrides: {
  paymentIntentId?: string;
  subscriptionId?: string;
}): Promise<number> {
  const [row] = await db
    .insert(sessionsTable)
    .values({
      instructorId: TEST_INSTRUCTOR_ID,
      clientName: "Test Client (webhook integration)",
      date: "2099-01-01",
      time: "10:00",
      serviceName: "Test Service",
      ...overrides,
    })
    .returning({ id: sessionsTable.id });
  return row.id;
}

async function getPaymentStatus(id: number): Promise<string | null> {
  const [row] = await db
    .select({ paymentStatus: sessionsTable.paymentStatus })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, id));
  return row?.paymentStatus ?? null;
}

async function deleteTestSession(id: number) {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
}

describe("paymentService — DB transitions when Stripe events arrive", () => {
  afterEach(async () => {
    if (testSessionId != null) {
      await deleteTestSession(testSessionId);
      testSessionId = null;
    }
    if (testSubSessionId != null) {
      await deleteTestSession(testSubSessionId);
      testSubSessionId = null;
    }
  });

  it("marks a session as paid when payment_intent.succeeded fires", async () => {
    testSessionId = await insertTestSession({ paymentIntentId: TEST_PI_ID });

    // Confirm initial state
    expect(await getPaymentStatus(testSessionId)).toBe("pending");

    const updated = await applyPaymentIntentSucceeded(TEST_PI_ID);

    expect(updated).toBe(1);
    expect(await getPaymentStatus(testSessionId)).toBe("paid");
  });

  it("marks a session as paid when invoice.paid fires", async () => {
    testSubSessionId = await insertTestSession({ subscriptionId: TEST_SUB_ID });

    expect(await getPaymentStatus(testSubSessionId)).toBe("pending");

    const updated = await applyInvoicePaid(TEST_SUB_ID);

    expect(updated).toBe(1);
    expect(await getPaymentStatus(testSubSessionId)).toBe("paid");
  });

  it("returns 0 and leaves DB unchanged for unknown paymentIntentId", async () => {
    const updated = await applyPaymentIntentSucceeded("pi_nonexistent_sentinel");
    expect(updated).toBe(0);
  });

  it("returns 0 and leaves DB unchanged for unknown subscriptionId", async () => {
    const updated = await applyInvoicePaid("sub_nonexistent_sentinel");
    expect(updated).toBe(0);
  });
});
