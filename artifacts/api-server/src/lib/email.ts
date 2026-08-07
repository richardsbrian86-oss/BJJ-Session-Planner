import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function getFromAddress(): string {
  return process.env.FROM_EMAIL ?? "Let's Roll <notifications@updates.bjjscheduler.com>";
}

function generateICS(params: {
  uid: string;
  dtstart: string;
  dtend: string;
  summary: string;
  description: string;
  organizerEmail: string;
  attendeeEmail: string;
}): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const desc = params.description.replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Let's Roll//BJJ Scheduler//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${params.dtstart}`,
    `DTEND:${params.dtend}`,
    `SUMMARY:${params.summary}`,
    `DESCRIPTION:${desc}`,
    `ORGANIZER;CN=Let's Roll:mailto:${params.organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${params.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${params.summary} in 1 hour`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function toICSDateTime(date: string, time: string): string {
  const [year, month, day] = date.split("-");
  const [hour, minute] = time.split(":");
  return `${year}${month}${day}T${hour}${minute}00`;
}

function addMinutesToICSDateTime(icsDateTime: string, minutes: number): string {
  const year = parseInt(icsDateTime.slice(0, 4), 10);
  const month = parseInt(icsDateTime.slice(4, 6), 10) - 1;
  const day = parseInt(icsDateTime.slice(6, 8), 10);
  const hour = parseInt(icsDateTime.slice(9, 11), 10);
  const minute = parseInt(icsDateTime.slice(11, 13), 10);
  const d = new Date(year, month, day, hour, minute + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CancellationEmailParams {
  to: string;
  clientName: string;
  instructorName: string;
  serviceName: string;
  date: string;
  time: string;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = minuteStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

export interface ClientCancellationConfirmationParams {
  to: string;
  clientName: string;
  instructorName: string;
  serviceName: string;
  date: string;
  time: string;
}

export async function sendClientCancellationConfirmationEmail(params: ClientCancellationConfirmationParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping client cancellation confirmation email");
    return;
  }

  const { to, clientName, instructorName, serviceName, date, time } = params;
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(time);

  const safeClientName = escapeHtml(clientName);
  const safeInstructorName = escapeHtml(instructorName);
  const safeServiceName = escapeHtml(serviceName);
  const safeFormattedDate = escapeHtml(formattedDate);
  const safeFormattedTime = escapeHtml(formattedTime);

  const subject = `Cancellation confirmed — ${formattedDate}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: #1a1a2e; padding: 24px 32px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Cancellation Confirmed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #333; font-size: 16px;">Hi ${safeClientName},</p>
              <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
                Your cancellation request has been confirmed. The following session has been cancelled:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f8; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Service</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeServiceName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedDate}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Time</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedTime}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Instructor</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeInstructorName}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; color: #555; font-size: 15px; line-height: 1.6;">
                If you'd like to rebook, please use your booking link or contact your instructor directly.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f4f4f8; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; color: #aaa; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `Hi ${clientName},\n\nYour cancellation has been confirmed. The following session has been cancelled:\n\n- Service: ${serviceName}\n- Date: ${formattedDate}\n- Time: ${formattedTime}\n- Instructor: ${instructorName}\n\nIf you'd like to rebook, please use your booking link or contact your instructor directly.\n`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] Failed to send client cancellation confirmation email:", err);
  }
}

export interface BookingConfirmationParams {
  to: string;
  clientName: string;
  instructorName: string;
  serviceName: string;
  date: string;
  time: string;
  amountPaidCents: number;
  cancellationToken?: string | null;
  cancellationBaseUrl?: string;
  durationMinutes?: number;
  paymentIntentId?: string | null;
}

export async function sendBookingConfirmationEmail(params: BookingConfirmationParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping booking confirmation email");
    return;
  }

  const { to, clientName, instructorName, serviceName, date, time, amountPaidCents, cancellationToken, cancellationBaseUrl, durationMinutes = 60, paymentIntentId } = params;
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(time);
  const amountDisplay = amountPaidCents > 0
    ? `$${(amountPaidCents / 100).toFixed(2)}`
    : "No charge";

  const cancelUrl = cancellationToken && cancellationBaseUrl
    ? `${cancellationBaseUrl}/booking/${cancellationToken}`
    : null;

  const safeClientName = escapeHtml(clientName);
  const safeInstructorName = escapeHtml(instructorName);
  const safeServiceName = escapeHtml(serviceName);
  const safeFormattedDate = escapeHtml(formattedDate);
  const safeFormattedTime = escapeHtml(formattedTime);
  const safeAmountDisplay = escapeHtml(amountDisplay);

  const subject = `Booking confirmed — ${formattedDate}`;

  const dtstart = toICSDateTime(date, time);
  const dtend = addMinutesToICSDateTime(dtstart, durationMinutes);
  const fromEmail = (process.env.FROM_EMAIL ?? "notifications@updates.bjjscheduler.com")
    .replace(/^.*<(.+)>$/, "$1");
  const icsContent = generateICS({
    uid: `${Date.now()}-${Math.random().toString(36).slice(2)}@bjjscheduler.com`,
    dtstart,
    dtend,
    summary: `BJJ Session with ${instructorName}`,
    description: `Service: ${serviceName}\nInstructor: ${instructorName}\nDate: ${formattedDate}\nTime: ${formattedTime}`,
    organizerEmail: fromEmail,
    attendeeEmail: to,
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: #1aab90; padding: 24px 32px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Booking Confirmed ✓</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #333; font-size: 16px;">Hi ${safeClientName},</p>
              <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
                Your session with <strong>${safeInstructorName}</strong> has been booked. Here are your details:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f8; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Service</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeServiceName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedDate}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Time</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedTime}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Instructor</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeInstructorName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Paid</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeAmountDisplay}</span>
                  </td>
                </tr>
              </table>
              ${paymentIntentId ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0faf8; border-radius: 6px; padding: 14px 20px; margin-bottom: 24px; border: 1px solid #c6f0e8;">
                <tr>
                  <td>
                    <span style="color: #777; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Payment Reference</span><br />
                    <span style="color: #1aab90; font-size: 13px; font-weight: 600; font-family: monospace;">${escapeHtml(paymentIntentId.slice(-16))}</span>
                    <span style="color: #888; font-size: 11px; display: block; margin-top: 2px;">Keep this for your records</span>
                  </td>
                </tr>
              </table>
              ` : ""}
              <p style="margin: 0 0 16px; color: #555; font-size: 14px; line-height: 1.6; background: #f0faf8; border-left: 3px solid #1aab90; padding: 12px 16px; border-radius: 4px;">
                📅 A calendar invite is attached — open it to add this session to Google Calendar, Outlook, or Apple Calendar.
              </p>
              ${cancelUrl
                ? `<p style="margin: 0 0 8px; color: #555; font-size: 15px; line-height: 1.6;">We look forward to seeing you! To cancel your booking, <a href="${cancelUrl}" style="color: #1aab90; font-weight: 600;">click here</a>.</p>`
                : `<p style="margin: 0 0 8px; color: #555; font-size: 15px; line-height: 1.6;">We look forward to seeing you! If you need to make any changes, please contact your instructor directly.</p>`}
            </td>
          </tr>
          <tr>
            <td style="background: #f4f4f8; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; color: #aaa; font-size: 12px;">This is an automated message from Let's Roll BJJ Scheduler.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const cancelLine = cancelUrl ? `\n\nTo cancel your booking: ${cancelUrl}` : "";
  const paymentRefLine = paymentIntentId ? `\n- Payment Ref: ${paymentIntentId.slice(-16)}` : "";
  const text = `Hi ${clientName},\n\nYour session with ${instructorName} has been booked.\n\nSession details:\n- Service: ${serviceName}\n- Date: ${formattedDate}\n- Time: ${formattedTime}\n- Instructor: ${instructorName}\n- Amount Paid: ${amountDisplay}${paymentRefLine}${cancelLine}\n\nA calendar invite (.ics) is attached — open it to add this session to your calendar.\n\nWe look forward to seeing you!\n`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
      attachments: [
        {
          filename: "session.ics",
          content: Buffer.from(icsContent).toString("base64"),
          contentType: "text/calendar; charset=utf-8; method=REQUEST",
        },
      ],
    });
  } catch (err) {
    console.error("[email] Failed to send booking confirmation email:", err);
  }
}

export interface InstructorPasswordResetParams {
  to: string;
  name: string;
  resetUrl: string;
}

export async function sendInstructorPasswordResetEmail(params: InstructorPasswordResetParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping instructor password reset email");
    return;
  }
  const { to, name, resetUrl } = params;
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; padding: 32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background: #1aab90; padding: 24px 32px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Reset your password</h1>
        </td></tr>
        <tr><td style="padding: 32px;">
          <p style="margin: 0 0 16px; color: #333; font-size: 16px;">Hi ${safeName},</p>
          <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
            We received a request to reset your instructor account password. Click the button below to set a new one. This link expires in <strong>1 hour</strong>.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
            <tr><td style="background: #1aab90; border-radius: 8px; padding: 14px 28px;">
              <a href="${safeResetUrl}" style="color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none;">Reset Password</a>
            </td></tr>
          </table>
          <p style="margin: 0 0 8px; color: #888; font-size: 13px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email — your password won't change.
          </p>
          <p style="margin: 0; color: #bbb; font-size: 12px; word-break: break-all;">Or copy this link: ${safeResetUrl}</p>
        </td></tr>
        <tr><td style="background: #f4f4f8; padding: 16px 32px; text-align: center;">
          <p style="margin: 0; color: #aaa; font-size: 12px;">This is an automated message from Let's Roll BJJ Scheduler.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},\n\nWe received a request to reset your instructor account password.\n\nClick this link to reset it (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email — your password won't change.\n`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: "Reset your Let's Roll instructor password",
      html,
      text,
    });
  } catch (err) {
    console.error("[email] Failed to send instructor password reset email:", err);
  }
}

