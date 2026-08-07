import crypto from "crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import { db, sessionsTable, instructorsTable, waiversTable } from "@workspace/db";
import { eq, and, ne, gte, lte, desc } from "drizzle-orm";
import { requireInstructor } from "../lib/auth";
import { instructorLimiter } from "../lib/rateLimiters";
import { sendCancellationEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

router.use(requireInstructor);
router.use(instructorLimiter);

router.get("/", async (req: Request, res: Response) => {
  const { startDate, endDate, limit, offset } = req.query as {
    startDate?: string;
    endDate?: string;
    limit?: string;
    offset?: string;
  };

  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 90);
  const defaultStartStr = defaultStart.toISOString().slice(0, 10);

  const resolvedStart = startDate ?? defaultStartStr;
  const resolvedLimit = Math.min(Math.max(parseInt(limit ?? "200", 10) || 200, 1), 500);
  const resolvedOffset = Math.max(parseInt(offset ?? "0", 10) || 0, 0);

  const conditions = [
    eq(sessionsTable.instructorId, req.instructorId!),
    eq(sessionsTable.isPlaceholder, false),
    gte(sessionsTable.date, resolvedStart),
  ];
  if (endDate) {
    conditions.push(lte(sessionsTable.date, endDate));
  }

  const t0 = Date.now();
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(and(...conditions))
    .orderBy(desc(sessionsTable.date), desc(sessionsTable.time))
    .limit(resolvedLimit)
    .offset(resolvedOffset);

  logger.info(
    {
      instructorId: req.instructorId,
      startDate: resolvedStart,
      endDate: endDate ?? null,
      limit: resolvedLimit,
      offset: resolvedOffset,
      resultCount: sessions.length,
      durationMs: Date.now() - t0,
    },
    "Session list fetched"
  );

  res.json(sessions);
});

