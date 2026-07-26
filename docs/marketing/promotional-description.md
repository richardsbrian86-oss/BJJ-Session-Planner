# Let's Roll — Promotional Marketing Copy

---

## TAGLINE OPTIONS

- **"Your mat. Your schedule. Your business."**
- **"Stop chasing payments. Start teaching BJJ."**
- **"The private training platform built for serious BJJ instructors."**
- **"Bookings, payments, and scheduling — so you can focus on the mat."**

---

## SHORT DESCRIPTION (150 characters — app store subtitle / social bio)

> Let's Roll is the all-in-one scheduler for BJJ private instructors — bookings, payments, and client management in one sleek app.

---

## APP STORE DESCRIPTION (400 words)

**Let's Roll — BJJ Private Training Scheduler**

Running a private BJJ program means wearing every hat: coach, scheduler, bookkeeper, and admin. Let's Roll strips all of that down to what matters — a clean, fast system that handles your business so you can stay on the mat.

**For Instructors**

Open the app, see exactly what your day looks like. Today's sessions, upcoming bookings, and anything pending — all at a glance with live stats. When a new client is ready to book, just share your personal booking link and everything else is handled automatically: they pick a date, choose a service, pay, and land on your schedule.

Set your availability once. Clients can only book times you've marked open. No back-and-forth, no double-bookings.

Manage your full service menu — private lessons, gi and no-gi sessions, competition prep, fundamentals packages — each with its own pricing. Multi-session packages automatically apply a 20% discount, giving clients a reason to commit longer term.

Payments go directly to your bank account through Stripe. No platform cut beyond Stripe's standard processing fee. Connect your account in minutes from inside the app.

**For Clients**

Every instructor gets a personal booking page at a shareable link. Clients see your name, services, and available times — then book and pay without creating an account. Confirmation emails land instantly, with calendar links for iOS and Google Calendar. If something changes, cancellation emails keep everyone informed.

Clients can pay per session or subscribe to a recurring package — both options are available at checkout, side by side.

**Built for the long term**

Let's Roll runs on a secure, production-grade backend with rate limiting, automatic IP banning on repeated failed logins, and a live security dashboard so you can see and manage any suspicious activity on your account. Your client data and payment details are handled with the same care as enterprise software.

Multi-instructor ready — each instructor has their own independent profile, schedule, and direct payout account.

**Key Features**
- Personal booking URL for each instructor
- Real-time session dashboard with filter views (Today / Upcoming / Past / All)
- Service menu with custom pricing and multi-session package discounts (20%)
- One-time payments and recurring subscriptions via Stripe
- Direct bank payouts — payments go straight to your Stripe account
- iOS and Google Calendar sync for clients
- Booking confirmation and cancellation emails
- Availability scheduling by day and time
- Offline support — app works without a connection, syncs when back online
- Security monitoring with suspicious login alerts and IP management
- Dark-themed, haptic-feedback mobile interface built for coaches on the go

---

## MEDIUM DESCRIPTION (website / product hunt / landing page — 200 words)

**Let's Roll** is a private training platform built specifically for Brazilian Jiu-Jitsu instructors who run their own programs. It combines a sleek instructor mobile app with a client-facing booking portal, connected by a payment system that puts money directly in your pocket.

Instructors get a personal booking link they can share anywhere — social media, text, email. Clients visit the page, see available services and pricing, pick a time that fits the instructor's set availability, and pay via Stripe. That's it. The instructor's app updates in real time.

Pricing is flexible: charge per session or offer recurring subscriptions. Multi-session packages automatically apply a 20% discount to reward client commitment. Payouts go directly to each instructor's connected Stripe account — no platform middleman taking a cut.

The mobile app gives instructors a live view of their schedule, a full service management panel, availability controls, and a security dashboard that monitors for suspicious login activity and lets them block bad actors directly from the app.

Whether you're a solo coach building your private program or a gym with multiple instructors, Let's Roll scales with you — each instructor gets their own independent account, booking page, and payout destination.

---

## SHORT BLURB (Twitter/X, Instagram caption, Replit profile — 280 chars)