export interface InstructorPinResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
}

export async function sendInstructorPinResetEmail(params: InstructorPinResetEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping instructor PIN reset email");
    return;
  }

  const { to, name, resetUrl } = params;
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#070b14;padding:28px 32px;">
            <p style="margin:0;color:#f97316;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Let's Roll</p>
            <p style="margin:6px 0 0;color:#8b9ab3;font-size:14px;">PIN Reset Request</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1a202c;">Hi ${safeName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6;">
              We received a request to reset the PIN for your Let's Roll instructor account. Click the button below to choose a new 6-digit PIN. This link expires in <strong>1 hour</strong>.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
              <tr>
                <td style="background:#f97316;border-radius:10px;">
                  <a href="${safeResetUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
                    Reset My PIN
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#718096;line-height:1.6;">
              If you didn't request this, you can safely ignore this email — your PIN won't change.
            </p>
            <p style="margin:0;font-size:12px;color:#a0aec0;word-break:break-all;">
              Or copy this link: ${safeResetUrl}
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f4f4f8;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:12px;">This is an automated message. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},\n\nWe received a request to reset your Let's Roll instructor PIN.\n\nReset your PIN here: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: "Reset your Let's Roll instructor PIN",
      html,
      text,
    });
  } catch (err) {
    console.error("[email] Failed to send instructor PIN reset email:", err);
  }
}

