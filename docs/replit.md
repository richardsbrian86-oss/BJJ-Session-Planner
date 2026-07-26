# Let's Roll — BJJ Private Training Scheduler

A production-deployed, multi-instructor scheduling platform for Brazilian Jiu-Jitsu private coaches. Instructors manage their business from a mobile app; clients book and pay through a personal web portal link.

## User Preferences

- Prefer direct, technical answers — no hand-holding
- Keep changes minimal and scoped to what was asked
- Always run the build before marking work complete
- Prefer `pnpm` for all package management

---

## Architecture

Three deployed artifacts + one shared library:

```
artifacts/
  api-server/       Express 5 REST API          port 8080
  client-portal/    React + Vite booking portal  path /book/
  mobile/           Expo React Native app        path /mobile
  mockup-sandbox/   Component preview server     path /__mockup
lib/
  db/               Drizzle ORM schema + client  (shared)
  token/            HMAC token helpers           (shared)
  api-spec/         OpenAPI spec + Orval codegen (shared)
```

**Stack:** pnpm workspaces · TypeScript 5.9 · Node.js 24 · Express 5 · PostgreSQL · Drizzle ORM · esbuild · Expo SDK 54 · React Native · React + Vite · Tailwind CSS · Stripe v22 · Resend

---

## Database Schema

All tables are in `lib/db/src/schema/`. Push changes with `pnpm --filter @workspace/db run push`.

| Table | Purpose |
|---|---|
| `instructors` | id, name, slug (unique), pin_hash, stripe_account_id, stripe_account_enabled, created_at |
| `sessions` | Client bookings — clientName, clientEmail, date, time, serviceName, servicePrice, packageCount, packageTotal, status, paymentStatus, paymentIntentId, cancellationToken, calendarEventId |
| `services` | Instructor service catalog — name, price (dollars float) |
| `availability` | Per-day availability — day (0–6), enabled, startTime, endTime, sessionDurationMinutes |
| `ip_bans` | Active IP bans — ip (PK), until (bigint ms) |
| `ip_strikes` | Rate-limit exhaustion counter — ip (PK), count, last_window_start |
| `ip_ban_history` | Historical bans — id, ip, banned_at, until, unbanned_at, reason, lifted_early |
| `auth_failures` | Failed login tracking — slug+ip (unique), count, window_start, alerted_at |
| `auth_failure_history` | Archived failure windows — slug, ip, count, window_start, window_end, alerted_at (unique on slug+ip+window_start) |

---

## Authentication

Instructors authenticate with a **PIN** (bcrypt/scrypt hashed). Login returns a custom **HMAC-SHA256 token**.

**Token format:** `{instructorId}.{issuedAt}.{hmac}`
- `APP_SECRET` env var required in production (throws otherwise)
- Tokens expire after **30 days** (checked in `verify()`)
- Timing-safe comparison via `timingSafeEqual`
- Mobile app stores token in AsyncStorage, sends as `x-instructor-token` header (also accepts `Authorization: Bearer`)

Token code: `artifacts/api-server/src/lib/token.ts`
Auth middleware: `artifacts/api-server/src/lib/auth.ts`

---

## API Endpoints

All routes under `/api`. Base: `artifacts/api-server/src/routes/`.

### Public (no auth)
| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Health check |
| POST | `/api/instructors/register` | Create instructor — returns `{ id, slug, token }` |
| POST | `/api/instructors/login` | PIN login — returns `{ id, slug, name, token }` |
| GET | `/api/public/:slug` | Instructor profile, services, availability |
| GET | `/api/public/stripe-key` | Stripe publishable key |
| POST | `/api/public/:slug/create-intent` | Stripe PaymentIntent (one-time) |
| POST | `/api/public/:slug/create-subscription` | Stripe subscription (recurring) |
| POST | `/api/public/:slug/session` | Create booking after payment |
| GET | `/api/public/cancel/:token` | Cancel booking via email link |

