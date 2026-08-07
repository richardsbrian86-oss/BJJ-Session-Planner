import { Router, type IRouter } from "express";
import { db, instructorsTable, servicesTable, availabilityTable, sessionsTable, waiversTable, clientsTable } from "@workspace/db";
import { and, count, eq, notInArray } from "drizzle-orm";
import type Stripe from "stripe";
import { sendBookingConfirmationEmail, sendInstructorNewBookingEmail, sendClientCancellationConfirmationEmail, sendWaiverConfirmationEmail } from "../lib/email";
import { tryGetStripeClient, getStripePublishableKey, isStripeConfigured } from "../lib/stripe";
import { requireWaiverSigned } from "../lib/waiverCheck";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const publicBookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  message: { error: "Too many requests. Please try again later." },
});

const waiverStatusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  message: { error: "Too many requests. Please try again later." },
  handler(req, res, _next, options) {
    logger.warn({ ip: req.ip, path: req.path }, "Rate limit hit: waiver-status");
    res.status(options.statusCode).json(options.message);
  },
});

const VALID_PACKAGE_COUNTS = new Set([1, 4, 6, 8, 10]);
const PACKAGE_DISCOUNT = 0.2;

function computePackageTotal(unitPrice: number, packageCount: number): number {
  if (!VALID_PACKAGE_COUNTS.has(packageCount)) {
    throw new Error(`Invalid package count: ${packageCount}. Must be one of 1, 4, 6, 8, 10.`);
  }
  const subtotal = unitPrice * packageCount;
  const discount = packageCount > 1 ? subtotal * PACKAGE_DISCOUNT : 0;
  return Math.round(subtotal - discount);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns the Stripe publishable key for use by client-side apps.
router.get("/stripe-key", async (_req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch {
    res.status(503).json({ error: "Stripe is not configured" });
  }
});

router.get("/booking/:token", async (req, res) => {
  const { token } = req.params;

  if (!UUID_RE.test(token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.cancellationToken, token))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const [instructor] = await db
    .select({ id: instructorsTable.id, name: instructorsTable.name, slug: instructorsTable.slug })
    .from(instructorsTable)
    .where(eq(instructorsTable.id, session.instructorId))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  res.json({
    session: {
      id: session.id,
      date: session.date,
      time: session.time,
      status: session.status,
      serviceName: session.serviceName,
      servicePrice: session.servicePrice,
      packageCount: session.packageCount,
      packageTotal: session.packageTotal,
      clientName: session.clientName,
      notes: session.notes,
      createdAt: session.createdAt,
    },
    instructor: {
      name: instructor.name,
      slug: instructor.slug,
    },
  });
});

router.delete("/booking/:token", async (req, res) => {
  const { token } = req.params;

  if (!UUID_RE.test(token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.cancellationToken, token))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  if (session.status === "cancelled") {
    res.status(409).json({ error: "This booking is already cancelled." });
    return;
  }

  if (session.status === "completed") {
    res.status(409).json({ error: "Completed sessions cannot be cancelled." });
    return;
  }

  await db
    .update(sessionsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(sessionsTable.id, session.id));

  if (session.clientEmail) {
    const [instructor] = await db
      .select({ name: instructorsTable.name })
      .from(instructorsTable)
      .where(eq(instructorsTable.id, session.instructorId))
      .limit(1);

    void sendClientCancellationConfirmationEmail({
      to: session.clientEmail,
      clientName: session.clientName ?? "there",
      instructorName: instructor?.name ?? "your instructor",
      serviceName: session.serviceName ?? "Session",
      date: session.date,
      time: session.time,
    });
  }

  res.json({ success: true });
});

router.get("/booking/:token/receipt", async (req, res) => {
  const { token } = req.params;

  if (!UUID_RE.test(token)) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const [session] = await db
    .select({
      paymentIntentId: sessionsTable.paymentIntentId,
      paymentStatus: sessionsTable.paymentStatus,
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.cancellationToken, token))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  if (!session.paymentIntentId) {
    res.json({ amount: null, currency: null, last4: null, receiptUrl: null });
    return;
  }

  const stripe = await tryGetStripeClient();
  if (!stripe) {
    res.json({ amount: null, currency: null, last4: null, receiptUrl: null });
    return;
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(session.paymentIntentId, {
      expand: ["payment_method", "latest_charge"],
    });

    const pm =
      typeof pi.payment_method === "object" && pi.payment_method !== null
        ? (pi.payment_method as Stripe.PaymentMethod)
        : null;

    const charge =
      typeof pi.latest_charge === "object" && pi.latest_charge !== null
        ? (pi.latest_charge as Stripe.Charge)
        : null;

    res.json({
      amount: pi.amount,
      currency: pi.currency,
      last4: pm?.card?.last4 ?? null,
      receiptUrl: charge?.receipt_url ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch payment receipt from Stripe");
    res.json({ amount: null, currency: null, last4: null, receiptUrl: null });
  }
});

router.get("/instructors", async (_req, res) => {
  try {
    const t0 = Date.now();
    const [instructors, serviceCounts] = await Promise.all([
      db
        .select({
          id: instructorsTable.id,
          name: instructorsTable.name,
          slug: instructorsTable.slug,
        })
        .from(instructorsTable)
        .orderBy(instructorsTable.name),
      db
        .select({
          instructorId: servicesTable.instructorId,
          serviceCount: count(),
        })
        .from(servicesTable)
        .groupBy(servicesTable.instructorId),
    ]);

    const countMap = new Map<number, number>();
    for (const row of serviceCounts) {
      countMap.set(row.instructorId, row.serviceCount);
    }

    logger.info(
      { instructorCount: instructors.length, durationMs: Date.now() - t0 },
      "Public instructor directory fetched"
    );

    res.json({
      instructors: instructors.map((i) => ({
        ...i,
        serviceCount: countMap.get(i.id) ?? 0,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to load public instructor directory");
    res.status(500).json({ error: "Failed to load instructors" });
  }
});

router.get("/waiver-status", waiverStatusLimiter, async (req, res) => {
  const email = req.query.email as string | undefined;

  if (!email) {
    res.status(400).json({ error: "email query parameter is required" });
    return;
  }

  const [client] = await db
    .select({
      isExternalStudent: clientsTable.isExternalStudent,
      waiverSigned: clientsTable.waiverSigned,
    })
    .from(clientsTable)
    .where(eq(clientsTable.email, email))
    .limit(1);

  if (!client) {
    res.json({ isExternalStudent: false, waiverSigned: false });
    return;
  }

  res.json({
    isExternalStudent: client.isExternalStudent,
    waiverSigned: client.waiverSigned,
  });
});

router.post("/waiver/sign", async (req, res) => {
  const { email, waiverDocumentUrl, instructorName } = req.body as {
    email?: string;
    waiverDocumentUrl?: string;
    instructorName?: string;
  };

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const signedAt = new Date();
  let clientName: string | null = null;

  let found = false;
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable)
      .where(eq(clientsTable.email, email))
      .limit(1);

    if (!existing) return;

    found = true;
    clientName = existing.name;
    await tx
      .update(clientsTable)
      .set({
        waiverSigned: true,
        waiverSignedAt: signedAt,
        waiverDocumentUrl: waiverDocumentUrl ?? null,
      })
      .where(eq(clientsTable.email, email));
  });

  if (!found) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  void sendWaiverConfirmationEmail({
    to: email,
    clientName: clientName ?? "there",
    instructorName: instructorName ?? "your instructor",
    signedAt,
  });

  res.json({ success: true });
});

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const baseUrl = process.env.PORTAL_BASE_URL || "https://bjj-session-planner.replit.app/book";
    const instructors = await db
      .select({ slug: instructorsTable.slug })
      .from(instructorsTable)
      .orderBy(instructorsTable.name);

    const now = new Date().toISOString().split("T")[0];

    const urls = [
      `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n    <lastmod>${now}</lastmod>\n  </url>`,
      ...instructors.map(
        (i) =>
          `  <url>\n    <loc>${baseUrl}/${encodeURIComponent(i.slug)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n    <lastmod>${now}</lastmod>\n  </url>`
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    logger.error({ err }, "Failed to generate sitemap");
    res.status(500).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
  }
});

router.get("/:slug", async (req, res) => {
  const slug = String(req.params.slug);

  const [instructor] = await db
    .select({
      id: instructorsTable.id,
      name: instructorsTable.name,
      slug: instructorsTable.slug,
      bio: instructorsTable.bio,
      location: instructorsTable.location,
      phone: instructorsTable.phone,
      website: instructorsTable.website,
      photoUrl: instructorsTable.photoUrl,
      stripeAccountId: instructorsTable.stripeAccountId,
      stripeAccountEnabled: instructorsTable.stripeAccountEnabled,
    })
    .from(instructorsTable)
    .where(eq(instructorsTable.slug, slug))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  const [services, availability, stripeEnabled] = await Promise.all([
    db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.instructorId, instructor.id)),
    db
      .select()
      .from(availabilityTable)
      .where(eq(availabilityTable.instructorId, instructor.id)),
    isStripeConfigured(),
  ]);

  res.json({
    instructor: {
      id: instructor.id,
      name: instructor.name,
      slug: instructor.slug,
      bio: instructor.bio ?? null,
      location: instructor.location ?? null,
      phone: instructor.phone ?? null,
      website: instructor.website ?? null,
      photoUrl: instructor.photoUrl ?? null,
    },
    services,
    availability,
    stripeEnabled,
    stripeConnected: !!instructor.stripeAccountId && instructor.stripeAccountEnabled,
  });
});

router.get("/:slug/slots", async (req, res) => {
  const slug = String(req.params.slug);
  const { date } = req.query as { date?: string };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "A valid date (YYYY-MM-DD) is required." });
    return;
  }

  const [instructor] = await db
    .select({ id: instructorsTable.id })
    .from(instructorsTable)
    .where(eq(instructorsTable.slug, slug))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);
  const dayOfWeek = String(parsedDate.getDay());

  const [avail] = await db
    .select()
    .from(availabilityTable)
    .where(
      and(
        eq(availabilityTable.instructorId, instructor.id),
        eq(availabilityTable.day, dayOfWeek),
        eq(availabilityTable.enabled, true)
      )
    )
    .limit(1);

  if (!avail) {
    res.json({ slots: [] });
    return;
  }

  const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const startMin = timeToMinutes(avail.startTime);
  const endMin = timeToMinutes(avail.endTime);
  const duration = avail.sessionDurationMinutes;

  const allSlots: string[] = [];
  let cur = startMin;
  while (cur + duration <= endMin) {
    const h = Math.floor(cur / 60).toString().padStart(2, "0");
    const m = (cur % 60).toString().padStart(2, "0");
    allSlots.push(`${h}:${m}`);
    cur += duration;
  }

  const bookedSessions = await db
    .select({ time: sessionsTable.time })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.instructorId, instructor.id),
        eq(sessionsTable.date, date),
        notInArray(sessionsTable.status, ["cancelled", "no_show"])
      )
    );

  const bookedTimes = new Set(bookedSessions.map((s) => s.time));
  const availableSlots = allSlots.filter((slot) => !bookedTimes.has(slot));

  res.json({ slots: availableSlots });
});

