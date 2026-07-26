/**
 * Production server for the Let's Roll client booking portal.
 *
 * Replaces static file serving so that route-aware HTTP 404 responses are
 * returned for non-existent instructor slugs and booking tokens BEFORE any
 * SPA shell is sent to the client.  This prevents soft-404 indexing by
 * search engines and satisfies the "real HTTP 404" requirement for missing
 * public portal resources.
 *
 * Route logic:
 *   /book/                       → prerendered directory index.html        (200)
 *   /book/assets/*, /book/*.svg  → static assets served directly           (200)
 *   /book/robots.txt, llms.txt … → public static files                    (200)
 *   /book/:slug                  → prerendered {slug}/index.html if exists (200)
 *                                  DB-validates slug; 404 if unknown        (404)
 *   /book/login  /signup …       → SPA shell (_shell.html)                 (200)
 *   /book/dashboard              → SPA shell                               (200)
 *   /book/booking/:token         → validates UUID token in DB; 404 if gone (404)
 *   /book/:slug/book             → validates slug; 404 if unknown           (404)
 *   /book/:slug/success          → validates slug; 404 if unknown           (404)
 *   anything else                → 404                                     (404)
 */

import { createServer } from "http";
import { createReadStream, existsSync, statSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/public");
const PORT = parseInt(process.env.PORT || "25516", 10);
const BASE = "/book";

// ── Database (optional) ──────────────────────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

if (pool) {
  pool.on("error", (err) => {
    console.error("[portal-serve] pg pool idle error:", err.message);
  });
} else {
  console.warn("[portal-serve] DATABASE_URL not set — 404 validation disabled, serving shell for all routes");
}

async function slugExists(slug) {
  if (!pool) return true;
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM instructors WHERE slug = $1 LIMIT 1",
      [slug]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[portal-serve] DB slug check error:", err.message);
    return true; // conservative: serve shell on DB failure
  }
}

async function tokenExists(token) {
  if (!pool) return true;
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM sessions WHERE cancellation_token = $1 LIMIT 1",
      [token]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[portal-serve] DB token check error:", err.message);
    return true;
  }
}

// ── File serving helpers ─────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".txt":  "text/plain; charset=utf-8",
  ".xml":  "application/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function serveFile(res, filePath, status = 200) {
  const ext = extname(filePath).toLowerCase();
  const isHtml = ext === ".html";
  res.writeHead(status, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": isHtml ? "no-cache, no-store, must-revalidate" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(filePath).pipe(res);
}

function serve404(res) {
  const p = join(DIST, "404.html");
  if (existsSync(p)) {
    serveFile(res, p, 404);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
}

function serveShell(res) {
  const shellPath = join(DIST, "_shell.html");
  if (existsSync(shellPath)) {
    serveFile(res, shellPath);
  } else {
    serveFile(res, join(DIST, "index.html"));
  }
}

// ── Known auth / dashboard routes — no DB validation needed ─────────────────
const SPA_EXACT = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/dashboard",
]);

// Health-check path (used by deployment platform startup probe)
const HEALTH_PATH = `${BASE}/healthz`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

// ── Request handler ──────────────────────────────────────────────────────────
async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // Health check — responds before any file/DB logic
    if (pathname === HEALTH_PATH || pathname === `${BASE}/healthz/`) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Must be under /book
    if (!pathname.startsWith(BASE)) {
      serve404(res);
      return;
    }

    // Strip /book prefix; result starts with "/" or is ""
    const localPath = pathname.slice(BASE.length) || "/";
    // Remove leading slash before join() — path.join("/dist", "/foo") resolves
    // to "/foo" (ignores DIST), so we always pass a relative segment.
    const relPath = localPath.replace(/^\/+/, "");

    // ── 1. Static assets — serve directly without DB check ───────────────
    if (relPath !== "") {
      const staticFile = join(DIST, relPath);
      if (existsSync(staticFile) && statSync(staticFile).isFile()) {
        const ext = extname(staticFile).toLowerCase();
        // Serve static assets directly; skip HTML files (handle via routes below)
        if (ext !== ".html") {
          serveFile(res, staticFile);
          return;
        }
      }
    }

    const segments = localPath.split("/").filter(Boolean);

    // ── 2. Root — prerendered directory ──────────────────────────────────
    if (segments.length === 0) {
      const dirPage = join(DIST, "index.html");
      if (existsSync(dirPage)) {
        serveFile(res, dirPage);
      } else {
        serveShell(res);
      }
      return;
    }

    // ── 3. Single segment ─────────────────────────────────────────────────
    if (segments.length === 1) {
      const seg = segments[0];

      // Auth / dashboard routes
      if (SPA_EXACT.has(`/${seg}`)) {
        serveShell(res);
        return;
      }

      // Instructor profile — validate slug
      if (!SLUG_RE.test(seg)) {
        serve404(res);
        return;
      }

      // Try prerendered file first (fastest path)
      const prerendered = join(DIST, seg, "index.html");
      if (existsSync(prerendered)) {
        serveFile(res, prerendered);
        return;
      }

      // Not prerendered — check DB
      const exists = await slugExists(seg);
      if (!exists) {
        serve404(res);
        return;
      }
      // Valid slug but not yet prerendered (e.g. new instructor since last build)
      serveShell(res);
      return;
    }

    // ── 4. Two-segment paths ──────────────────────────────────────────────
    if (segments.length === 2) {
      const [first, second] = segments;

      // /booking/:token — booking confirmation
      if (first === "booking") {
        if (!UUID_RE.test(second)) {
          serve404(res);
          return;
        }
        const exists = await tokenExists(second);
        if (!exists) {
          serve404(res);
          return;
        }
        serveShell(res);
        return;
      }

      // /:slug/book or /:slug/success — booking flow
      if (second === "book" || second === "success") {
        if (!SLUG_RE.test(first)) {
          serve404(res);
          return;
        }
        const exists = await slugExists(first);
        if (!exists) {
          serve404(res);
          return;
        }
        serveShell(res);
        return;
      }
    }

    // ── 5. Everything else → 404 ──────────────────────────────────────────
    serve404(res);
  } catch (err) {
    console.error("[portal-serve] Unhandled error:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
}

// ── Start server ─────────────────────────────────────────────────────────────
const server = createServer(handleRequest);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[portal-serve] Listening on port ${PORT} (base: ${BASE})`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    pool?.end().catch(() => {});
    process.exit(0);
  });
});

process.on("uncaughtException", (err) => {
  console.error("[portal-serve] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[portal-serve] Unhandled rejection:", reason);
});
