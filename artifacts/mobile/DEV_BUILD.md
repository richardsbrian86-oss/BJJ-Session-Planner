# Native Dev Build — Stripe Testing on a Real Device

`@stripe/stripe-react-native` uses native modules that **cannot run in Expo Go**. You need a custom development build installed on your device to test the Stripe payment sheet.

---

## Prerequisites

1. **Expo account** — create one free at https://expo.dev if you don't have one.
2. **Install project dependencies** from the repo root (EAS CLI is included):
   ```bash
   pnpm install
   ```
3. **Log in to EAS** (from `artifacts/mobile/`):
   ```bash
   pnpm exec eas login
   ```
4. **Link the project to your Expo account** (run once from `artifacts/mobile/`):
   ```bash
   pnpm exec eas init
   ```
   This writes your `expo.owner` into `app.json` automatically.

---

## Building for a Real Device

### Android (APK — easiest to sideload)

```bash
cd artifacts/mobile
pnpm exec eas build --profile development --platform android
```

- EAS uploads the build to the cloud and emails you when it's ready.
- Download the `.apk` from the EAS dashboard and install it on your Android device (enable "Install from unknown sources" in Settings).

### iOS (requires Apple Developer account)

```bash
cd artifacts/mobile
pnpm exec eas build --profile development --platform ios
```

- You will be prompted to log in to your Apple Developer account the first time.
- EAS handles provisioning profiles and certificates automatically.
- Install the resulting `.ipa` via the EAS dashboard link or TestFlight.

### iOS Simulator (no Apple account needed)

```bash
cd artifacts/mobile
pnpm exec eas build --profile development-simulator --platform ios
```

- Download the `.tar.gz` from the EAS dashboard and extract it.
- Drag the `.app` bundle into a running Simulator.

> **Note:** The native Stripe payment sheet uses card entry and may behave differently in the iOS Simulator. For full end-to-end payment testing (including Apple Pay), use a real physical device.

---

## Running the Dev Server After Installing the Build

Once the dev client app is on your device:

1. Start the local dev server:
   ```bash
   cd artifacts/mobile
   pnpm dev
   ```
2. Open the **Let's Roll** dev client app on your device.
3. Enter your dev server URL when prompted (shown in the terminal after `pnpm dev` starts).

---

## Testing the Stripe Payment Sheet

1. Ensure `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set to your **Stripe test-mode publishable key** (starts with `pk_test_`).
2. In the app, navigate to a session booking flow and tap **Pay**.
3. The native Stripe payment sheet should appear.
4. Use Stripe's test card numbers to complete a payment:
   - **Card number:** `4242 4242 4242 4242`
   - **Expiry:** any future date (e.g. `12/34`)
   - **CVC:** any 3 digits (e.g. `123`)
   - **ZIP:** any 5 digits (e.g. `10001`)
5. Confirm the payment succeeds and the booking is confirmed in the app.

Test card numbers for other scenarios: https://stripe.com/docs/testing#cards

---

## Enabling Apple Pay

The Stripe payment sheet shows an **Apple Pay** button automatically on real iOS devices once the merchant ID is registered in both Apple's and Stripe's portals. The merchant identifier is already set in `app.json`:

```
merchant.com.letsroll.bjj
```

### Step 1 — Register the merchant ID in Apple Developer portal

1. Go to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Click **+**, choose **Merchant IDs**, and click **Continue**.
3. Enter a description (e.g. `Let's Roll BJJ`) and the identifier `merchant.com.letsroll.bjj`.
4. Click **Register**.

### Step 2 — Enable Apple Pay for your App ID

1. In **Identifiers**, select the App ID for bundle `com.letsroll.bjj`.
2. Under **Capabilities**, enable **Apple Pay Payment Processing**.
3. Click **Edit** next to the capability, select the `merchant.com.letsroll.bjj` merchant ID, and save.

### Step 3 — Register the merchant ID in Stripe

1. In the [Stripe Dashboard](https://dashboard.stripe.com) → **Settings** → **Payment methods** → **Apple Pay**.
2. Click **Add domain** (for web) or **Add application** (for mobile).
3. For the mobile app, add your merchant ID `merchant.com.letsroll.bjj` and follow Stripe's certificate upload flow (Stripe generates an Apple Pay certificate signing request that you upload back to the Apple Developer portal).

### Step 4 — Rebuild and test

After completing the portal steps, rebuild the dev client:

```bash
cd artifacts/mobile
pnpm exec eas build --profile development --platform ios
```

Install the new build on a real iPhone. Tap **Pay** in a booking flow — you should see the Apple Pay button above the card entry fields in the Stripe payment sheet.

> **Note:** Apple Pay is not available in the iOS Simulator. Use a real device with a card added to Wallet.

---

## Build Profiles Summary

| Profile | Platform | Use case |
|---|---|---|
| `development` | iOS / Android | Real device with dev client + Stripe testing |
| `development-simulator` | iOS only | Simulator testing (card entry; Apple Pay not available) |
| `preview` | iOS / Android | Share a testable build without Expo dev tools |

---

## Troubleshooting

- **"invariant violation: native module cannot be null"** — You are running in Expo Go. Install the dev client build instead.
- **Stripe sheet does not appear** — Check that `@stripe/stripe-react-native` plugin is listed in `app.json` → `plugins` (it is) and that a valid publishable key is provided.
- **Build fails on EAS** — Run `pnpm exec eas diagnostics` or check the build log URL printed in the terminal.
