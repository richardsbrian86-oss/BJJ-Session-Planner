---
name: vite-build-env-validation
description: Fix Vite configs that throw on missing PORT/BASE_PATH during vite build. Detect isBuild via process.argv and skip dev-server-only validation so production builds succeed without those env vars being set.
---

# Vite Build-Time Env Var Validation

## Problem

Vite config files (`vite.config.ts`) often validate required env vars at the top level and throw if they're missing:

```typescript
const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const basePath = process.env.BASE_PATH;
if (!basePath) {
  throw new Error("BASE_PATH environment variable is required but was not provided.");
}
```

This works fine for the **dev server** (`vite dev`) where `PORT` and `BASE_PATH` are injected by the workflow. But it **breaks `vite build`** in CI or deployment contexts where those env vars aren't set — the config throws before Vite even starts bundling.

Error seen in production builds:
```
failed to load config from /path/to/vite.config.ts
error during build:
Error: PORT environment variable is required but was not provided.
```

## Fix

Detect whether the current command is a build and skip runtime-server validation:

```typescript
const isBuild = process.argv.includes("build");

const rawPort = process.env.PORT;
if (!isBuild && !rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort || "3000");
if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";
if (!isBuild && !process.env.BASE_PATH) {
  throw new Error("BASE_PATH environment variable is required but was not provided.");
}

export default defineConfig({
  base: basePath,
  server: {
    port,          // only used during `vite dev` / `vite preview`
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  // ...
});
```

**Why `process.argv.includes("build")`:** When pnpm runs `vite build --config vite.config.ts`, the Node process argv contains `"build"`. This is reliable across pnpm, npm, and direct invocation.

## When to apply

Any Vite config that:
- Throws on missing `PORT`, `BASE_PATH`, or similar dev-server-only env vars
- Needs to support both `vite dev` (where the vars are injected by the workflow) and `vite build` (run in deployment or CI without those vars)

## Build invocation in this project

```bash
# Works after the fix — no PORT or BASE_PATH needed
cd artifacts/client-portal && node_modules/.bin/vite build --config vite.config.ts

# Or via pnpm (also works):
NODE_ENV=production pnpm --filter @workspace/client-portal run build
```

Note: `pnpm run build` can silently time out if the process exits with a signal (`-1`). Use the direct `node_modules/.bin/vite build` invocation with a 120-second timeout if pnpm times out.
