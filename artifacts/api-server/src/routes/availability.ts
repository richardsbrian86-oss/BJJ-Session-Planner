import { Router } from "express";
import type { Request, Response } from "express";
import { db, availabilityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireInstructor } from "../lib/auth";
import { instructorLimiter } from "../lib/rateLimiters";

const router = Router();

router.use(requireInstructor);
router.use(instructorLimiter);

interface AvailabilityInput {
  day: string;
  enabled: boolean;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  sessionDurationMinutes?: number;
  session_duration_minutes?: number;
}

router.get("/", async (req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(availabilityTable)
    .where(eq(availabilityTable.instructorId, req.instructorId!));
  res.json(rows);
});

router.put("/", async (req: Request, res: Response) => {
  const { availability } = req.body as { availability?: AvailabilityInput[] };
  if (!Array.isArray(availability)) {
    res.status(400).json({ error: "availability must be an array" });
    return;
  }

  const instructorId = req.instructorId!;

  const rows = await db.transaction(async (tx) => {
    await tx
      .delete(availabilityTable)
      .where(eq(availabilityTable.instructorId, instructorId));

    if (availability.length === 0) return [];

    return tx
      .insert(availabilityTable)
      .values(
        availability.map((a) => ({
          instructorId,
          day: String(a.day),
          enabled: Boolean(a.enabled),
          startTime: String(a.startTime ?? a.start_time ?? "09:00"),
          endTime: String(a.endTime ?? a.end_time ?? "17:00"),
          sessionDurationMinutes: Number(
            a.sessionDurationMinutes ?? a.session_duration_minutes ?? 60
          ),
        }))
      )
      .returning();
  });

  res.json(rows);
});

export default router;