router.post("/:slug/create-intent", publicBookingLimiter, requireWaiverSigned("clientEmail"), async (req, res) => {
  const slug = String(req.params.slug);

  const stripe = await tryGetStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Online payments are not configured for this portal." });
    return;
  }

  const [instructor] = await db
    .select({
      id: instructorsTable.id,
      name: instructorsTable.name,
      stripeAccountId: instructorsTable.stripeAccountId,
      stripeAccountEnabled: instructorsTable.stripeAccountEnabled,
    })
    .from(instructorsTable)
    .where(eq(instructorsTable.slug, slug))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  const { serviceId, packageCount = 1, clientName } = req.body as {
    serviceId?: number;
    packageCount?: number;
    clientName?: string;
  };

  if (!serviceId || !clientName) {
    res.status(400).json({ error: "serviceId and clientName are required" });
    return;
  }

  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, serviceId))
    .limit(1);

  if (!service || service.instructorId !== instructor.id) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  let amount: number;
  try {
    amount = computePackageTotal(service.price, packageCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid package configuration.";
    res.status(400).json({ error: message });
    return;
  }

  const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
    amount,
    currency: "usd",
    description: `${service.name} with ${instructor.name} for ${clientName}`,
    metadata: {
      instructorId: String(instructor.id),
      instructorSlug: slug,
      serviceId: String(service.id),
      serviceName: service.name,
      servicePrice: String(service.price),
      packageCount: String(packageCount),
      computedTotal: String(amount),
      clientName,
    },
  };

  if (instructor.stripeAccountId && instructor.stripeAccountEnabled) {
    intentParams.transfer_data = { destination: instructor.stripeAccountId };
  }

  const paymentIntent = await stripe.paymentIntents.create(intentParams);

  res.json({ clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
});

