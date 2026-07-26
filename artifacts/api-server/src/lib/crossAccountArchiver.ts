/**
 * Cross-Account Attack Archiver
 *
 * Periodically scans expired auth_failures rows for IPs that appeared across
 * multiple instructor slugs.  When such an IP is found, a summary row is
 * written to cross_account_history so instructors can see a timeline of past
 * coordinated attacks even after the detection window has rolled over.
 *
 * The routine runs every CLEANUP_INTERVAL_MS (default 10 min).  Rows older
 * than HISTORY_RETENTION_MS (default 30 days) are pruned from the archive.
 */

import { db, authFailuresTable, crossAccountHistoryTable } from "@workspace/db";
import { lt, lte, sql } from "drizzle-orm";

const ALERT_WINDOW_MS = Number(process.env.AUTH_ALERT_WINDOW_MS ?? 10 * 60 * 1000);
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function archiveCrossAccountWindows(): Promise<void> {
  const now = Date.now();
  const windowCutoff = now - ALERT_WINDOW_MS;

  try {
    const expiredRows = await db
      .select({
        slug: authFailuresTable.slug,
        ip: authFailuresTable.ip,
        count: authFailuresTable.count,
        windowStart: authFailuresTable.windowStart,
      })
      .from(authFailuresTable)
      .where(lte(authFailuresTable.windowStart, windowCutoff));

    if (expiredRows.length === 0) return;

    const byIp = new Map<
      string,
      { slugs: Set<string>; totalFailures: number; firstSeen: number; lastSeen: number }
    >();

    for (const row of expiredRows) {
      const entry = byIp.get(row.ip) ?? {
        slugs: new Set<string>(),
        totalFailures: 0,
        firstSeen: row.windowStart,
        lastSeen: row.windowStart,
      };
      entry.slugs.add(row.slug);
      entry.totalFailures += row.count;
      if (row.windowStart < entry.firstSeen) entry.firstSeen = row.windowStart;
      if (row.windowStart > entry.lastSeen) entry.lastSeen = row.windowStart;
      byIp.set(row.ip, entry);
    }

    const crossAccountIps = [...byIp.entries()].filter(([, v]) => v.slugs.size >= 2);

    if (crossAccountIps.length > 0) {
      const values = crossAccountIps.map(([ip, v]) => ({
        ip,
        firstSeen: v.firstSeen,
        lastSeen: v.lastSeen,
        totalFailures: v.totalFailures,
        affectedSlugs: v.slugs.size,
        archivedAt: now,
      }));

      // Conflict on (ip, first_seen) — the natural deduplication key for a burst.
      // Repeated archiver runs seeing the same expired rows are silently ignored.
      await db
        .insert(crossAccountHistoryTable)
        .values(values)
        .onConflictDoNothing({ target: [crossAccountHistoryTable.ip, crossAccountHistoryTable.firstSeen] });
    }

    await db
      .delete(crossAccountHistoryTable)
      .where(lt(crossAccountHistoryTable.archivedAt, now - HISTORY_RETENTION_MS));
  } catch {
    // non-fatal — archive failures don't affect live security monitoring
  }
}

/**
 * Run archival once immediately, then on the interval.
 * Call this BEFORE startAuthFailureCleanup() in index.ts so the first startup
 * cleanup cycle does not delete cross-account rows before they are archived.
 */
export async function startCrossAccountArchiver(): Promise<void> {
  await archiveCrossAccountWindows();
  setInterval(() => void archiveCrossAccountWindows(), CLEANUP_INTERVAL_MS).unref();
}
