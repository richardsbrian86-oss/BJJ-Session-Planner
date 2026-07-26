---
name: resend-email-template
description: Add a new branded HTML email to the Let's Roll API server using Resend. Use when adding any new email notification — booking reminders, account alerts, PIN change notifications, or any other transactional email. Follows the project's existing pattern in artifacts/api-server/src/lib/email.ts.
---

# Resend Email Template Pattern

All transactional emails live in `artifacts/api-server/src/lib/email.ts`. The file already has `getResend()`, `getFromAddress()`, and `escapeHtml()` helpers — always use them.

## File structure

```
artifacts/api-server/src/lib/email.ts
  getResend()          — returns Resend client or null if key not set
  getFromAddress()     — returns FROM_EMAIL env var or project default
  escapeHtml()         — sanitize user-provided strings before HTML injection
  sendXxxEmail()       — one exported function per email type
```

## Template for a new email function

```typescript
export interface MyEmailParams {
  to: string;
  name: string;         // always include — used in greeting
  // ...other params
}

export async function sendMyEmail(params: MyEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping my email");
    return;  // Silent skip in dev, not an error
  }

  const { to, name } = params;
  const safeName = escapeHtml(name);  // Always escape user strings used in HTML

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER: always dark navy + orange brand -->
          <tr>
            <td style="background:#070b14;padding:28px 32px;">
              <p style="margin:0;color:#f97316;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Let's Roll</p>
              <p style="margin:6px 0 0;color:#8b9ab3;font-size:14px;">Email Type Description</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1a202c;">Hi ${safeName},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6;">
                Your message here.
              </p>

              <!-- Optional CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#f97316;border-radius:10px;">
                    <a href="URL_HERE" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
                      Button Label
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">
                Footer note / disclaimer.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f4f4f8;padding:16px 32px;text-align:center;">
              <p style="margin:0;color:#aaa;font-size:12px;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: "Your Subject Line",
      html,
      text: `Hi ${name},\n\nPlain-text version of the message.\n\nURL_HERE`,
    });
  } catch (err) {
    console.error("[email] Failed to send my email:", err);
    // Do NOT re-throw — email failures should never crash the API request
  }
}
```

## Key rules

- **Always include `text:` fallback** alongside `html:` — some clients are text-only.
- **Never throw on send failure** — wrap in try/catch and log. Email failures must not break the booking/auth flow.
- **Use `void sendXxxEmail(...)` at the call site** if the response shouldn't wait for the email to send (fire-and-forget). Use `await` if the endpoint's response depends on the email succeeding.
- **Escape all user-provided strings** with `escapeHtml()` before interpolating into HTML. Skip it for URLs (use safe URL construction instead).
- **`getResend()` returns null** when `RESEND_API_KEY` is not set — this is expected in dev. Log a warning and return early; don't crash.

## Environment variables

| Var | Where set | Purpose |
|-----|-----------|---------|
| `RESEND_API_KEY` | Replit Secrets | Resend API key — if absent, all emails are skipped silently |
| `FROM_EMAIL` | Replit Secrets | Sender address, e.g. `notifications@yourdomain.com` |

## Design tokens (keep consistent across all emails)

| Token | Value |
|-------|-------|
| Background | `#f4f4f8` |
| Card background | `#ffffff` |
| Header background | `#070b14` |
| Brand orange | `#f97316` |
| Muted text | `#8b9ab3` |
| Body text | `#4a5568` |
| Heading text | `#1a202c` |
| CTA button | `#f97316` background, `#ffffff` text |
| Border radius (card) | `12px` |
| Border radius (button) | `10px` |
