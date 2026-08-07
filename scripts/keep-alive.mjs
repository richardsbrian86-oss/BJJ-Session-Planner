#!/usr/bin/env node
/**
 * Keep-Alive Service for Let's Roll
 * Pings all running services every 4 minutes to prevent idle timeout.
 * Logs a timestamped heartbeat so Replit knows the process is active.
 */

const INTERVAL_MS = 4 * 60 * 1000;
const TIMEOUT_MS  = 8_000;

const DEV = process.env.REPLIT_DEV_DOMAIN;

const SERVICES = DEV
  ? [
      { name: "API Server",    url: `https://${DEV}/api/healthz` },
      { name: "Client Portal", url: `https://${DEV}/` },
    ]
  : [];

async function ping({ name, url }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok
      ? `✓ ${name} (${res.status})`
      : `✗ ${name} (HTTP ${res.status})`;
  } catch (err) {
    clearTimeout(timer);
    const reason = err.name === "AbortError" ? "timeout" : err.message;
    return `✗ ${name} — ${reason}`;
  }
}

async function heartbeat() {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  if (SERVICES.length === 0) {
    console.log(`[${ts}] ♥  keep-alive running (REPLIT_DEV_DOMAIN not set)`);
    return;
  }
  const results = await Promise.all(SERVICES.map(ping));
  console.log(`[${ts}] ♥  ${results.join("  |  ")}`);
}

const mins = INTERVAL_MS / 60_000;
console.log(
  `[keep-alive] Started — ${SERVICES.length} service(s), ping every ${mins} min` +
  (DEV ? ` (${DEV})` : "")
);

heartbeat();
setInterval(heartbeat, INTERVAL_MS);
