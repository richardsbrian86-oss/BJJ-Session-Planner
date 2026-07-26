import { Router } from "express";
import type { Request, Response } from "express";
import {
  db,
  authFailuresTable,
  authFailureHistoryTable,
  crossAccountHistoryTable,
  instructorsTable,
} from "@workspace/db";
import { eq, gt, lt, and, gte, desc } from "drizzle-orm";
import { requireInstructor } from "../lib/auth";
import { instructorLimiter } from "../lib/rateLimiters";

const router = Router();

router.use(requireInstructor);
router.use(instructorLimiter);

const ALERT_WINDOW_MS = Number(process.env.AUTH_ALERT_WINDOW_MS ?? 10 * 60 * 1000);
const ALERT_THRESHOLD = Number(process.env.AUTH_ALERT_THRESHOLD ?? 5);
const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;

router.get("/events", async (req: Request, res: Response) => {
  try {
    const [instructor] = await db
      .select({ slug: instructorsTable.slug })
      .from(instructorsTable)
      .where(eq(instructorsTable.id, req.instructorId!))
      .limit(1);

    if (!instructor) {
      res.status(401).json({ error: "Instructor not found" });
      return;
    }

    const now = Date.now();
    const windowCutoff = now - ALERT_WINDOW_MS;
    const historyCutoff = now - HISTORY_RETENTION_MS;

    const [activeRows, expiredRows, historyRows] = await Promise.all([
      db
        .select({
          ip: authFailuresTable.ip,
          count: authFailuresTable.count,
          windowStart: authFailuresTable.windowStart,
          alertedAt: authFailuresTable.alertedAt,
        })
        .from(authFailuresTable)
        .where(
          and(
            eq(authFailuresTable.slug, instructor.slug),
            gt(authFailuresTable.windowStart, windowCutoff),
          ),
        )
        .orderBy(authFailuresTable.windowStart),

      db
        .select({
          ip: authFailuresTable.ip,
          count: authFailuresTable.count,
          windowStart: authFailuresTable.windowStart,
          alertedAt: authFailuresTable.alertedAt,
        })
        .from(authFailuresTable)
        .where(
          and(
            eq(authFailuresTable.slug, instructor.slug),
            lt(authFailuresTable.windowStart, windowCutoff),
            gte(authFailuresTable.windowStart, historyCutoff),
          ),
        ),

      db
        .select({
          ip: authFailureHistoryTable.ip,
          count: authFailureHistoryTable.count,
          windowStart: authFailureHistoryTable.windowStart,
          windowEnd: authFailureHistoryTable.windowEnd,
          alertedAt: authFailureHistoryTable.alertedAt,
        })
        .from(authFailureHistoryTable)
        .where(
          and(
            eq(authFailureHistoryTable.slug, instructor.slug),
            gte(authFailureHistoryTable.windowEnd, historyCutoff),
          ),
        )
        .orderBy(authFailureHistoryTable.windowEnd),
    ]);

    const archivedKey = new Set(
      historyRows.map((r) => `${r.ip}:${r.windowStart}`),
    );

    const expiredHistory = expiredRows
      .filter((r) => !archivedKey.has(`${r.ip}:${r.windowStart}`))
      .map((r) => ({
        ip: r.ip,
        count: r.count,
        windowStart: r.windowStart,
        windowEnd: now,
        alerted: r.alertedAt !== null,
        alertedAt: r.alertedAt ?? null,
      }));

    const archivedHistory = historyRows.map((r) => ({
      ip: r.ip,
      count: r.count,
      windowStart: r.windowStart,
      windowEnd: r.windowEnd,
      alerted: r.alertedAt !== null,
      alertedAt: r.alertedAt ?? null,
    }));

    const history = [...expiredHistory, ...archivedHistory].sort(
      (a, b) => b.windowEnd - a.windowEnd,
    );

    res.json({
      alertThreshold: ALERT_THRESHOLD,
      windowMs: ALERT_WINDOW_MS,
      events: activeRows.map((r) => ({
        ip: r.ip,
        count: r.count,
        windowStart: r.windowStart,
        alerted: r.alertedAt !== null,
        alertedAt: r.alertedAt ?? null,
      })),
      history,
    });
  } catch {
    res.status(500).json({ error: "Failed to retrieve security events" });
  }
});

router.get("/cross-account-events", async (req: Request, res: Response) => {
  try {
    const [instructor] = await db
      .select({ slug: instructorsTable.slug })
      .from(instructorsTable)
      .where(eq(instructorsTable.id, req.instructorId!))
      .limit(1);

    if (!instructor) {
      res.status(401).json({ error: "Instructor not found" });
      return;
    }

    const now = Date.now();
    const windowCutoff = now - ALERT_WINDOW_MS;

    const activeRows = await db
      .select({
        slug: authFailuresTable.slug,
        ip: authFailuresTable.ip,
        count: authFailuresTable.count,
        windowStart: authFailuresTable.windowStart,
        alertedAt: authFailuresTable.alertedAt,
      })
      .from(authFailuresTable)
      .where(gt(authFailuresTable.windowStart, windowCutoff));

    const foreign = activeRows.filter((r) => r.slug !== instructor.slug);

    const distinctSlugs = new Set(foreign.map((r) => r.slug));
    const distinctIps = new Set(foreign.map((r) => r.ip));
    const totalFailures = foreign.reduce((sum, r) => sum + r.count, 0);
    const isCoordinatedAttack = foreign.some((r) => r.count >= ALERT_THRESHOLD);

    const events = foreign.map((r) => ({
      slug: r.slug,
      ip: r.ip,
      count: r.count,
      windowStart: r.windowStart,
      alerted: r.alertedAt !== null,
      alertedAt: r.alertedAt ?? null,
    }));

    res.json({
      alertThreshold: ALERT_THRESHOLD,
      windowMs: ALERT_WINDOW_MS,
      events,
      summary: {
        affectedAccounts: distinctSlugs.size,
        distinctIpCount: distinctIps.size,
        totalFailures,
        isCoordinatedAttack,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to retrieve cross-account security events" });
  }
});

router.get("/cross-account-history", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: crossAccountHistoryTable.id,
        ip: crossAccountHistoryTable.ip,
        firstSeen: crossAccountHistoryTable.firstSeen,
        lastSeen: crossAccountHistoryTable.lastSeen,
        totalFailures: crossAccountHistoryTable.totalFailures,
        affectedSlugs: crossAccountHistoryTable.affectedSlugs,
        archivedAt: crossAccountHistoryTable.archivedAt,
      })
      .from(crossAccountHistoryTable)
      .orderBy(desc(crossAccountHistoryTable.archivedAt))
      .limit(100);

    res.json({ history: rows });
  } catch {
    res.status(500).json({ error: "Failed to retrieve cross-account history" });
  }
});

export default router;
