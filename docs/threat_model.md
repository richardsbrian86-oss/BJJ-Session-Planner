# Threat Model

## Project Overview

BJJ Session Planner is a pnpm monorepo with a public React booking portal, an Expo mobile app for instructors, and an Express 5 API backed by PostgreSQL via Drizzle ORM. The deployed production surface is public (`https://bjj-session-planner.replit.app`), so unauthenticated internet users can reach the public booking endpoints and the client-account routes, while any authenticated instructor can reach instructor APIs from the mobile app.

Production-relevant code lives primarily in `artifacts/api-server`, `artifacts/client-portal`, `artifacts/mobile`, and `lib/db`. `artifacts/mockup-sandbox` is development-only and should be ignored unless separately shown to be production-reachable. Platform TLS is handled by Replit and should not be treated as an app-layer gap.

## Assets

- **Instructor accounts and bearer tokens** — instructor identities, PIN-derived access, and signed HMAC tokens. Compromise allows full access to that instructor's sessions, services, availability, and Stripe onboarding state.
- **Client accounts and bearer tokens** — client email identities, password-reset capability, signed client tokens, and any booking data later authorized through those identities.
- **Client booking data** — names, email addresses, phone numbers, booking dates/times, notes, cancellation links, and payment status stored in `sessions`.
- **Payment state and Stripe linkage** — PaymentIntent IDs, subscription IDs, Stripe account connection state, and connected-account routing data.
- **Waiver and consent records** — external-student flags, waiver-signed state, waiver timestamps, waiver document URLs, and captured signature artifacts. These records gate booking flow and may also carry legal significance.
- **Abuse-prevention data** — IP ban tables, strike counters, and login-failure telemetry. This data influences whether attackers are blocked and should not be modifiable by ordinary users.
- **Application secrets and integration credentials** — `APP_SECRET`, Stripe credentials, webhook secret, email credentials, and database connection information.

## Trust Boundaries

- **Public client/server boundary** — `/api/public/*`, `/api/instructors/register`, `/api/instructors/login`, `/api/clients/register`, `/api/clients/login`, password-reset routes, and `/api/payments/webhook` receive untrusted input from the internet.
- **Authenticated instructor/server boundary** — bearer-style instructor tokens gate `/api/sessions`, `/api/services`, `/api/availability`, `/api/security`, `/api/admin`, `/api/payments`, and `/api/instructor/connect`.
- **Authenticated client/server boundary** — bearer-style client tokens gate `/api/clients/me` and `/api/clients/bookings`, which can expose booking history and capability URLs.
- **Server/database boundary** — Express route handlers have direct write access to booking, instructor, abuse-control, and payment metadata tables.
- **Server/Stripe boundary** — payment creation, subscription setup, webhook verification, and Connect onboarding depend on server-side Stripe API calls and metadata validation.
- **Cross-tenant boundary between instructors** — each instructor should only access their own sessions, availability, services, and security telemetry. Global abuse-control data and other instructors' telemetry are higher-trust data.
- **Guest booking/client-account boundary** — public guest bookings are tied to email addresses and later intersect with authenticated client accounts; ownership of a client account MUST not be assumed solely from a claimed email string.
- **Waiver/compliance boundary** — public waiver interactions cross from unauthenticated user input into trusted consent and booking-gating state; waiver acceptance MUST not be writable by arbitrary callers without proof of the actor and the signed artifact being accepted.
- **Device/local storage boundary** — the mobile app stores instructor state locally, but production vulnerabilities should focus on server-reachable weaknesses unless local compromise directly creates remote account compromise.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/client-portal/src/App.tsx`, `artifacts/mobile/utils/apiClient.ts`.
- **Highest-risk server files:** `artifacts/api-server/src/routes/public.ts`, `payments.ts`, `instructors.ts`, `clients.ts`, `sessions.ts`, `security.ts`, `admin.ts`, `connect.ts`.
- **Public surface:** booking, waiver, login/register, client signup/login/reset, webhook, Stripe key, cancellation-link lookup/cancel.
- **Authenticated surface:** instructor CRUD, client booking-history APIs, payment actions, security telemetry, IP-ban management, Stripe Connect.
- **Usually dev-only / lower priority:** `artifacts/mockup-sandbox/**`, build outputs under `dist/`, local workflow logs.

## Threat Categories

### Spoofing

Instructor authentication relies on signed HMAC bearer tokens returned by the login and registration endpoints. Protected API routes MUST reject missing, malformed, expired, or tampered tokens, and any public route that acts on Stripe state MUST independently verify payment objects or webhook signatures server-side rather than trusting the client.

### Tampering

The public booking flow accepts untrusted booking details and payment references from the browser. Prices, package discounts, instructor association, payment completion status, and waiver state MUST be recomputed or verified on the server before a booking is created. Booking finalization MUST prevent replay and concurrency races so one payment, one waiver, and one time slot cannot be consumed multiple times. Authenticated instructors MUST NOT be able to tamper with global abuse-control data unless an explicit privileged role exists and is enforced server-side.

### Information Disclosure

Booking records contain client contact data and private notes, and the security subsystem records attack telemetry and banned IPs. Public cancellation links MUST be unguessable capability URLs, guest-booking data tied to an email address MUST not become visible to whoever first claims that email in a client account, and authenticated instructor APIs MUST not expose other instructors' bookings, telemetry, or global operational data unless that sharing is explicitly intended and access-controlled. Public pre-booking status checks such as waiver lookups SHOULD avoid revealing whether a person exists in the client database or what compliance state is stored for them.

### Denial of Service

Public booking and login endpoints are reachable from the internet and can trigger database work, Stripe object creation, and email sends. Sensitive unauthenticated endpoints MUST enforce appropriate rate limits and avoid attacker-controlled resource amplification. Abuse-prevention routes and ban state MUST not be removable by ordinary attacker-created instructor accounts.

### Elevation of Privilege

The codebase currently models only ordinary instructors; no admin role exists in the persisted schema. Any endpoint that reads or mutates platform-wide security controls, cross-instructor telemetry, or shared operational state MUST therefore introduce and enforce explicit privilege checks rather than relying on ordinary instructor authentication alone. Likewise, client-account creation and recovery flows MUST provide a trustworthy proof of account ownership before they are allowed to unlock booking histories or other email-bound records.
