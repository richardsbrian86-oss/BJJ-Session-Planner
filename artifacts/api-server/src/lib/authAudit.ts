/**
 * Auth Audit — tracks failed login attempts and rate-limit hits.
 *
 * Failures are persisted to the `auth_failures` Postgres table so they
 * survive server restarts. Each (slug, IP) pair has a rolling window; when
 * the failure count within that window exceeds ALERT_THRESHOLD an alert
 * email is sent (suppressed for ALERT_COOLDOWN_MS so the owner isn't
 * flooded).
 *
 * Completed windows (either reset by a new failure or pruned by the cleanup
 * job) are moved to `auth_failure_history` so the instructor can see a
 * full 24-hour timeline of attack bursts on the security screen.
 *
 * Concurrency: all count mutations use a single atomic SQL upsert with CASE
 * expressions so there is no read-modify-write race. The alert "claim" uses
 * a conditional UPDATE ... WHERE alerted_at IS NULL OR alerted_at < cutoff,
 * which Postgres serialises at the row level — only the winner sends the email.
 *
 * History deduplication: auth_failure_history has a unique constraint on
 * (slug, ip, window_start), so ON CONFLICT (slug, ip, window_start) DO NOTHING
 * prevents duplicate rows under concurrent writes or overlapping cleanup runs.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { sendSuspiciousLoginAlert } from "./email";

const ALERT_THRESHOLD = Number(process.env.AUTH_ALERT_THRESHOLD ?? 5);
const ALERT_WINDOW_MS = Number(process.env.AUTH_ALERT_WINDOW_MS ?? 10 * 60 * 1000);
const ALERT_COOLDOWN_MS = Number(process.env.AUTH_ALERT_COOLDOWN_MS ?? 60 * 60 * 1000);

const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Record a failed login attempt for an (IP, slug) pair.
 * Fires an alert email if the threshold is crossed and no alert has been
 * sent recently. All state is persisted to Postgres atomically.
 */
export function recordLoginFailure(ip: string, slug: string): void {
  _recordLoginFailure(ip, slug).catch((err) =>
    logger.error({ err, ip, slug }, "authAudit: failed to persist login failure"),
  );
}

async function _recordLoginFailure(ip: string, slug: string): Promise<void> {
  const now = Date.now();
  const windowCutoff = now - ALERT_WINDOW_MS;
  const cooldownCutoff = now - ALERT_COOLDOWN_MS;

  // Single atomic upsert keyed on (slug, ip):
  //   • INSERT new row with count=1 if the (slug, ip) pair is unknown.
  //   • On conflict, reset or increment the count in one SQL round-trip:
  //     - If the existing window has expired → archive the old window to
  //       auth_failure_history using the deterministic (slug, ip, window_start)
  //       conflict key to prevent duplicates, then reset count/window.
  //     - Otherwise → increment count.
  //   alerted_at is intentionally left untouched here so cooldown survives
  //   window resets.
  const upsertResult = await db.execute<{
    count: number;
    window_start: string;
    alerted_at: string | null;
  }>(sql`
    WITH archive AS (
      INSERT INTO auth_failure_history (slug, ip, count, window_start, window_end, alerted_at)
      SELECT slug, ip, count, window_start, ${now}, alerted_at
      FROM auth_failures
      WHERE slug = ${slug}
        AND ip = ${ip}
        AND window_start < ${windowCutoff}
      ON CONFLICT (slug, ip, window_start) DO NOTHING
    )
    INSERT INTO auth_failures (slug, ip, count, window_start, alerted_at)
    VALUES (${slug}, ${ip}, 1, ${now}, NULL)
    ON CONFLICT (slug, ip) DO UPDATE SET
      count = CASE
        WHEN auth_failures.window_start < ${windowCutoff} THEN 1
        ELSE auth_failures.count + 1
      END,
      window_start = CASE
        WHEN auth_failures.window_start < ${windowCutoff} THEN ${now}
        ELSE auth_failures.window_start
      END
    RETURNING count, window_start, alerted_at
  `);

  const rec = upsertResult.rows[0];
  if (!rec) {
    logger.error({ ip, slug }, "authAudit: upsert returned no row");
    return;
  }

  const count = Number(rec.count);

  logger.warn(
    { ip, slug, failureCount: count, event: "auth_failure" },
    "Failed login attempt",
  );

  if (count >= ALERT_THRESHOLD) {
    // Claim the right to send an alert atomically.
    // Only the connection that successfully updates the row (condition passes
    // after acquiring the row lock) will proceed to send the email.
    const claimResult = await db.execute<{ alerted_at: string }>(sql`
      UPDATE auth_failures
      SET alerted_at = ${now}
      WHERE slug = ${slug}
        AND ip = ${ip}
        AND (alerted_at IS NULL OR alerted_at < ${cooldownCutoff})
      RETURNING alerted_at
    `);

    if (claimResult.rows.length > 0) {
      sendSuspiciousLoginAlert({
        ip,
        slug,
        failureCount: count,
        windowMs: ALERT_WINDOW_MS,
      }).catch((err) =>
        logger.error({ err }, "Failed to send suspicious login alert email"),
      );
    }
  }
}