export interface SuspiciousLoginAlertParams {
  ip: string;
  slug: string;
  failureCount: number;
  windowMs: number;
}

export async function sendSuspiciousLoginAlert(params: SuspiciousLoginAlertParams): Promise<void> {
  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) {
    return;
  }

  const resend = getResend();
  if (!resend) {
    return;
  }

  const { ip, slug, failureCount, windowMs } = params;
  const windowMinutes = Math.round(windowMs / 60_000);
  const safeIp = escapeHtml(ip);
  const safeSlug = escapeHtml(slug);
  const timestamp = new Date().toUTCString();

  const subject = `[Security Alert] ${failureCount} failed login attempts from ${ip}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: #7f1d1d; padding: 24px 32px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Security Alert — Suspicious Login Activity</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #333; font-size: 15px; line-height: 1.6;">
                A high number of failed login attempts has been detected. Details:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">IP Address</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600; font-family: monospace;">${safeIp}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Slug Targeted</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600; font-family: monospace;">${safeSlug}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Failure Count</span><br />
                    <span style="color: #991b1b; font-size: 15px; font-weight: 600;">${failureCount} failures in the last ${windowMinutes} minutes</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Detected At</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${timestamp}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; color: #555; font-size: 14px; line-height: 1.6;">
                If this activity looks suspicious, consider blocking the IP or reviewing your server logs for more detail.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f4f4f8; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; color: #aaa; font-size: 12px;">This is an automated security alert from BJJ Training Scheduler.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `Security Alert — Suspicious Login Activity\n\nA high number of failed login attempts has been detected.\n\nIP Address: ${ip}\nSlug Targeted: ${slug}\nFailure Count: ${failureCount} failures in the last ${windowMinutes} minutes\nDetected At: ${timestamp}\n\nIf this looks suspicious, consider blocking the IP or reviewing your server logs.\n`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to: alertEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] Failed to send suspicious login alert email:", err);
  }
}

export interface WaiverConfirmationParams {
  to: string;
  clientName: string;
  instructorName: string;
  signedAt: Date;
}

export async function sendWaiverConfirmationEmail(params: WaiverConfirmationParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping waiver confirmation email");
    return;
  }

  const { to, clientName, instructorName, signedAt } = params;
  const formattedDate = signedAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = signedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const safeClientName = escapeHtml(clientName);
  const safeInstructorName = escapeHtml(instructorName);
  const safeFormattedDate = escapeHtml(formattedDate);
  const safeFormattedTime = escapeHtml(formattedTime);

  const subject = `Waiver signed — ${formattedDate}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: #1a1a2e; padding: 24px 32px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Liability Waiver Signed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #333; font-size: 16px;">Hi ${safeClientName},</p>
              <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
                This email confirms that you have signed the liability waiver for training with <strong>${safeInstructorName}</strong>. Please keep this receipt for your records.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f8; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Instructor</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeInstructorName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Signed On</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedDate}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Signed At</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedTime} UTC</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 12px; color: #555; font-size: 14px; font-weight: 600;">Waiver Summary</p>
              <p style="margin: 0 0 12px; color: #555; font-size: 14px; line-height: 1.7;">
                By signing, you acknowledged that participation in martial arts training involves risk of injury. You agreed to release the instructor and facility from liability for injuries sustained during training sessions.
              </p>
              <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.7;">
                This waiver remains on file and applies to all future sessions with ${safeInstructorName}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f4f4f8; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; color: #aaa; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `Hi ${clientName},\n\nThis email confirms that you have signed the liability waiver for training with ${instructorName}.\n\nWaiver Details:\n- Instructor: ${instructorName}\n- Signed On: ${formattedDate}\n- Signed At: ${formattedTime} UTC\n\nWaiver Summary:\nBy signing, you acknowledged that participation in martial arts training involves risk of injury. You agreed to release the instructor and facility from liability for injuries sustained during training sessions.\n\nThis waiver remains on file and applies to all future sessions with ${instructorName}.\n`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] Failed to send waiver confirmation email:", err);
  }
}

