import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

export const NOTION_CONFIG = {
  hubUrl: "https://app.notion.com/p/38fde4c7ac51811ca15bf9f0fa4a5867",
  databases: {
    sessions: {
      url: "https://app.notion.com/p/a87376e356e2459f9a20b44c52b0a2b6",
      dataSourceId: "dbe66b1b-c991-4188-97df-1aef32a72475",
    },
    clients: {
      url: "https://app.notion.com/p/d4d4419577e243f8a237428e457d40dc",
      dataSourceId: "c8017c83-ec33-4abd-873c-2d5a7322833e",
    },
    services: {
      url: "https://app.notion.com/p/b5187ddcd4784b3eb932adbc9fc75d87",
      dataSourceId: "77c67009-6c38-4f05-a236-b138735a9344",
    },
    instructors: {
      url: "https://app.notion.com/p/3e025f7548bc4f4ca7992e51773719ad",
      dataSourceId: "734698c6-f5fb-413d-947e-10b43cbc5a45",
    },
  },
};

router.get("/status", async (_req, res) => {
  try {
    const [sessions, clients, services, instructors, byStatus, byPayment] =
      await Promise.all([
        db.execute<{ count: string }>(sql`SELECT COUNT(*) FROM sessions`),
        db.execute<{ count: string }>(sql`SELECT COUNT(*) FROM clients`),
        db.execute<{ count: string }>(sql`SELECT COUNT(*) FROM services`),
        db.execute<{ count: string }>(sql`SELECT COUNT(*) FROM instructors`),
        db.execute<{ status: string; count: string }>(
          sql`SELECT status, COUNT(*) as count FROM sessions GROUP BY status ORDER BY count DESC`
        ),
        db.execute<{ payment_status: string; count: string }>(
          sql`SELECT payment_status, COUNT(*) as count FROM sessions GROUP BY payment_status ORDER BY count DESC`
        ),
      ]);

    res.json({
      notion: {
        hubUrl: NOTION_CONFIG.hubUrl,
        databases: Object.fromEntries(
          Object.entries(NOTION_CONFIG.databases).map(([k, v]) => [k, v.url])
        ),
      },
      counts: {
        sessions: parseInt(sessions.rows[0].count, 10),
        clients: parseInt(clients.rows[0].count, 10),
        services: parseInt(services.rows[0].count, 10),
        instructors: parseInt(instructors.rows[0].count, 10),
      },
      sessionBreakdown: {
        byStatus: Object.fromEntries(
          byStatus.rows.map((r) => [r.status, parseInt(r.count, 10)])
        ),
        byPayment: Object.fromEntries(
          byPayment.rows.map((r) => [
            r.payment_status,
            parseInt(r.count, 10),
          ])
        ),
      },
      note: "Notion databases are synced manually via the Replit agent. To re-sync, ask the agent to push fresh data.",
    });
  } catch (err) {
    console.error("[notion] status error:", err);
    res.status(500).json({ error: "Failed to fetch notion status" });
  }
});

export default router;