router.post("/:slug/create-subscription", publicBookingLimiter, requireWaiverSigned("email"), async (req, res) => {
  const slug = String(req.params.slug);

  const stripe = await tryGetStripeClient();
  if (!stripe) {
    res.status(503).json({ error: "Online payments are not configured for this portal." });
    return;
  }

  const [instructor] = await db
    .select({
      id: instructorsTable.id,
      name: instructorsTable.name,
      stripeAccountId: instructorsTable.stripeAccountId,
      stripeAccountEnabled: instructorsTable.stripeAccountEnabled,
    })
    .from(instructorsTable)
    .where(eq(instructorsTable.slug, slug))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  const { email, serviceId, packageCount = 1, interval = "monthly" } = req.body as {
    email?: string;
    serviceId?: number;
    packageCount?: number;
    interval?: "weekly" | "monthly";
  };

  if (!email || !serviceId) {
    res.status(400).json({ error: "email and serviceId are required" });
    return;
  }

  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, serviceId))
    .limit(1);

  if (!service || service.instructorId !== instructor.id) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  let monthlyAmount: number;
  try {
    monthlyAmount = computePackageTotal(service.price, packageCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid package configuration.";
    res.status(400).json({ error: message });
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
  try {
    const searchResult = await stripe.prices.search({
      query: `active:'true' AND metadata['serviceId']:'${service.id}' AND metadata['packageCount']:'${packageCount}' AND metadata['interval']:'${stripeInterval}'`,
      limit: 5,
    });
    const reusable = searchResult.data.find((p) => p.unit_amount === monthlyAmount);
    if (reusable) {
      priceId = reusable.id;
    } else {
      const price = await stripe.prices.create({
        unit_amount: monthlyAmount,
        currency: "usd",
        recurring: { interval: stripeInterval },
        product_data: { name: `${service.name} with ${instructor.name}` },
        metadata: {
          instructorSlug: slug,
          serviceId: String(service.id),
          serviceName: service.name,
          packageCount: String(packageCount),
          interval: stripeInterval,
        },
      });
      priceId = price.id;
    }
  } catch (err) {
    logger.error({ err }, "Failed to lookup or create Stripe price for public subscription");
    res.status(503).json({ error: "Failed to configure pricing. Please try again." });
    return;
  }

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice", "pending_setup_intent"],
    metadata: {
      instructorId: String(instructor.id),
      instructorSlug: slug,
      serviceId: String(service.id),
      serviceName: service.name,
      servicePrice: String(service.price),
      packageCount: String(packageCount),
    },
  };

  if (instructor.stripeAccountId && instructor.stripeAccountEnabled) {
    subscriptionParams.transfer_data = { destination: instructor.stripeAccountId };
  }

  const subscription = await stripe.subscriptions.create(subscriptionParams);

  // Insert a placeholder session row immediately so the invoice.paid webhook
  // can always find a row by subscriptionId and mark paymentStatus "paid",
  // even if the client hasn't completed their booking form yet.
  // Fail closed: if the insert fails, return 500 rather than handing the client
  // a subscriptionId they cannot reliably book against.
  await db.insert(sessionsTable).values({
    instructorId: instructor.id,
    clientName: email,
    clientEmail: email,
    date: "pending",
    time: "pending",
    serviceName: service.name,
    servicePrice: service.price,
    packageCount,
    packageTotal: monthlyAmount,
    status: "scheduled",
    paymentStatus: "pending",
    subscriptionId: subscription.id,
    isPlaceholder: true,
  });
  logger.info(
    { instructorId: instructor.id, subscriptionId: subscription.id, instructorSlug: slug },
    "Placeholder session inserted for subscription — webhook can mark paid without race condition"
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

  res.json({ subscriptionId: subscription.id, clientSecret });
});

