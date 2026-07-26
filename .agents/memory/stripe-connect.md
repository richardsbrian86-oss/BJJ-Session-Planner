---
name: Stripe Connect Instructor Payouts
description: How Stripe Connect is wired so each instructor receives client payments into their own bank account.
---

## The Rule
Each instructor who wants to receive payments must connect their own Stripe Express account. Payments route to the instructor's account via `transfer_data.destination`. Instructors who haven't connected still work — payments just stay on the platform account.

**Why:** The app is a multi-instructor platform. Each instructor is an independent business that needs their own bank account/payouts.

**How to apply:** Always check `instructor.stripeAccountId && instructor.stripeAccountEnabled` before adding `transfer_data` to payment intents.

## DB Schema (instructorsTable)
- `stripeAccountId: text` — Stripe Express account ID (`acct_...`), set on first onboard call
- `stripeAccountEnabled: boolean` — mirrors `account.charges_enabled` from Stripe; updated lazily on `GET /api/instructor/connect/status`

## Backend Routes (`/api/instructor/connect/*`)
- `POST /onboard` — creates Express account (if not exists) + returns account link URL. Requires `requireInstructor` auth.
- `GET /status` — retrieves live account state from Stripe, syncs `stripeAccountEnabled` in DB. Requires `requireInstructor` auth.
- `GET /return` — styled HTML page served after Stripe onboarding completes ("Setup complete, close tab").
- `GET /refresh` — styled HTML page when onboarding link expires ("Return to app and tap Connect again").

## Payment Intent Routing (`public.ts` — `/:slug/create-intent`)
When `instructor.stripeAccountId && instructor.stripeAccountEnabled`:
```ts
intentParams.transfer_data = { destination: instructor.stripeAccountId };
```
This causes Stripe to charge the client and automatically transfer funds to the instructor's connected account (minus Stripe fees).

## Known Gap: Subscriptions
Subscription creation in `/:slug/create-subscription` still goes to the platform account. Connect subscriptions require `on_behalf_of` + API calls made with the connected account header — significantly more complex. Planned as a follow-up.

## Mobile UX
- `api.connect.getStatus()` and `api.connect.startOnboarding()` in `apiClient.ts`
- `services.tsx`: "Stripe Payouts" section below service list shows live status badge + "Connect Stripe Account" button that calls `startOnboarding()` and opens the URL with `Linking.openURL()`.
- Status refreshes on every tab focus (`useFocusEffect`).

## Onboarding Flow
1. Instructor taps "Connect Stripe Account" in Services tab
2. App calls `POST /api/instructor/connect/onboard` → gets Stripe account link URL
3. `Linking.openURL(url)` opens Stripe's hosted onboarding in device browser
4. After completing, Stripe redirects to `/api/instructor/connect/return` (styled HTML page)
5. Instructor returns to app; `useFocusEffect` triggers `fetchConnectStatus()` which calls `GET /api/instructor/connect/status` → syncs and shows "Active" status