/**
 * Start a periodic job that prunes stale rows from `auth_failures`.
 *
 * A row is safe to delete once both:
 *   • its failure window has expired  (window_start < now - ALERT_WINDOW_MS)
 *   • its alert cooldown has expired  (alerted_at IS NULL OR alerted_at < now - ALERT_COOLDOWN_MS)
 *
 * Before deleting, completed windows are archived to auth_failure_history
 * using ON CONFLICT (slug, ip, window_start) DO NOTHING to prevent duplicates.
 * The archive write happens at the moment of deletion, which is at cooldown
 * expiry. The API endpoint also surfaces expired-window rows directly from
 * auth_failures so there is no gap in the timeline during the cooldown period.
 *
 * The job also prunes auth_failure_history rows older than 24 hours.
 *
 * The job runs every CLEANUP_INTERVAL_MS (default: ALERT_WINDOW_MS + ALERT_COOLDOWN_MS).
 * Returns the interval handle so callers can clearInterval if needed.
 */
export function startAuthFailureCleanup(): ReturnType<typeof setInterval> {
  const DEFAULT_CLEANUP_INTERVAL_MS = ALERT_WINDOW_MS + ALERT_COOLDOWN_MS;
  const rawCleanupInterval = process.env.AUTH_FAILURE_CLEANUP_INTERVAL_MS;
  let CLEANUP_INTERVAL_MS: number;

  if (rawCleanupInterval !== undefined) {
    const parsed = Number(rawCleanupInterval);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      logger.warn(
        {
          value: rawCleanupInterval,
          fallback: DEFAULT_CLEANUP_INTERVAL_MS,
        },
        "authAudit: AUTH_FAILURE_CLEANUP_INTERVAL_MS is invalid (must be a positive finite number); " +
          "falling back to default",
      );
      CLEANUP_INTERVAL_MS = DEFAULT_CLEANUP_INTERVAL_MS;
    } else {
      CLEANUP_INTERVAL_MS = parsed;
    }
  } else {
    CLEANUP_INTERVAL_MS = DEFAULT_CLEANUP_INTERVAL_MS;
  }

  const runCleanup = async () => {
    const now = Date.now();
    const windowCutoff = now - ALERT_WINDOW_MS;
    const cooldownCutoff = now - ALERT_COOLDOWN_MS;
    const historyCutoff = now - HISTORY_RETENTION_MS;

    try {
      const result = await db.execute<{ count: string }>(sql`
        WITH to_archive AS (
          SELECT slug, ip, count, window_start, alerted_at
          FROM auth_failures
          WHERE window_start < ${windowCutoff}
            AND (alerted_at IS NULL OR alerted_at < ${cooldownCutoff})
        ),
        archived AS (
          INSERT INTO auth_failure_history (slug, ip, count, window_start, window_end, alerted_at)
          SELECT slug, ip, count, window_start, ${now}, alerted_at
          FROM to_archive
          ON CONFLICT (slug, ip, window_start) DO NOTHING
        ),
        deleted AS (
          DELETE FROM auth_failures
          WHERE window_start < ${windowCutoff}
            AND (alerted_at IS NULL OR alerted_at < ${cooldownCutoff})
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `);
      const deleted = Number(result.rows[0]?.count ?? 0);
      if (deleted > 0) {
        logger.info({ deleted }, "authAudit: pruned stale auth_failures rows");
      }

      // Prune history older than 24 hours.
      const historyResult = await db.execute<{ count: string }>(sql`
        WITH deleted AS (
          DELETE FROM auth_failure_history
          WHERE window_end < ${historyCutoff}
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `);
      const prunedHistory = Number(historyResult.rows[0]?.count ?? 0);
      if (prunedHistory > 0) {
        logger.info({ prunedHistory }, "authAudit: pruned old auth_failure_history rows");
      }

      // Guard: remove any orphaned rows (empty slug) that may have slipped in.
      const orphanResult = await db.execute<{ count: string }>(sql`
        WITH deleted AS (
          DELETE FROM auth_failures WHERE slug = ''
          RETURNING 1
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `);
      const prunedOrphans = Number(orphanResult.rows[0]?.count ?? 0);
      if (prunedOrphans > 0) {
        logger.warn({ prunedOrphans }, "authAudit: pruned orphaned auth_failures rows (empty slug) during periodic cleanup");
      }
    } catch (err) {
      logger.error({ err }, "authAudit: cleanup job failed");
    }
  };

  // One-time startup cleanup: remove orphaned rows that have no real instructor
  // account attached. These were created before the slug column was added and
  // were migrated with an empty string slug; they will never appear in any
  // instructor's security dashboard.
  db.execute(sql`
    DELETE FROM auth_failures WHERE slug = ''
  `)
    .then(({ rowCount }) => {
      if (rowCount && rowCount > 0) {
        logger.info({ deleted: rowCount }, "authAudit: removed orphaned auth_failures rows (empty slug)");
      }
    })
    .catch((err) =>
      logger.error({ err }, "authAudit: failed to remove orphaned auth_failures rows"),
    );

  // Run once immediately on startup, then on the interval.
  runCleanup();
  return setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}

