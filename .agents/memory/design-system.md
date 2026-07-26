---
name: Design system — Let's Roll
description: Color tokens and design decisions for the teal + amber + deep navy theme applied across all three artifacts.
---

# Let's Roll Design System

## Core tokens
- **Primary accent**: `#1aab90` (teal — matches "let's" in the logo), dark: `#128a74`
- **Secondary accent**: `#e8a020` (amber/gold — matches "roll" in the logo)
- **Background**: `#070b14` (deep navy)
- **Card / surface**: `#0d1422` / `#0b101d`
- **Border**: `rgba(255,255,255,0.07)` on web; `#1a2540` on mobile
- **Muted text**: `#8b9ab3` / `#4a5568`
- **Foreground**: `#eef0f4`

## Where each artifact sets its theme
- **Client portal** (`artifacts/client-portal`): CSS variables in `src/index.css` — `--primary: 170 74% 38%`, `--background: 220 48% 5%`, `--card: 220 45% 9%`; hardcoded constants in page/component files use `ACCENT = "#1aab90"` and `ACCENT_DARK = "#128a74"`
- **Mobile** (`artifacts/mobile`): `constants/colors.ts` → `dark` block, consumed everywhere via `useColors()`
- **API server emails** (`src/lib/email.ts`): header background `#1aab90`, CTA buttons/links `#1aab90`; all old orange `#f97316` and `#1a1a2e` headers replaced

**Why:** Palette updated in June 2026 to match the real Let's Roll brand logo (BJJ grappling figure with teal+amber wordmark). Prior theme was orange `#f97316` + deep navy.

**How to apply:** For new client-portal pages use inline styles with `ACCENT`/`ACCENT_DARK` constants or Tailwind `text-primary`/`bg-primary`. For new mobile screens call `useColors()` — the primary token is already correct.

**Stripe Elements:** Always use `colorPrimary: '#1aab90'` in the Elements `appearance` object.

**Box shadows:** Use `rgba(26,171,144,0.N)` for teal glow shadows (was `rgba(249,115,22,0.N)` in old orange theme).