router.post("/:slug/waiver", publicBookingLimiter, async (req, res) => {
  const slug = String(req.params.slug);

  const [instructor] = await db
    .select({ id: instructorsTable.id })
    .from(instructorsTable)
    .where(eq(instructorsTable.slug, slug))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  const { clientName, clientEmail, signatureData } = req.body as {
    clientName?: string;
    clientEmail?: string;
    signatureData?: string;
  };

  if (!clientName || !clientEmail || !signatureData) {
    res.status(400).json({ error: "clientName, clientEmail, and signatureData are required" });
    return;
  }

  if (
    !signatureData.startsWith("data:image/png;base64,") ||
    signatureData.length < 2000
  ) {
    res.status(400).json({ error: "Invalid signature. Please draw your signature clearly." });
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [waiver] = await db
    .insert(waiversTable)
    .values({
      instructorId: instructor.id,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim().toLowerCase(),
      signatureData,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
      expiresAt,
    })
    .returning();

  res.status(201).json({ waiverId: waiver.id, expiresAt: waiver.expiresAt });
});

router.post("/:slug/session", publicBookingLimiter, requireWaiverSigned("clientEmail"), async (req, res) => {
  const slug = String(req.params.slug);

  const stripe = await tryGetStripeClient();

  const [instructor] = await db
    .select({ id: instructorsTable.id, name: instructorsTable.name, email: instructorsTable.email })
    .from(instructorsTable)
    .where(eq(instructorsTable.slug, slug))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  const {
    clientName,
    clientEmail,
    clientPhone,
    date,
    time,
    paymentIntentId,
    subscriptionId,
    notes,
    waiverId,
  } = req.body as {
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    date?: string;
    time?: string;
    paymentIntentId?: string;
    subscriptionId?: string;
    notes?: string;
    waiverId?: number;
  };

  if (!clientName || !date || !time) {
    res.status(400).json({ error: "clientName, date, and time are required" });
    return;
  }

  if (!waiverId) {
    res.status(400).json({ error: "A signed waiver is required to complete your booking." });
    return;
  }

  const [waiverRow] = await db
    .select()
    .from(waiversTable)
    .where(eq(waiversTable.id, waiverId))
    .limit(1);

  if (!waiverRow) {
    res.status(400).json({ error: "Waiver not found. Please re-sign the waiver." });
    return;
  }
  if (waiverRow.isUsed) {
    res.status(403).json({ error: "This waiver has already been used. Please re-sign the waiver." });
    return;
  }
  if (waiverRow.instructorId !== instructor.id) {
    res.status(403).json({ error: "This waiver was not signed for this instructor." });
    return;
  }
  if (clientEmail && waiverRow.clientEmail !== clientEmail.trim().toLowerCase()) {
    res.status(403).json({ error: "Waiver email does not match the provided email address." });
    return;
  }
  if (waiverRow.expiresAt < new Date()) {
    res.status(400).json({ error: "Your waiver has expired (valid for 2 hours). Please re-sign to continue." });
    return;
  }

  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dateParts) {
    res.status(400).json({ error: "Invalid date format. Expected YYYY-MM-DD." });
    return;
  }
  const parsedDate = new Date(
    Number(dateParts[1]),
    Number(dateParts[2]) - 1,
    Number(dateParts[3])
  );
  const dayOfWeek = String(parsedDate.getDay());

  const [avail] = await db
    .select()
    .from(availabilityTable)
    .where(
      and(
        eq(availabilityTable.instructorId, instructor.id),
        eq(availabilityTable.day, dayOfWeek),
        eq(availabilityTable.enabled, true)
      )
    )
    .limit(1);

  if (!avail) {
    res.status(400).json({ error: "Instructor is not available on this day." });
    return;
  }

  const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const requestedMin = timeToMinutes(time);
  const windowStart = timeToMinutes(avail.startTime);
  const windowEnd = timeToMinutes(avail.endTime);

  if (requestedMin < windowStart || requestedMin + avail.sessionDurationMinutes > windowEnd) {
    res.status(400).json({ error: "Requested time is outside instructor's available hours." });
    return;
  }

  if (!paymentIntentId && !subscriptionId) {
    if (stripe) {
      res.status(400).json({ error: "Payment verification is required to complete a booking." });
      return;
    }

    const {
      serviceId,
      packageCount: pkgCount = 1,
    } = req.body as { serviceId?: number; packageCount?: number };

    let resolvedServiceName = "Session";
    let resolvedServicePrice = 0;
    let resolvedPackageCount = pkgCount;
    let resolvedPackageTotal = 0;

    if (serviceId) {
      const [svc] = await db
        .select()
        .from(servicesTable)
        .where(and(eq(servicesTable.id, serviceId), eq(servicesTable.instructorId, instructor.id)))
        .limit(1);
      if (svc) {
        resolvedServiceName = svc.name;
        resolvedServicePrice = svc.price;
        resolvedPackageTotal = Math.round(
          svc.price * resolvedPackageCount * (resolvedPackageCount > 1 ? (1 - PACKAGE_DISCOUNT) : 1)
        );
      }
    }

    let session: typeof sessionsTable.$inferSelect;
    try {
      session = await db.transaction(async (tx) => {
        const [conflict] = await tx
          .select({ id: sessionsTable.id })
          .from(sessionsTable)
          .where(
            and(
              eq(sessionsTable.instructorId, instructor.id),
              eq(sessionsTable.date, date),
              eq(sessionsTable.time, time),
              notInArray(sessionsTable.status, ["cancelled", "no_show"])
            )
          )
          .limit(1);

        if (conflict) {
          const err = new Error("This time slot is no longer available. Please choose another time.");
          (err as NodeJS.ErrnoException).code = "CONFLICT";
          throw err;
        }

        await tx
          .update(waiversTable)
          .set({ isUsed: true })
          .where(eq(waiversTable.id, waiverRow.id));
        const [s] = await tx
          .insert(sessionsTable)
          .values({
            instructorId: instructor.id,
            clientName,
            clientEmail: clientEmail || null,
            clientPhone: clientPhone || null,
            date,
            time,
            status: "scheduled",
            serviceName: resolvedServiceName,
            servicePrice: resolvedServicePrice,
            packageCount: resolvedPackageCount,
            packageTotal: resolvedPackageTotal,
            paymentStatus: "pending",
            paymentIntentId: null,
            subscriptionId: null,
            notes: notes || null,
            waiverId: waiverRow.id,
          })
          .returning();
        return s;
      }, { isolationLevel: "serializable" });
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === "CONFLICT") {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }

    const bookingBaseUrl = process.env.PUBLIC_PORTAL_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "bjj-session-planner.replit.app"}/book`;
    if (clientEmail) {
      void sendBookingConfirmationEmail({
        to: clientEmail,
        clientName,
        instructorName: instructor.name,
        serviceName: resolvedServiceName,
        date,
        time,
        amountPaidCents: 0,
        cancellationToken: session.cancellationToken ?? null,
        cancellationBaseUrl: bookingBaseUrl,
      });
    }
    if (instructor.email) {
      void sendInstructorNewBookingEmail({
        to: instructor.email,
        instructorName: instructor.name,
        clientName,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        serviceName: resolvedServiceName,
        date,
        time,
        amountCents: 0,
      });
    }

    res.status(201).json(session);
    return;
  }

  if (!stripe) {
    res.status(503).json({ error: "Online payment verification is not configured." });
    return;
  }

  let serviceName: string;
  let servicePrice: number;
  let packageCount: number;
  let packageTotal: number;
  let placeholderSessionId: number | null = null;

  if (paymentIntentId) {
    const [existingSession] = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.paymentIntentId, paymentIntentId))
      .limit(1);

    if (existingSession) {
      res.status(409).json({ error: "This payment has already been used for a booking." });
      return;
    }

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch {
      res.status(400).json({ error: "Could not verify payment. Please try again." });
      return;
    }

    if (intent.status !== "succeeded") {
      res.status(400).json({ error: "Payment has not been completed successfully." });
      return;
    }

    if (intent.metadata.instructorSlug !== slug) {
      res.status(403).json({ error: "This payment was not made for this instructor." });
      return;
    }

    serviceName = intent.metadata.serviceName || "Session";
    servicePrice = Number(intent.metadata.servicePrice) || 0;
    packageCount = Number(intent.metadata.packageCount) || 1;
    packageTotal = intent.amount;

  } else {
    const [existingSession] = await db
      .select({ id: sessionsTable.id, isPlaceholder: sessionsTable.isPlaceholder })
      .from(sessionsTable)
      .where(eq(sessionsTable.subscriptionId, subscriptionId!))
      .limit(1);

    if (existingSession && !existingSession.isPlaceholder) {
      logger.warn(
        { subscriptionId, existingSessionId: existingSession.id },
        "Subscription session booking rejected — already used for a confirmed booking"
      );
      res.status(409).json({ error: "This subscription has already been used for a booking." });
      return;
    }

    if (existingSession?.isPlaceholder) {
      placeholderSessionId = existingSession.id;
      logger.info(
        { subscriptionId, placeholderSessionId },
        "Found placeholder session — will upgrade to confirmed booking"
      );
    }

    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(subscriptionId!);
    } catch {
      res.status(400).json({ error: "Could not verify subscription. Please try again." });
      return;
    }

    if (!["active", "trialing"].includes(sub.status)) {
      res.status(400).json({ error: "Subscription is not active. Please complete payment." });
      return;
    }

    if (sub.metadata.instructorSlug !== slug) {
      res.status(403).json({ error: "This subscription was not created for this instructor." });
      return;
    }

    const item = sub.items.data[0];
    serviceName = sub.metadata.serviceName || "Session";
    servicePrice = Number(sub.metadata.servicePrice) || 0;
    packageCount = Number(sub.metadata.packageCount) || 1;
    packageTotal = item?.price.unit_amount || 0;
  }

  let session: typeof sessionsTable.$inferSelect;
  try {
    session = await db.transaction(async (tx) => {
      const [conflict] = await tx
        .select({ id: sessionsTable.id })
        .from(sessionsTable)
        .where(
          and(
            eq(sessionsTable.instructorId, instructor.id),
            eq(sessionsTable.date, date),
            eq(sessionsTable.time, time),
            notInArray(sessionsTable.status, ["cancelled", "no_show"])
          )
        )
        .limit(1);

      if (conflict) {
        const err = new Error("This time slot is no longer available. Please choose another time.");
        (err as NodeJS.ErrnoException).code = "CONFLICT";
        throw err;
      }

      await tx
        .update(waiversTable)
        .set({ isUsed: true })
        .where(eq(waiversTable.id, waiverRow.id));

      let s: typeof sessionsTable.$inferSelect;
      if (placeholderSessionId !== null) {
        // Upgrade the placeholder row created during create-subscription
        const [updated] = await tx
          .update(sessionsTable)
          .set({
            clientName,
            clientEmail: clientEmail || null,
            clientPhone: clientPhone || null,
            date,
            time,
            status: "scheduled",
            serviceName,
            servicePrice,
            packageCount,
            packageTotal,
            paymentStatus: "paid",
            notes: notes || null,
            waiverId: waiverRow.id,
            isPlaceholder: false,
            updatedAt: new Date(),
          })
          .where(eq(sessionsTable.id, placeholderSessionId))
          .returning();
        s = updated;
      } else {
        const [inserted] = await tx
          .insert(sessionsTable)
          .values({
            instructorId: instructor.id,
            clientName,
            clientEmail: clientEmail || null,
            clientPhone: clientPhone || null,
            date,
            time,
            status: "scheduled",
            serviceName,
            servicePrice,
            packageCount,
            packageTotal,
            paymentStatus: "paid",
            paymentIntentId: paymentIntentId || null,
            subscriptionId: subscriptionId || null,
            notes: notes || null,
            waiverId: waiverRow.id,
          })
          .returning();
        s = inserted;
      }
      return s;
    }, { isolationLevel: "serializable" });
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "CONFLICT") {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }

  const bookingBaseUrl = process.env.PUBLIC_PORTAL_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "bjj-session-planner.replit.app"}/book`;
  if (clientEmail) {
    void sendBookingConfirmationEmail({
      to: clientEmail,
      clientName,
      instructorName: instructor.name,
      serviceName,
      date,
      time,
      amountPaidCents: packageTotal,
      cancellationToken: session.cancellationToken ?? null,
      cancellationBaseUrl: bookingBaseUrl,
      paymentIntentId: paymentIntentId || null,
    });
  }
  if (instructor.email) {
    void sendInstructorNewBookingEmail({
      to: instructor.email,
      instructorName: instructor.name,
      clientName,
      clientEmail: clientEmail || null,
      clientPhone: clientPhone || null,
      serviceName,
      date,
      time,
      amountCents: packageTotal,
    });
  }

  res.status(201).json(session);
});

export default router;