export interface EmailVerificationParams {
  to: string;
  name: string;
  verifyUrl: string;
}

export async function sendEmailVerificationEmail(params: EmailVerificationParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email verification email");
    return;
  }

  const { to, name, verifyUrl } = params;
  const safeName = escapeHtml(name);
  const safeVerifyUrl = escapeHtml(verifyUrl);

  const subject = "Verify your email address — Let's Roll";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: #1aab90; padding: 24px 32px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Let's Roll — Verify Your Email</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #333; font-size: 16px;">Hi ${safeName},</p>
              <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
                Thanks for creating an account. Please verify your email address to access your booking history.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${safeVerifyUrl}" style="display: inline-block; background: #1aab90; color: #ffffff; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 8px; text-decoration: none;">Verify Email Address</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; color: #777; font-size: 13px; line-height: 1.6;">
                This link expires in 24 hours. If you did not create an account, you can safely ignore this email.
              </p>
              <p style="margin: 16px 0 0; color: #aaa; font-size: 12px; word-break: break-all;">
                Or copy this link: ${safeVerifyUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f4f4f8; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; color: #aaa; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `Hi ${name},\n\nThanks for creating an account. Please verify your email address to access your booking history.\n\nVerify here: ${verifyUrl}\n\nThis link expires in 24 hours. If you did not create an account, you can safely ignore this email.\n`;

  console.log(`[email] Sending verification email to ${to} from ${getFromAddress()} via ${verifyUrl}`);
  try {
    const result = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    });
    console.log("[email] Verification email sent:", JSON.stringify(result));
  } catch (err) {
    console.error("[email] Failed to send email verification email:", err);
  }
}