### Instructor (requires `x-instructor-token`)
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/sessions` | List / create sessions (scoped to instructor) |
| PATCH/DELETE | `/api/sessions/:id` | Update / delete session |
| GET/POST | `/api/services` | List / create services |
| PATCH/DELETE | `/api/services/:id` | Update / delete service |
| GET | `/api/availability` | Get availability |
| PUT | `/api/availability` | Replace all availability rows |
| POST | `/api/instructor/connect/onboard` | Start Stripe Connect onboarding |
| GET | `/api/instructor/connect/status` | Stripe Connect account status |
| GET/POST | `/api/instructor/connect/return` | OAuth return URL |
| GET | `/api/security/events` | Auth failures targeting this instructor (current window) |
| GET | `/api/security/cross-account-events` | Failures targeting other instructors (threat intel) |
| GET | `/api/admin/bans` | List active IP bans (`?history=true` includes 30-day history) |
| GET | `/api/admin/bans/history` | Ban history (alias) |
| DELETE | `/api/admin/bans/:ip` | Manually unban an IP |

### Stripe Webhook
| Method | Path | Description |
|---|---|---|
| POST | `/api/payments/webhook` | Handles `payment_intent.succeeded`, `invoice.paid` |

Webhook signature verified using `STRIPE_WEBHOOK_SECRET`. Raw body captured in `express.json` verify callback.

---

## Payments — Stripe

Uses **Replit Stripe connector** (no manual `STRIPE_SECRET_KEY` needed). Get client via `getStripeClient()` from `@replit/agent-integrations/stripe`.

**Publishable key** served from `GET /api/public/stripe-key` — clients fetch it dynamically.

**Stripe Connect:** Each instructor can connect a Stripe Express account via `/api/instructor/connect/onboard`. When connected and enabled, payments route directly to their bank via `transfer_data.destination`. Both one-time PaymentIntents and Subscriptions include this routing.

**20% multi-session discount** applied automatically on package bookings (computed server-side).

---

## Security

All hardening in `artifacts/api-server/src/`:

| Layer | Implementation |
|---|---|
| Security headers | `helmet()` in `app.ts` — HSTS, X-Frame-Options, etc. |
| CORS | Origin allowlist from `REPLIT_DEV_DOMAIN` + `REPLIT_DOMAINS` env vars |
| Rate limiting | `express-rate-limit` on login (10/15min), register (5/15min), payment/booking endpoints (30/15min) |
| IP bans | `lib/banManager.ts` — atomic Postgres upserts, 3 consecutive exhausted windows → 1hr ban, persists across restarts |
| Auth audit | `lib/authAudit.ts` — per-(slug,ip) failure tracking, alert email after N failures, archived to `auth_failure_history` |
| Token security | 30-day expiry, `timingSafeEqual`, `APP_SECRET` required in production |
| Pool resilience | `pool.on('error', ...)` in `lib/db/src/index.ts` prevents idle-connection drops from crashing the process |
| Process safety | `uncaughtException` + `unhandledRejection` handlers in `artifacts/api-server/src/index.ts` |

### Security environment knobs (all optional)
```
AUTH_ALERT_THRESHOLD         # failures before email alert fires (default: 5)
AUTH_ALERT_WINDOW_MS         # rolling window (default: 600000 = 10 min)
AUTH_ALERT_COOLDOWN_MS       # min time between alerts per IP (default: 3600000 = 1 hr)
AUTH_FAILURE_CLEANUP_INTERVAL_MS  # cleanup job interval (default: window + cooldown)
ALERT_EMAIL                  # recipient for security alert emails
```

---

## Email — Resend

`artifacts/api-server/src/lib/email.ts` — requires `RESEND_API_KEY` + `FROM_EMAIL` env vars.

| Function | Trigger |
|---|---|
| `sendConfirmationEmail` | After booking created |
| `sendCancellationEmail` | When session status → cancelled |
| `sendSuspiciousLoginAlert` | When IP hits `AUTH_ALERT_THRESHOLD` failures |

---

## Mobile App

**Expo SDK 54 / React Native** — `artifacts/mobile/`

Tabs: Dashboard · Book · Availability · Services · Security

Key features:
- PIN login with `APP_SECRET`-backed HMAC tokens stored in AsyncStorage
- Session dashboard with Upcoming/Today/Past/All filters and live stat cards
- Offline mode — AsyncStorage cache, syncs on reconnect
- Share booking link modal (generates `https://<domain>/book/<slug>`)
- Book tab — creates sessions directly from the app
- Availability tab — set weekly schedule with start/end times and session duration
- Services tab — manage pricing menu + Stripe Connect onboarding
- Security tab — suspicious IP list, active bans with unblock action, ban history, attack timeline (24h), cross-account threats; live badge on tab icon polls every 60s

---

## Client Booking Portal

**React + Vite + Tailwind** — `artifacts/client-portal/` — served at `/book/`

Routes:
- `/book/:slug` — instructor profile + service list
- `/book/:slug/book` — booking flow with Stripe Elements (one-time or subscription)
- `/book/:slug/success` — confirmation page
- `/book/booking/:token` — cancellation page (linked from email)

Fetches Stripe publishable key from API at load time. Calendar add links (`.ics` / Google Calendar) on confirmation page. No client account required.

---

## Key Commands

```bash
# Dev
pnpm --filter @workspace/api-server run dev   # API server (builds then starts)
pnpm --filter @workspace/client-portal run dev # Vite dev server
pnpm --filter @workspace/mobile run dev        # Expo Metro bundler

# Build
pnpm --filter @workspace/api-server run build  # esbuild → dist/index.mjs

# Database
pnpm --filter @workspace/db run push           # Apply schema changes to dev DB

# API codegen (after editing lib/api-spec/openapi.yaml)
pnpm --filter @workspace/api-spec run codegen  # → Zod schemas + React Query hooks
```

---

## Environment Variables

| Variable | Required | Source |
|---|---|---|
| `DATABASE_URL` | Yes | Auto-provisioned by Replit |
| `APP_SECRET` | Yes (prod) | Replit secret — 64-char hex |
| `STRIPE_WEBHOOK_SECRET` | Yes (prod) | Replit secret |
| `RESEND_API_KEY` | Yes | Replit secret |
| `FROM_EMAIL` | Yes | Replit env var |
| `REPLIT_DEV_DOMAIN` | Auto | Replit-injected |
| `REPLIT_DOMAINS` | Auto | Replit-injected |
| `ALERT_EMAIL` | Optional | For security alert emails |
| `AUTH_ALERT_THRESHOLD` | Optional | Default: 5 |

Stripe credentials are managed by the **Replit Stripe connector** — do NOT set `STRIPE_SECRET_KEY` manually.

---

## Deployment Notes

- API server runs the **pre-built** `dist/index.mjs` in production (not the dev build/watch loop)
- Client portal is served as a **static build** from `artifacts/client-portal/dist/public/`
- Mobile app runs a lightweight Express serve script in production
- After merging task-agent branches, always run `pnpm --filter @workspace/db run push` — task agents sometimes apply schema changes via raw SQL that miss the dev DB
- `auth_failures` table requires columns: `ip`, `count`, `window_start`, `alerted_at`, `slug` — and a UNIQUE constraint on `(slug, ip)`
