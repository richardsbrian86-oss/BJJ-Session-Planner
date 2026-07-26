/**
 * Post-build prerender script.
 *
 * Runs after `vite build` to inject crawlable HTML into the static output:
 *  - dist/public/_shell.html → SPA shell with noindex (for auth/transactional routes)
 *  - dist/public/404.html    → styled 404 error page with noindex
 *  - dist/public/index.html  → instructor directory with real <a> links (requires DB)
 *  - dist/public/{slug}/index.html → per-instructor profile pages (requires DB)
 *
 * The DB-dependent steps are skipped gracefully when DATABASE_URL is not set,
 * so the build never fails in environments without a database connection.
 *
 * Run via: tsx scripts/prerender.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const DIST = join(__dir, "../dist/public");
const PORTAL_BASE = "https://bjj-session-planner.replit.app/book";
const BOOK_PATH = "/book";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function updateHtml(
  base: string,
  opts: {
    title: string;
    description: string;
    canonical: string;
    ogTitle?: string;
    ogDescription?: string;
    ogUrl?: string;
    ogImage?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    bodyContent: string;
  }
): string {
  let html = base;

  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${esc(opts.title)}</title>`
  );

  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${esc(opts.description)}$2`
  );

  html = html.replace(
    /(<link rel="canonical" href=")[^"]*(")/,
    `$1${esc(opts.canonical)}$2`
  );

  if (opts.ogTitle) {
    html = html.replace(
      /(<meta property="og:title" content=")[^"]*(")/,
      `$1${esc(opts.ogTitle)}$2`
    );
  }
  if (opts.ogDescription) {
    html = html.replace(
      /(<meta property="og:description" content=")[^"]*(")/,
      `$1${esc(opts.ogDescription)}$2`
    );
  }
  if (opts.ogUrl) {
    html = html.replace(
      /(<meta property="og:url" content=")[^"]*(")/,
      `$1${esc(opts.ogUrl)}$2`
    );
  }
  if (opts.ogImage) {
    html = html.replace(
      /(<meta property="og:image" content=")[^"]*(")/,
      `$1${esc(opts.ogImage)}$2`
    );
  }

  if (opts.twitterTitle) {
    html = html.replace(
      /(<meta name="twitter:title" content=")[^"]*(")/,
      `$1${esc(opts.twitterTitle)}$2`
    );
  }
  if (opts.twitterDescription) {
    html = html.replace(
      /(<meta name="twitter:description" content=")[^"]*(")/,
      `$1${esc(opts.twitterDescription)}$2`
    );
  }
  if (opts.twitterImage) {
    html = html.replace(
      /(<meta name="twitter:image" content=")[^"]*(")/,
      `$1${esc(opts.twitterImage)}$2`
    );
  }

  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${opts.bodyContent}</div>`
  );

  return html;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error(`[prerender] dist dir not found at ${DIST}. Run vite build first.`);
    process.exit(1);
  }

  const baseHtml = readFileSync(join(DIST, "index.html"), "utf-8");

  // ── Always generated (no DB required) ────────────────────────────────────

  // _shell.html — SPA shell with noindex served by serve.mjs for
  // auth/transactional routes (/login, /signup, /booking/:token, etc.)
  const shellHtml = baseHtml.replace(
    /(<meta name="robots" content=")[^"]*(")/,
    "$1noindex, nofollow$2"
  );
  writeFileSync(join(DIST, "_shell.html"), shellHtml, "utf-8");
  console.log("[prerender] ✓ shell    → dist/public/_shell.html");

  // 404.html — styled static error page returned by serve.mjs for missing slugs
  const errorBodyContent = `
<div style="font-family:'Inter',sans-serif;background:#070b14;min-height:100vh;color:#eef0f4;display:flex;align-items:center;justify-content:center">
  <div style="text-align:center;padding:32px 20px;max-width:420px">
    <div style="width:64px;height:64px;background:rgba(239,68,68,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <h1 style="font-size:1.75rem;font-weight:800;margin:0 0 10px;color:#eef0f4">Page Not Found</h1>
    <p style="color:#8b9ab3;font-size:1rem;line-height:1.6;margin:0 0 28px">The page you are looking for does not exist. If you were given a booking link, please check with your instructor.</p>
    <a href="${BOOK_PATH}/" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:0.95rem">Browse Instructors</a>
  </div>
</div>`;

  let errorHtml = updateHtml(baseHtml, {
    title: "Page Not Found — Let's Roll",
    description: "The page you are looking for does not exist.",
    canonical: `${PORTAL_BASE}/`,
    bodyContent: errorBodyContent,
  });
  errorHtml = errorHtml.replace(
    /(<meta name="robots" content=")[^"]*(")/,
    "$1noindex, follow$2"
  );
  writeFileSync(join(DIST, "404.html"), errorHtml, "utf-8");
  console.log("[prerender] ✓ error    → dist/public/404.html");

  // ── DB-dependent steps ────────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.warn(
      "[prerender] DATABASE_URL not set — skipping instructor directory and profile prerender."
    );
    console.log("[prerender] Done (no DB). Shell and 404 pages generated.");
    return;
  }

  // Dynamic import after the DATABASE_URL guard so the module is never loaded
  // when the env var is absent, preventing Pool connection-attempt errors.
  const { db, instructorsTable, servicesTable, pool } = await import("@workspace/db");
  const { asc } = await import("drizzle-orm");

  console.log("[prerender] Fetching instructors from DB…");

  type Instructor = {
    id: number; name: string; slug: string; bio: string | null;
    location: string | null; phone: string | null; website: string | null; photoUrl: string | null;
  };
  type Service = { instructorId: number; id: number; name: string; price: number };

  let instructors: Instructor[] = [];
  let allServices: Service[] = [];

  try {
    instructors = await db
      .select({
        id: instructorsTable.id,
        name: instructorsTable.name,
        slug: instructorsTable.slug,
        bio: instructorsTable.bio,
        location: instructorsTable.location,
        phone: instructorsTable.phone,
        website: instructorsTable.website,
        photoUrl: instructorsTable.photoUrl,
      })
      .from(instructorsTable)
      .orderBy(asc(instructorsTable.name)) as Instructor[];

    allServices = await db
      .select({
        instructorId: servicesTable.instructorId,
        id: servicesTable.id,
        name: servicesTable.name,
        price: servicesTable.price,
      })
      .from(servicesTable)
      .orderBy(asc(servicesTable.name)) as Service[];
  } catch (err) {
    console.error("[prerender] DB query failed:", (err as Error).message);
    console.warn("[prerender] Skipping DB-dependent prerender due to DB error.");
    await pool.end().catch(() => {});
    return;
  }

  const servicesByInstructor = new Map<number, Service[]>();
  for (const svc of allServices) {
    const list = servicesByInstructor.get(svc.instructorId) ?? [];
    list.push(svc);
    servicesByInstructor.set(svc.instructorId, list);
  }

  // ── 1. Directory page: inject instructor link list ───────────────────────
  const listItems = instructors
    .map((i) => {
      const svcs = servicesByInstructor.get(i.id) ?? [];
      const subtitle = i.bio
        ? esc(i.bio.slice(0, 120))
        : svcs.length > 0
        ? `${svcs.length} service${svcs.length !== 1 ? "s" : ""} available`
        : "Private BJJ training sessions";
      return `<li style="margin-bottom:12px"><a href="${BOOK_PATH}/${esc(i.slug)}" style="display:block;padding:16px 20px;border:1px solid #1e2a3a;border-radius:14px;text-decoration:none;background:#0d1422"><strong style="display:block;font-size:16px;font-weight:700;color:#eef0f4;margin-bottom:4px">${esc(i.name)}</strong><span style="font-size:13px;color:#6b7a94">${subtitle}</span></a></li>`;
    })
    .join("\n");

  const directoryBodyContent = `
<div style="font-family:'Inter',sans-serif;background:#070b14;min-height:100vh;color:#eef0f4">
  <div style="max-width:720px;margin:0 auto;padding:40px 20px 60px">
    <h1 style="font-size:2.5rem;font-weight:900;margin-bottom:8px;color:#eef0f4">Find Your BJJ Coach</h1>
    <p style="color:#8b9ab3;font-size:1.1rem;margin-bottom:32px">Book private Brazilian Jiu-Jitsu sessions with certified instructors</p>
    <ul style="list-style:none;padding:0;margin:0">
      ${listItems}
    </ul>
  </div>
</div>`;

  const directoryTitle = "Find BJJ Private Lessons | Let's Roll";
  const directoryDesc = "Discover certified Brazilian Jiu-Jitsu instructors near you and book private training sessions online. No account required — instant confirmation.";
  const defaultOgImage = `${PORTAL_BASE}/opengraph.jpg`;

  const directoryHtml = updateHtml(baseHtml, {
    title: directoryTitle,
    description: directoryDesc,
    canonical: `${PORTAL_BASE}/`,
    ogTitle: directoryTitle,
    ogDescription: directoryDesc,
    ogUrl: `${PORTAL_BASE}/`,
    twitterTitle: directoryTitle,
    twitterDescription: "Discover certified Brazilian Jiu-Jitsu instructors near you and book private training sessions online.",
    twitterImage: defaultOgImage,
    bodyContent: directoryBodyContent,
  });

  writeFileSync(join(DIST, "index.html"), directoryHtml, "utf-8");
  console.log(`[prerender] ✓ directory → dist/public/index.html (${instructors.length} instructors)`);

  // ── 2. Per-instructor profile pages ─────────────────────────────────────
  for (const instructor of instructors) {
    const svcs = servicesByInstructor.get(instructor.id) ?? [];
    const canonicalUrl = `${PORTAL_BASE}/${instructor.slug}`;

    const description = instructor.bio
      ? `${instructor.bio.slice(0, 155)}${instructor.bio.length > 155 ? "…" : ""}`
      : `Book a private BJJ session with ${instructor.name}. ${svcs.length} service${svcs.length !== 1 ? "s" : ""} available.`;

    const svcItems = svcs
      .map(
        (s) =>
          `<li style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#111827;border-radius:10px;margin-bottom:8px"><span style="font-weight:600;color:#eef0f4">${esc(s.name)}</span><span style="font-weight:700;color:#f97316;font-size:1.1rem">${fmt(s.price)}</span></li>`
      )
      .join("\n");

    const profileBodyContent = `
<div style="font-family:'Inter',sans-serif;background:#070b14;min-height:100vh;color:#eef0f4">
  <div style="max-width:640px;margin:0 auto;padding:40px 20px 80px">
    <div style="margin-bottom:8px"><a href="${BOOK_PATH}/" style="color:#f97316;text-decoration:none;font-size:14px;font-weight:600">← All Instructors</a></div>
    <h1 style="font-size:2rem;font-weight:900;margin:16px 0 8px;color:#eef0f4">${esc(instructor.name)}</h1>
    ${instructor.bio ? `<p style="color:#8b9ab3;font-size:1rem;line-height:1.65;margin-bottom:20px">${esc(instructor.bio)}</p>` : ""}
    ${instructor.location ? `<p style="color:#6b7a94;font-size:0.9rem;margin-bottom:8px">📍 ${esc(instructor.location)}</p>` : ""}
    ${instructor.phone ? `<p style="color:#6b7a94;font-size:0.9rem;margin-bottom:8px">📞 ${esc(instructor.phone)}</p>` : ""}
    ${instructor.website ? `<p style="margin-bottom:20px"><a href="${esc(instructor.website)}" target="_blank" rel="noopener noreferrer" style="color:#f97316;font-size:0.9rem">${esc(instructor.website.replace(/^https?:\/\//, ""))}</a></p>` : ""}
    ${
      svcs.length > 0
        ? `<h2 style="font-size:1.1rem;font-weight:700;margin:24px 0 12px;color:#eef0f4">Available Services</h2><ul style="list-style:none;padding:0;margin:0 0 28px">${svcItems}</ul>`
        : ""
    }
    <a href="${BOOK_PATH}/${esc(instructor.slug)}/book" style="display:block;width:100%;text-align:center;background:#f97316;color:#fff;font-weight:700;font-size:1rem;padding:16px;border-radius:12px;text-decoration:none;box-sizing:border-box">Book a Session with ${esc(instructor.name)}</a>
  </div>
</div>`;

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: instructor.name,
      url: canonicalUrl,
      jobTitle: "BJJ Instructor",
      description: instructor.bio ?? undefined,
      address: instructor.location
        ? { "@type": "PostalAddress", addressLocality: instructor.location }
        : undefined,
      telephone: instructor.phone ?? undefined,
      sameAs: instructor.website ? [instructor.website] : undefined,
      image: instructor.photoUrl ?? undefined,
      offers: svcs.map((s) => ({
        "@type": "Offer",
        name: s.name,
        price: (s.price / 100).toFixed(2),
        priceCurrency: "USD",
        url: `${canonicalUrl}/book`,
      })),
    };

    const profileTitle = `${instructor.name} | BJJ Private Lessons | Let's Roll`;
    const profileOgImage = instructor.photoUrl || defaultOgImage;

    let profileHtml = updateHtml(baseHtml, {
      title: profileTitle,
      description,
      canonical: canonicalUrl,
      ogTitle: profileTitle,
      ogDescription: description,
      ogUrl: canonicalUrl,
      ogImage: profileOgImage,
      twitterTitle: profileTitle,
      twitterDescription: description,
      twitterImage: profileOgImage,
      bodyContent: profileBodyContent,
    });

    profileHtml = profileHtml.replace(
      "</head>",
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n</head>`
    );

    const slugDir = join(DIST, instructor.slug);
    mkdirSync(slugDir, { recursive: true });
    writeFileSync(join(slugDir, "index.html"), profileHtml, "utf-8");
    console.log(`[prerender] ✓ profile  → dist/public/${instructor.slug}/index.html`);
  }

  console.log(`[prerender] Done. ${instructors.length} profile pages generated.`);

  await pool.end().catch(() => {});
}

main().catch((err) => {
  console.error("[prerender] Fatal error:", err);
  process.exit(1);
});
