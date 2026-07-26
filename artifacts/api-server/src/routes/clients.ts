import { Router, type Request, type Response } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { clientsTable, sessionsTable, instructorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { signClientToken } from "../lib/clientToken";
import { requireClient } from "../lib/auth";
import { clientLimiter } from "../lib/rateLimiters";
import { sendPasswordResetEmail, sendEmailVerificationEmail } from "../lib/email";
import rateLimit from "express-rate-limit";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  message: { error: "Too many login attempts. Please try again later." },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  message: { error: "Too many registrations. Please try again later." },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  message: { error: "Too many requests. Please try again later." },
});

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_PARAMS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, KEY_LEN);
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const storedBuf = Buffer.from(hash, "hex");
  const derived = await scryptAsync(password, salt, KEY_LEN);
  return timingSafeEqual(storedBuf, derived);
}

function getPortalBaseUrl(): string {
  if (process.env.PUBLIC_PORTAL_URL) {
    return process.env.PUBLIC_PORTAL_URL.replace(/\/$/, "");
  }
  // In production REPLIT_DEV_DOMAIN is unset — fall back to the live domain
  // In development REPLIT_DEV_DOMAIN is the Janeway preview tunnel
  const domain = process.env.REPLIT_DEPLOYMENT
    ? "bjj-session-planner.replit.app"
    : (process.env.REPLIT_DEV_DOMAIN ?? "bjj-session-planner.replit.app");
  return `https://${domain}/book`;
}


router.post("/register", registerLimiter, async (req, res) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  const emailLower = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(emailLower) || emailLower.length > 254) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]).+$/;
  if (!complexityRegex.test(password)) {
    res.status(400).json({ error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character" });
    return;
  }

  try {
    const existing = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.email, emailLower))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = randomBytes(32).toString("hex");
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [client] = await db
      .insert(clientsTable)
      .values({
        name: name.trim(),
        email: emailLower,
        passwordHash,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiresAt: verificationTokenExpiresAt,
      })
      .returning({
        id: clientsTable.id,
        name: clientsTable.name,
        email: clientsTable.email,
      });

    const verifyUrl = `${getPortalBaseUrl()}/verify-email?token=${verificationToken}`;
    void sendEmailVerificationEmail({ to: emailLower, name: name.trim(), verifyUrl });

    const token = signClientToken(client.id);
    res.status(201).json({ token, client, emailVerified: false });
  } catch {
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/verify-email", async (req, res) => {
  const { token } = req.body as { token?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Verification token is required" });
    return;
  }

  try {
    const [client] = await db
      .select({
        id: clientsTable.id,
        emailVerified: clientsTable.emailVerified,
        emailVerificationTokenExpiresAt: clientsTable.emailVerificationTokenExpiresAt,
      })
      .from(clientsTable)
      .where(eq(clientsTable.emailVerificationToken, token))
      .limit(1);

    if (
      !client ||
      !client.emailVerificationTokenExpiresAt ||
      client.emailVerificationTokenExpiresAt < new Date()
    ) {
      res.status(400).json({ error: "This verification link is invalid or has expired." });
      return;
    }

    if (client.emailVerified) {
      res.json({ message: "Email already verified." });
      return;
    }

    await db
      .update(clientsTable)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      })
      .where(eq(clientsTable.id, client.id));

    res.json({ message: "Email verified successfully." });
  } catch {
    res.status(500).json({ error: "Failed to verify email" });
  }
});

router.post("/resend-verification", loginLimiter, async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const emailLower = email.toLowerCase().trim();
  try {
    const [client] = await db
      .select({ id: clientsTable.id, name: clientsTable.name, email: clientsTable.email, emailVerified: clientsTable.emailVerified })
      .from(clientsTable)
      .where(eq(clientsTable.email, emailLower))
      .limit(1);

    if (!client) {
      res.json({ message: "If an account exists, a verification email has been sent." });
      return;
    }
    if (client.emailVerified) {
      res.json({ message: "Your email is already verified." });
      return;
    }

    const verificationToken = randomBytes(32).toString("hex");
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(clientsTable)
      .set({ emailVerificationToken: verificationToken, emailVerificationTokenExpiresAt: verificationTokenExpiresAt })
      .where(eq(clientsTable.id, client.id));

    const verifyUrl = `${getPortalBaseUrl()}/verify-email?token=${verificationToken}`;
    void sendEmailVerificationEmail({ to: emailLower, name: client.name ?? "there", verifyUrl });

    res.json({ message: "If an account exists, a verification email has been sent." });
  } catch {
    res.status(500).json({ error: "Failed to resend verification email" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!client) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, client.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signClientToken(client.id);
    res.json({ token, client: { id: client.id, name: client.name, email: client.email }, emailVerified: client.emailVerified });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", requireClient, clientLimiter, async (req: Request, res) => {
  try {
    const [client] = await db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        email: clientsTable.email,
        createdAt: clientsTable.createdAt,
        emailVerified: clientsTable.emailVerified,
      })
      .from(clientsTable)
      .where(eq(clientsTable.id, req.clientId!))
      .limit(1);

    if (!client) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json(client);
  } catch {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

router.get("/bookings", requireClient, clientLimiter, async (req: Request, res) => {
  try {
    const [client] = await db
      .select({ email: clientsTable.email, emailVerified: clientsTable.emailVerified })
      .from(clientsTable)
      .where(eq(clientsTable.id, req.clientId!))
      .limit(1);

    if (!client) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    if (!client.emailVerified) {
      res.status(403).json({
        error: "Email verification required",
        message: "Please verify your email address before accessing your booking history.",
      });
      return;
    }

    const bookings = await db
      .select({
        id: sessionsTable.id,
        date: sessionsTable.date,
        time: sessionsTable.time,
        status: sessionsTable.status,
        serviceName: sessionsTable.serviceName,
        servicePrice: sessionsTable.servicePrice,
        packageCount: sessionsTable.packageCount,
        packageTotal: sessionsTable.packageTotal,
        paymentStatus: sessionsTable.paymentStatus,
        cancellationToken: sessionsTable.cancellationToken,
        instructorName: instructorsTable.name,
        instructorSlug: instructorsTable.slug,
        createdAt: sessionsTable.createdAt,
      })
      .from(sessionsTable)
      .leftJoin(instructorsTable, eq(sessionsTable.instructorId, instructorsTable.id))
      .where(eq(sessionsTable.clientEmail, client.email))
      .orderBy(desc(sessionsTable.date));

    res.json({ bookings });
  } catch {
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 254) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  try {
    const [client] = await db
      .select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable)
      .where(eq(clientsTable.email, normalizedEmail))
      .limit(1);

    if (client) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.update(clientsTable)
        .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
        .where(eq(clientsTable.id, client.id));

      const resetUrl = `${getPortalBaseUrl()}/reset-password?token=${token}`;
      void sendPasswordResetEmail({ to: normalizedEmail, name: client.name, resetUrl });
    }

    res.json({ message: "If an account exists for that email, a reset link has been sent." });
  } catch {
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/reset-password", forgotPasswordLimiter, async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const [client] = await db
      .select({ id: clientsTable.id, resetTokenExpiresAt: clientsTable.resetTokenExpiresAt })
      .from(clientsTable)
      .where(eq(clientsTable.resetToken, token))
      .limit(1);

    if (!client || !client.resetTokenExpiresAt || client.resetTokenExpiresAt < new Date()) {
      res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(clientsTable)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        tokenIssuedAfter: new Date(),
      })
      .where(eq(clientsTable.id, client.id));

    res.json({ message: "Password updated successfully. Please log in again." });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