export async function sendCancellationEmail(params: CancellationEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping cancellation email");
    return;
  }

  const { to, clientName, instructorName, serviceName, date, time } = params;
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(time);

  const safeClientName = escapeHtml(clientName);
  const safeInstructorName = escapeHtml(instructorName);
  const safeServiceName = escapeHtml(serviceName);
  const safeFormattedDate = escapeHtml(formattedDate);
  const safeFormattedTime = escapeHtml(formattedTime);

  const subject = `Your session has been cancelled — ${formattedDate}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: #1a1a2e; padding: 24px 32px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Session Cancelled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #333; font-size: 16px;">Hi ${safeClientName},</p>
              <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
                We wanted to let you know that your upcoming session with <strong>${safeInstructorName}</strong> has been cancelled.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f8; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Service</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeServiceName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedDate}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Time</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedTime}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Instructor</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeInstructorName}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; color: #555; font-size: 15px; line-height: 1.6;">
                If you have any questions, please reach out to your instructor directly.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f4f4f8; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; color: #aaa; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `Hi ${clientName},\n\nYour session with ${instructorName} has been cancelled.\n\nSession details:\n- Service: ${serviceName}\n- Date: ${formattedDate}\n- Time: ${formattedTime}\n- Instructor: ${instructorName}\n\nIf you have any questions, please reach out to your instructor directly.\n`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] Failed to send cancellation email:", err);
  }
}

export interface PasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping password reset email");
    return;
  }

  const { to, name, resetUrl } = params;
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#070b14;padding:28px 32px;">
              <p style="margin:0;color:#f97316;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Let's Roll</p>
              <p style="margin:6px 0 0;color:#8b9ab3;font-size:14px;">Password Reset Request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1a202c;">Hi ${safeName},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6;">
                We received a request to reset your Let's Roll account password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#f97316;border-radius:10px;">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#718096;">Or copy and paste this link:</p>
              <p style="margin:0 0 24px;font-size:12px;color:#f97316;word-break:break-all;">${safeUrl}</p>
              <p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email — your password won't change.
              </p>
            </td>
          </tr>
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
      subject: "Reset your Let's Roll password",
      html,
      text: `Hi ${name},\n\nWe received a request to reset your Let's Roll account password.\n\nReset your password here: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
    });
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err);
  }
}

export interface InstructorNewBookingParams {
  to: string;
  instructorName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  serviceName: string;
  date: string;
  time: string;
  amountCents: number;
}

export async function sendInstructorNewBookingEmail(params: InstructorNewBookingParams): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping instructor booking notification");
    return;
  }

  const { to, instructorName, clientName, clientEmail, clientPhone, serviceName, date, time, amountCents } = params;
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(time);
  const amountDisplay = amountCents > 0 ? `$${(amountCents / 100).toFixed(2)}` : "Free";

  const safeInstructorName = escapeHtml(instructorName);
  const safeClientName = escapeHtml(clientName);
  const safeClientEmail = clientEmail ? escapeHtml(clientEmail) : null;
  const safeClientPhone = clientPhone ? escapeHtml(clientPhone) : null;
  const safeServiceName = escapeHtml(serviceName);
  const safeFormattedDate = escapeHtml(formattedDate);
  const safeFormattedTime = escapeHtml(formattedTime);
  const safeAmountDisplay = escapeHtml(amountDisplay);

  const subject = `New booking — ${clientName} on ${formattedDate}`;

  const clientContactRows = [
    safeClientEmail ? `<tr><td style="padding: 6px 0;"><span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Client Email</span><br /><span style="color: #222; font-size: 15px; font-weight: 600;">${safeClientEmail}</span></td></tr>` : "",
    safeClientPhone ? `<tr><td style="padding: 6px 0;"><span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Client Phone</span><br /><span style="color: #222; font-size: 15px; font-weight: 600;">${safeClientPhone}</span></td></tr>` : "",
  ].join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9f9f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: #070b14; padding: 24px 32px;">
              <p style="margin: 0; color: #f97316; font-size: 20px; font-weight: 700;">New Booking</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #333; font-size: 16px;">Hi ${safeInstructorName},</p>
              <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
                You have a new training session booked. Here are the details:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f8; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Client</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeClientName}</span>
                  </td>
                </tr>
                ${clientContactRows}
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Service</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeServiceName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedDate}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Time</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeFormattedTime}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #777; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Amount</span><br />
                    <span style="color: #222; font-size: 15px; font-weight: 600;">${safeAmountDisplay}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #555; font-size: 15px; line-height: 1.6;">
                Log in to the Let's Roll app to view and manage all your sessions.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #f4f4f8; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; color: #aaa; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const contactLines = [
    clientEmail ? `- Client Email: ${clientEmail}` : "",
    clientPhone ? `- Client Phone: ${clientPhone}` : "",
  ].filter(Boolean).join("\n");

  const text = `Hi ${instructorName},\n\nYou have a new training session booked.\n\n- Client: ${clientName}\n${contactLines ? contactLines + "\n" : ""}- Service: ${serviceName}\n- Date: ${formattedDate}\n- Time: ${formattedTime}\n- Amount: ${amountDisplay}\n\nLog in to the Let's Roll app to view and manage your sessions.\n`;

  try {
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] Failed to send instructor new booking notification:", err);
  }
}
