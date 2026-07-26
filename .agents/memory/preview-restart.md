---
name: Preview not running — restart steps
description: What to do when the dev preview is blank or workflows show NOT_STARTED after an idle period.
---

## Rule
When the user says "app is not running" or "preview is blank", all workflows have likely been stopped by Replit's idle timeout. Restart them in this order and verify with logs.

## How to apply
1. Call `refresh_all_logs` first — if workflows show `status="NOT_STARTED"` or `status="FINISHED"` with a SIGTERM at the end, idle timeout is the cause.
2. Restart in sequence (each restart blocks until ready):
   - `artifacts/api-server: API Server`
   - `artifacts/client-portal: web`
   - `artifacts/mobile: expo`
3. Call `refresh_all_logs` again and confirm:
   - API: `Server listening port: 8080`
   - Client portal: `VITE vX.X.X  ready`
   - Mobile: `Metro waiting on exp://...`
4. Do NOT restart `artifacts/mockup-sandbox: Component Preview Server` unless the user is actively using the canvas.

**Why:** Replit stops idle workflows after inactivity. This is normal and not a bug in the app.
