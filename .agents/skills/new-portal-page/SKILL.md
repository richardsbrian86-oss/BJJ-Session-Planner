---
name: new-portal-page
description: Add a new page to the Let's Roll client booking portal (React + Vite + Wouter). Use when adding any new route — authenticated dashboard pages, standalone flows, or public pages. Covers component creation, route registration, header visibility, and auth gating.
---

# New Portal Page — Scaffolding Pattern

Base path: `/book/` (configured in Vite and Wouter via `import.meta.env.BASE_URL`). All Wouter paths are relative to this base — write `/my-page`, not `/book/my-page`.

## Files to touch

| File | Action |
|------|--------|
| `artifacts/client-portal/src/pages/<name>.tsx` | Create |
| `artifacts/client-portal/src/App.tsx` | Add import, route, and optionally header exclusion |

## 1. Create the page component

```tsx
// artifacts/client-portal/src/pages/<name>.tsx
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useClientAuth } from "@/lib/client-auth";

const ACCENT = "#f97316";
const ACCENT_DARK = "#ea580c";

export default function MyPage() {
  const { client, isLoading } = useClientAuth();
  const [, navigate] = useLocation();

  // Auth guard — redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !client) navigate("/login");
  }, [client, isLoading, navigate]);

  if (isLoading || !client) return null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--background)", color: "var(--foreground)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Page Title</h1>
        <p style={{ color: "var(--muted-foreground)", marginBottom: 32 }}>Subtitle or description</p>

        {/* page content */}
      </div>
    </div>
  );
}
```

### For a public page (no auth required)

Remove the `useClientAuth` import and the auth-guard `useEffect`. Use `const [, navigate] = useLocation()` only if you need programmatic navigation.

### For a standalone page (no header — e.g. login, reset flows)

Add the path to `NO_HEADER_PATHS` in `App.tsx` (see step 2).

## 2. Register in App.tsx

```tsx
// Add import near the top with other page imports
import MyPage from "@/pages/<name>";

// If the page should hide the site header, add to NO_HEADER_PATHS:
const NO_HEADER_PATHS = new Set(["/login", "/signup", ..., "/<route-path>"]);

// Add Route inside <Switch> — ORDER MATTERS
// Put specific paths before wildcard paths (e.g. "/:slug")
<Route path="/<route-path>" component={MyPage} />
```

### Route ordering rules in App.tsx Switch

```
/                       ← root, first
/login, /signup, etc.   ← exact static paths, early
/dashboard              ← exact static paths
/booking/:token         ← parameterized but specific prefix first
/:slug/book             ← parameterized
/:slug                  ← catch-all param, near end
<Route component={NotFound} />  ← always last
```

## CSS design tokens (use via CSS vars, not hardcoded values)

| Token | Value |
|-------|-------|
| `var(--background)` | Deep navy `#070b14` |
| `var(--foreground)` | Near-white `#eef0f4` |
| `var(--muted-foreground)` | Muted blue-grey `#8b9ab3` |
| `var(--card)` | Slightly lighter surface |
| `var(--border)` | Subtle border colour |

For accent orange, use the local constants `ACCENT = "#f97316"` and `ACCENT_DARK = "#ea580c"` — these are not in CSS vars.

## Common UI patterns

### Card / panel
```tsx
<div style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 16 }}>
```

### Input field
```tsx
<input
  style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", color: "#eef0f4", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
/>
```

### Primary button
```tsx
<button
  style={{ width: "100%", padding: "13px 0", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
  onMouseOver={e => (e.currentTarget.style.backgroundColor = ACCENT_DARK)}
  onMouseOut={e => (e.currentTarget.style.backgroundColor = ACCENT)}
>
  Button Label
</button>
```

### API calls from portal pages

The portal's Vite dev server proxies `/api/*` → the API server. Use absolute `/api/` paths — no need to prepend BASE_URL for API calls, only for internal navigation links.

```typescript
const res = await fetch("/api/clients/my-endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",  // required for session cookie
  body: JSON.stringify({ field: value }),
});
```

## Auth context reference

```typescript
import { useClientAuth } from "@/lib/client-auth";

const { client, isLoading, refetch } = useClientAuth();
// client: { id, name, email } | null
// isLoading: boolean
// refetch(): Promise<void>  — call after mutations that change client data
```
