---
name: replit-vite-production-plugins
description: Gate Replit-specific Vite plugins (runtimeErrorOverlay, cartographer, devBanner) behind NODE_ENV !== "production" so they don't ship to end users. Use whenever a deployed Vite app shows a feedback modal, overlay, or unexpected Replit UI in production.
---

# Replit Vite Plugins — Production Safety

## Problem

Replit provides several Vite plugins that inject development tooling into the browser:

| Plugin | Package | Effect |
|---|---|---|
| `runtimeErrorOverlay()` | `@replit/vite-plugin-runtime-error-modal` | Overlays runtime errors on screen + feedback widget |
| `cartographer()` | `@replit/vite-plugin-cartographer` | File-navigation sidebar |
| `devBanner()` | `@replit/vite-plugin-dev-banner` | "Open in Replit" banner |

If `runtimeErrorOverlay()` is included unconditionally, it gets **bundled into the production JS** and renders a feedback modal/overlay that:
- Blocks the UI on mobile
- Shows "Send feedback to Replit" prompts to end users
- Overlaps controls on small screens

## Fix

All Replit-specific plugins must be conditional on `NODE_ENV !== "production"`. The cartographer and devBanner are typically already gated; `runtimeErrorOverlay` is the one most often missed:

```typescript
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    // Gate ALL Replit dev plugins on non-production
    ...(process.env.NODE_ENV !== "production" ? [runtimeErrorOverlay()] : []),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner()
          ),
        ]
      : []),
  ],
});
```

## Verification

After building with `NODE_ENV=production`, confirm the modal code is absent:

```bash
grep -c "runtimeError\|replit-runtime-error\|RuntimeError" dist/public/assets/index-*.js
# Should output: 0
```

## When to apply

Any React + Vite app in a Replit pnpm monorepo that will be deployed publicly. Check for `runtimeErrorOverlay()` in `vite.config.ts` whenever:
- A user reports a feedback modal or overlay blocking the UI in production
- A user reports unexpected popups on mobile in the deployed app
- Setting up a new Vite artifact from a Replit scaffold (the scaffold includes `runtimeErrorOverlay()` unconditionally)