> Let's Roll is the scheduling platform for BJJ private instructors. Share your booking link, set your availability, take payments directly — one-time or subscription. Client portal + mobile app + Stripe payouts built in. 🥋

---

## PRODUCT HUNT TAGLINE + DESCRIPTION

**Tagline:** The private BJJ training scheduler that actually pays you directly.

**Description:**
Let's Roll solves the three things that slow down private BJJ instructors: scheduling back-and-forth, chasing payments, and losing clients who never commit.

Each instructor gets a shareable booking URL. Clients pick a service, choose a time within the instructor's set availability, and pay via Stripe — one-time or recurring subscription. The 20% multi-session discount gives clients a push to book in bulk.

What makes it different:
- **Direct payouts** — Stripe Connect routes money straight to each instructor's bank account. No platform fee beyond Stripe's standard rate.
- **Instructor mobile app** — dark-themed, haptic-feedback dashboard for iOS and Android with real-time session tracking, offline support, and a live security monitor.
- **Client booking portal** — a clean web page each instructor can link from their bio or send via text. Calendar sync, confirmation emails, and cancellation flow all included.
- **Multi-instructor** — designed from the ground up to support a gym's full roster, each with independent accounts, profiles, and payouts.

Built on React Native (Expo), React/Vite, and Express/Postgres. Fully deployed and production-hardened.

---

## FEATURE BULLET LIST (for landing page / comparison table)

### Instructor App
- ✅ PIN-secured mobile login (iOS & Android)
- ✅ Live dashboard: today's sessions, upcoming, pending counts
- ✅ Session management with Upcoming / Today / Past / All filters
- ✅ Add, edit, and delete services with custom pricing
- ✅ Set weekly availability by day and session duration
- ✅ Share personal booking link from within the app
- ✅ Connect Stripe account for direct payouts
- ✅ Security tab: suspicious IP monitoring, ban management, attack timeline
- ✅ Offline mode with automatic cloud sync
- ✅ Haptic feedback throughout

### Client Booking Portal
- ✅ Instructor profile page at a personal URL (`/book/instructor-name`)
- ✅ Full booking flow — no account required for clients
- ✅ One-time session payments via Stripe
- ✅ Recurring subscription checkout via Stripe
- ✅ 20% automatic discount on multi-session packages
- ✅ Booking confirmation emails with calendar links (iOS + Google)
- ✅ Cancellation emails with tracking token
- ✅ Respects instructor availability — only open slots are bookable

### Platform & Security
- ✅ Multi-instructor with independent accounts and payouts
- ✅ Per-instructor Stripe Connect (Express accounts)
- ✅ Rate limiting on all auth and payment endpoints
- ✅ Automatic IP banning after repeated failed logins
- ✅ Persistent ban history with manual override
- ✅ Webhook signature verification for Stripe events
- ✅ HMAC tokens with 30-day expiry
- ✅ CORS locked to platform domain
- ✅ Helmet security headers on all API responses
- ✅ Production PostgreSQL with Drizzle ORM

---

## ABOUT THE TECH (for developer platforms / Replit showcase)

**Let's Roll** is a production-deployed, multi-component scheduling platform for BJJ private instructors.

**Stack:**
- **Mobile:** Expo / React Native — dark theme, offline-first with AsyncStorage caching, Stripe React Native SDK for in-app payments, haptic feedback, Expo Router tab navigation
- **Client Portal:** React + Vite + Tailwind — shareable instructor booking pages, Stripe Elements checkout, email confirmation flow
- **API Server:** Express 5 + Drizzle ORM + PostgreSQL — RESTful JSON API, custom HMAC auth tokens with expiry, pino structured logging
- **Payments:** Stripe (via Replit connector) with Stripe Connect for per-instructor Express account payouts — both one-time PaymentIntents and recurring Subscriptions with transfer_data routing
- **Email:** Resend for transactional booking confirmation and cancellation emails
- **Security:** express-rate-limit, custom IP ban manager (Postgres-backed, race-safe atomic upserts), Helmet, CORS origin allowlist, auth failure audit log with alert emails, security screen in mobile app

Fully deployed on Replit with a hardened production backend, structured logging, and a multi-instructor architecture supporting independent accounts, pricing, availability, and direct bank payouts per instructor.