/**
 * Per-slug account lockout threshold and window.
 *
 * If the total number of failed login attempts for a given slug (summed
 * across ALL source IPs) within ALERT_WINDOW_MS exceeds this value, the
 * account is considered temporarily locked.  This is independent of the
 * IP-based rate-limiter and stops distributed brute-force attacks where an
 * attacker rotates IPs to stay under the per-IP limit.
 */
const SLUG_LOCKOUT_THRESHOLD = Number(process.env.SLUG_LOCKOUT_THRESHOLD ?? 20);

/**
 * Returns true if the slug should be locked out due to too many cross-IP
 * failures within the current alert window.  Call this BEFORE verifying
 * the credential so the response time is consistent regardless of whether
 * the slug actually exists (slugs are already public via the directory).
 */
export async function isSlugLockedOut(slug: string): Promise<boolean> {
  try {
    const windowCutoff = Date.now() - ALERT_WINDOW_MS;
    const result = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(count), 0)::text AS total
      FROM auth_failures
      WHERE slug = ${slug}
        AND window_start > ${windowCutoff}
    `);
    const total = Number(result.rows[0]?.total ?? 0);
    return total >= SLUG_LOCKOUT_THRESHOLD;
  } catch {
    // Fail open — if DB is unavailable, do not block login.
    return false;
  }
}

/**
 * Record a rate-limit exhaustion for an IP (login or register endpoint).
 */
export function recordRateLimitHit(ip: string, endpoint: string): void {
  logger.warn(
    { ip, endpoint, event: "rate_limit_hit" },
    "Rate-limit window exhausted",
  );
}