router.post("/", async (req: Request, res: Response) => {
  const {
    clientName,
    clientEmail,
    clientPhone,
    date,
    time,
    serviceName,
    servicePrice,
    packageCount,
    packageTotal,
    notes,
  } = req.body as {
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    date?: string;
    time?: string;
    serviceName?: string;
    servicePrice?: number;
    packageCount?: number;
    packageTotal?: number;
    notes?: string;
  };

  if (!clientName || !date || !time || !serviceName) {
    res
      .status(400)
      .json({ error: "clientName, date, time, serviceName are required" });
    return;
  }

  let session: typeof sessionsTable.$inferSelect;
  try {
    session = await db.transaction(async (tx) => {
      const [conflict] = await tx
        .select({ id: sessionsTable.id })
        .from(sessionsTable)
        .where(
          and(
            eq(sessionsTable.instructorId, req.instructorId!),
            eq(sessionsTable.date, date),
            eq(sessionsTable.time, time),
            ne(sessionsTable.status, "cancelled"),
            ne(sessionsTable.status, "no_show")
          )
        )
        .limit(1);

      if (conflict) {
        const err = new Error("A session is already booked at this date and time");
        (err as NodeJS.ErrnoException).code = "CONFLICT";
        throw err;
      }

      const [s] = await tx
        .insert(sessionsTable)
        .values({
          instructorId: req.instructorId!,
          clientName,
          clientEmail: clientEmail ?? null,
          clientPhone: clientPhone ?? null,
          date,
          time,
          serviceName,
          servicePrice: servicePrice != null ? Number(servicePrice) : 0,
          packageCount: packageCount != null ? Number(packageCount) : null,
          packageTotal: packageTotal != null ? Number(packageTotal) : null,
          notes: notes ?? null,
          cancellationToken: crypto.randomUUID(),
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

  res.status(201).json(session);
});

router.patch("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const {
    status,
    date,
    time,
    clientName,
    clientEmail,
    clientPhone,
    notes,
    serviceName,
    servicePrice,
    packageCount,
    packageTotal,
    calendarEventId,
  } = req.body as {
    status?: "scheduled" | "completed" | "cancelled" | "no_show";
    date?: string;
    time?: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    notes?: string;
    serviceName?: string;
    servicePrice?: number;
    packageCount?: number;
    packageTotal?: number;
    calendarEventId?: string;
  };

  type SessionPatch = Partial<{
    status: "scheduled" | "completed" | "cancelled" | "no_show";
    date: string;
    time: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    notes: string;
    serviceName: string;
    servicePrice: number;
    packageCount: number;
    packageTotal: number;
    calendarEventId: string;
    updatedAt: Date;
  }>;

  const updates: SessionPatch = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (date !== undefined) updates.date = date;
  if (time !== undefined) updates.time = time;
  if (clientName !== undefined) updates.clientName = clientName;
  if (clientEmail !== undefined) updates.clientEmail = clientEmail;
  if (clientPhone !== undefined) updates.clientPhone = clientPhone;
  if (notes !== undefined) updates.notes = notes;
  if (serviceName !== undefined) updates.serviceName = serviceName;
  if (servicePrice !== undefined) updates.servicePrice = Number(servicePrice);
  if (packageCount !== undefined) updates.packageCount = Number(packageCount);
  if (packageTotal !== undefined) updates.packageTotal = Number(packageTotal);
  if (calendarEventId !== undefined) updates.calendarEventId = calendarEventId;

  type ExistingSnapshot = {
    status: "scheduled" | "completed" | "cancelled" | "no_show";
    clientEmail: string | null;
    date: string;
    time: string;
  };

  let existing: ExistingSnapshot;
  let updated: typeof sessionsTable.$inferSelect;

  try {
    const result = await db.transaction(async (tx) => {
      const [ex] = await tx
        .select({
          status: sessionsTable.status,
          clientEmail: sessionsTable.clientEmail,
          date: sessionsTable.date,
          time: sessionsTable.time,
        })
        .from(sessionsTable)
        .where(
          and(
            eq(sessionsTable.id, sessionId),
            eq(sessionsTable.instructorId, req.instructorId!)
          )
        )
        .limit(1);

      if (!ex) {
        const err = new Error("Session not found");
        (err as NodeJS.ErrnoException).code = "NOT_FOUND";
        throw err;
      }

      if (updates.date !== undefined || updates.time !== undefined) {
        const newDate = updates.date ?? ex.date;
        const newTime = updates.time ?? ex.time;

        const [conflict] = await tx
          .select({ id: sessionsTable.id })
          .from(sessionsTable)
          .where(
            and(
              eq(sessionsTable.instructorId, req.instructorId!),
              eq(sessionsTable.date, newDate),
              eq(sessionsTable.time, newTime),
              ne(sessionsTable.status, "cancelled"),
              ne(sessionsTable.status, "no_show"),
              ne(sessionsTable.id, sessionId)
            )
          )
          .limit(1);

        if (conflict) {
          const err = new Error("A session is already booked at this date and time");
          (err as NodeJS.ErrnoException).code = "CONFLICT";
          throw err;
        }
      }

      const [up] = await tx
        .update(sessionsTable)
        .set(updates)
        .where(
          and(
            eq(sessionsTable.id, sessionId),
            eq(sessionsTable.instructorId, req.instructorId!)
          )
        )
        .returning();

      if (!up) {
        const err = new Error("Session not found");
        (err as NodeJS.ErrnoException).code = "NOT_FOUND";
        throw err;
      }

      return { ex, up };
    }, { isolationLevel: "serializable" });

    existing = result.ex;
    updated = result.up;
  } catch (err: unknown) {
    if (err instanceof Error) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "NOT_FOUND") {
        res.status(404).json({ error: err.message });
        return;
      }
      if (code === "CONFLICT") {
        res.status(409).json({ error: err.message });
        return;
      }
    }
    throw err;
  }

  if (
    updates.status === "cancelled" &&
    existing.status !== "cancelled" &&
    updated.clientEmail
  ) {
    const [instructor] = await db
      .select({ name: instructorsTable.name })
      .from(instructorsTable)
      .where(eq(instructorsTable.id, req.instructorId!))
      .limit(1);

    void sendCancellationEmail({
      to: updated.clientEmail,
      clientName: updated.clientName,
      instructorName: instructor?.name ?? "Your instructor",
      serviceName: updated.serviceName,
      date: updated.date,
      time: updated.time,
    });
  }

  res.json(updated);
});

router.get("/:id/waiver", async (req: Request<{ id: string }>, res: Response) => {
  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [session] = await db
    .select({ waiverId: sessionsTable.waiverId })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, sessionId),
        eq(sessionsTable.instructorId, req.instructorId!)
      )
    )
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (!session.waiverId) {
    res.status(404).json({ error: "No waiver on file for this session" });
    return;
  }

  const [waiver] = await db
    .select({
      id: waiversTable.id,
      clientName: waiversTable.clientName,
      clientEmail: waiversTable.clientEmail,
      signedAt: waiversTable.signedAt,
      signatureData: waiversTable.signatureData,
    })
    .from(waiversTable)
    .where(eq(waiversTable.id, session.waiverId))
    .limit(1);

  if (!waiver) {
    res.status(404).json({ error: "Waiver record not found or has been removed" });
    return;
  }

  res.json(waiver);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const sessionId = parseInt(req.params.id, 10);
  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [deleted] = await db
    .delete(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, sessionId),
        eq(sessionsTable.instructorId, req.instructorId!)
      )
    )
    .returning({ id: sessionsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.status(204).send();
});

export default router;
