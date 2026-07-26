import { Router } from "express";
import type { Request, Response } from "express";
import { db, instructorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireInstructor } from "../lib/auth";
import { instructorLimiter } from "../lib/rateLimiters";
import { tryGetStripeClient } from "../lib/stripe";

const router = Router();

function getBaseUrl(req: Request): string {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? req.protocol);
  const host = req.headers["x-forwarded-host"] ?? req.get("host");
  return `${proto}://${host}`;
}

router.post("/onboard", requireInstructor, instructorLimiter, async (req: Request, res: Response) => {
  const stripe = await tryGetStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }

  const [instructor] = await db
    .select({ id: instructorsTable.id, stripeAccountId: instructorsTable.stripeAccountId })
    .from(instructorsTable)
    .where(eq(instructorsTable.id, req.instructorId!))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  let accountId = instructor.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({ type: "express" });
    accountId = account.id;
    await db
      .update(instructorsTable)
      .set({ stripeAccountId: accountId })
      .where(eq(instructorsTable.id, instructor.id));
  }

  const baseUrl = getBaseUrl(req);
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/api/instructor/connect/refresh`,
    return_url: `${baseUrl}/api/instructor/connect/return`,
    type: "account_onboarding",
  });

  res.json({ url: accountLink.url });
});

router.get("/status", requireInstructor, instructorLimiter, async (req: Request, res: Response) => {
  const stripe = await tryGetStripeClient();

  const [instructor] = await db
    .select({
      stripeAccountId: instructorsTable.stripeAccountId,
      stripeAccountEnabled: instructorsTable.stripeAccountEnabled,
    })
    .from(instructorsTable)
    .where(eq(instructorsTable.id, req.instructorId!))
    .limit(1);

  if (!instructor?.stripeAccountId || !stripe) {
    res.json({ connected: false, chargesEnabled: false, payoutsEnabled: false });
    return;
  }

  const account = await stripe.accounts.retrieve(instructor.stripeAccountId);

  if (account.charges_enabled !== instructor.stripeAccountEnabled) {
    await db
      .update(instructorsTable)
      .set({ stripeAccountEnabled: account.charges_enabled ?? false })
      .where(eq(instructorsTable.id, req.instructorId!));
  }

  res.json({
    connected: true,
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  });
});

router.get("/return", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stripe Connected — Let's Roll</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0A0A0D; color: #fff; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 380px; text-align: center; }
    .icon { width: 72px; height: 72px; background: #E8253D18; border: 1px solid #E8253D40;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            margin: 0 auto 24px; font-size: 32px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { color: #888; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Stripe Connected!</h1>
    <p>Your payment account is set up. Close this tab and return to the Let's Roll app — your Stripe status will update automatically.</p>
  </div>
</body>
</html>`);
});

router.get("/refresh", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Expired — Let's Roll</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0A0A0D; color: #fff; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 380px; text-align: center; }
    .icon { width: 72px; height: 72px; background: #FF950018; border: 1px solid #FF950040;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            margin: 0 auto 24px; font-size: 32px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { color: #888; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">↩</div>
    <h1>Link Expired</h1>
    <p>Return to the Let's Roll app and tap <strong>Connect Stripe</strong> again to get a fresh link.</p>
  </div>
</body>
</html>`);
});

export default router;
