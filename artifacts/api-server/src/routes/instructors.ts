import { Router } from "express";
import type { Request, Response } from "express";
import { db, instructorsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { generateSlug } from "../lib/slug";
import { sign } from "../lib/token";
import rateLimit from "express-rate-limit";
import { recordLoginFailure, recordRateLimitHit, isSlugLockedOut } from "../lib/authAudit";
import { requireInstructor } from "../lib/auth";
import { instructorLimiter } from "../lib/rateLimiters";
import { logger } from "../lib/logger";

const router = Router();

const LOGIN_WINDOW_MS = 60 * 1000;
const REGISTER_WINDOW_MS = 60 * 1000;

const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  message: { error: "Too many login attempts. Please try again later." },
  handler(req, res, next, options) {
    const ip = req.ip ?? "unknown";
    recordRateLimitHit(ip, "login");
    logger.warn({ ip, windowMs: LOGIN_WINDOW_MS, limit: 10 }, "Rate limit hit: instructor login");
    res.status(options.statusCode).json(options.message);
  },
});

const registerLimiter = rateLimit({
  windowMs: REGISTER_WINDOW_MS,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  message: { error: "Too many registration attempts. Please try again later." },
  handler(req, res, next, options) {
    const ip = req.ip ?? "unknown";
    recordRateLimitHit(ip, "register");
    logger.warn({ ip, windowMs: REGISTER_WINDOW_MS, limit: 5 }, "Rate limit hit: instructor register");
    res.status(options.statusCode).json(options.message);
  },
});

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_PARAMS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(pin, salt, KEY_LEN);
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await scryptAsync(pin, salt, KEY_LEN);
  const storedBuf = Buffer.from(hash, "hex");
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

// PIN normalization — rejects numeric JSON values (which silently drop leading
// zeros during serialization) and non-digit strings before any hashing occurs.
function normalizePin(raw: unknown): { pin: string } | { error: string } {
  if (typeof raw === "number") {
    return {
      error:
        "PIN must be sent as a JSON string, not a number, because JSON numbers drop leading zeros.",
    };
  }
  if (typeof raw !== "string" || !/^\d{4,}$/.test(raw)) {
    return { error: "PIN must be a string of at least 4 numeric digits." };
  }
  return { pin: raw };
}

// ── Public routes ──────────────────────────────────────────────────────────

router.post("/register-email", registerLimiter, async (req: Request, res: Response) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }
  const emailLower = String(email).toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(emailLower) || emailLower.length > 254) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]).+$/;
  if (!complexityRegex.test(String(password))) {
    res.status(400).json({ error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character" });
    return;
  }

  const [existing] = await db
    .select({ id: instructorsTable.id })
    .from(instructorsTable)
    .where(eq(instructorsTable.email, emailLower))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPin(String(password));

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug(String(name));
    try {
      const [instructor] = await db
        .insert(instructorsTable)
        .values({ name: String(name), slug, email: emailLower, passwordHash, pinHash: randomBytes(32).toString("hex") })
        .returning({
          id: instructorsTable.id,
          slug: instructorsTable.slug,
          name: instructorsTable.name,
          email: instructorsTable.email,
        });

      const token = sign(instructor.id);
      res.status(201).json({
        id: instructor.id,
        slug: instructor.slug,
        name: instructor.name,
        email: instructor.email,
        token,
      });
      return;
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException & { code: string }).code === "23505";
      if (!isUniqueViolation) throw err;
    }
  }

  res.status(500).json({ error: "Failed to generate a unique slug after multiple attempts" });
});

router.post("/login-email", loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const emailLower = String(email).toLowerCase().trim();

  const locked = await isSlugLockedOut(emailLower);
  if (locked) {
    res.status(429).json({ error: "Too many failed attempts for this account. Please wait a few minutes and try again, or reset your password." });
    return;
  }

  const [instructor] = await db
    .select()
    .from(instructorsTable)
    .where(eq(instructorsTable.email, emailLower))
    .limit(1);

  if (!instructor || !instructor.passwordHash) {
    recordLoginFailure(req.ip ?? "unknown", emailLower);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPin(String(password), instructor.passwordHash);
  if (!valid) {
    recordLoginFailure(req.ip ?? "unknown", emailLower);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = sign(instructor.id);
  res.json({
    id: instructor.id,
    slug: instructor.slug,
    name: instructor.name,
    email: instructor.email,
    token,
  });
});

router.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const { name, pin: rawPin } = req.body as { name?: string; pin?: unknown };
  if (!name) {
    res.status(400).json({ error: "name and pin are required" });
    return;
  }

  const pinResult = normalizePin(rawPin);
  if ("error" in pinResult) {
    res.status(400).json({ error: pinResult.error, code: "PIN_FORMAT" });
    return;
  }
  const { pin } = pinResult;

  if (pin.length < 6) {
    res.status(400).json({ error: "PIN must be at least 6 numeric digits" });
    return;
  }

  const pinHash = await hashPin(pin);

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug(String(name));
    try {
      const [instructor] = await db
        .insert(instructorsTable)
        .values({ name: String(name), slug, pinHash })
        .returning({
          id: instructorsTable.id,
          slug: instructorsTable.slug,
          name: instructorsTable.name,
        });

      const token = sign(instructor.id);
      res.status(201).json({
        id: instructor.id,
        slug: instructor.slug,
        name: instructor.name,
        token,
      });
      return;
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException & { code: string }).code === "23505";

      if (!isUniqueViolation) throw err;
    }
  }

  res.status(500).json({ error: "Failed to generate a unique slug after multiple attempts" });
});

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const { slug, pin: rawPin } = req.body as { slug?: string; pin?: unknown };
  if (!slug) {
    res.status(400).json({ error: "slug and pin are required" });
    return;
  }

  const pinResult = normalizePin(rawPin);
  if ("error" in pinResult) {
    res.status(400).json({ error: pinResult.error, code: "PIN_FORMAT" });
    return;
  }
  const { pin } = pinResult;

  const locked = await isSlugLockedOut(String(slug));
  if (locked) {
    res.status(429).json({ error: "Too many failed attempts for this account. Please wait a few minutes and try again, or reset your password." });
    return;
  }

  const [instructor] = await db
    .select()
    .from(instructorsTable)
    .where(eq(instructorsTable.slug, String(slug)))
    .limit(1);

  if (!instructor) {
    recordLoginFailure(req.ip ?? "unknown", String(slug));
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPin(pin, instructor.pinHash);
  if (!valid) {
    recordLoginFailure(req.ip ?? "unknown", String(slug));
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (pin.length < 6) {
    res.status(428).json({
      error: "Your PIN must be upgraded to at least 6 digits.",
      requiresPinUpgrade: true,
    });
    return;
  }

  const token = sign(instructor.id);
  res.json({
    id: instructor.id,
    slug: instructor.slug,
    name: instructor.name,
    token,
  });
});

router.post("/login-name", loginLimiter, async (req: Request, res: Response) => {
  const { name, pin: rawPin } = req.body as { name?: string; pin?: unknown };
  if (!name) {
    res.status(400).json({ error: "name and pin are required" });
    return;
  }

  const pinResult = normalizePin(rawPin);
  if ("error" in pinResult) {
    res.status(400).json({ error: pinResult.error, code: "PIN_FORMAT" });
    return;
  }
  const { pin } = pinResult;

  const nameKey = String(name).trim();
  const locked = await isSlugLockedOut(nameKey);
  if (locked) {
    res.status(429).json({ error: "Too many failed attempts for this account. Please wait a few minutes and try again, or reset your password." });
    return;
  }

  const candidates = await db
    .select()
    .from(instructorsTable)
    .where(ilike(instructorsTable.name, nameKey));

  const matched: typeof candidates = [];
  for (const c of candidates) {
    if (c.pinHash && (await verifyPin(pin, c.pinHash))) {
      matched.push(c);
    }
  }

  if (matched.length === 0) {
    recordLoginFailure(req.ip ?? "unknown", nameKey);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (matched.length > 1) {
    res.status(409).json({
      error: "Multiple accounts found with that name. Please use Email & Password login instead.",
    });
    return;
  }

  const instructor = matched[0];

  if (pin.length < 6) {
    res.status(428).json({
      error: "Your PIN must be upgraded to at least 6 digits.",
      requiresPinUpgrade: true,
    });
    return;
  }

  const token = sign(instructor.id);
  res.json({
    id: instructor.id,
    slug: instructor.slug,
    name: instructor.name,
    token,
  });
});

// ── Protected routes ───────────────────────────────────────────────────────

router.post("/change-pin", requireInstructor, instructorLimiter, async (req: Request, res: Response) => {
  const { currentPin, newPin } = req.body as { currentPin?: string; newPin?: string };

  if (!currentPin || !newPin) {
    res.status(400).json({ error: "currentPin and newPin are required" });
    return;
  }
  if (!/^\d{6,}$/.test(String(newPin))) {
    res.status(400).json({ error: "New PIN must be at least 6 numeric digits" });
    return;
  }

  const [instructor] = await db
    .select({ id: instructorsTable.id, pinHash: instructorsTable.pinHash })
    .from(instructorsTable)
    .where(eq(instructorsTable.id, req.instructorId!))
    .limit(1);

  if (!instructor) {
    res.status(404).json({ error: "Instructor not found" });
    return;
  }

  const valid = await verifyPin(String(currentPin), instructor.pinHash);
  if (!valid) {
    res.status(401).json({ error: "Current PIN is incorrect" });
    return;
  }

  const newPinHash = await hashPin(String(newPin));
  await db.update(instructorsTable)
    .set({ pinHash: newPinHash })
    .where(eq(instructorsTable.id, req.instructorId!));

  res.json({ message: "PIN updated successfully" });
});

// ── Password reset ─────────────────────────────────────────────────────────

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { ip: false },
  message: { error: "Too many requests. Please try again later." },
});

router.post("/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const [instructor] = await db
      .select({ id: instructorsTable.id, name: instructorsTable.name })
      .from(instructorsTable)
      .where(eq(instructorsTable.email, normalizedEmail))
      .limit(1);

    if (instructor) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.update(instructorsTable)
        .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
        .where(eq(instructorsTable.id, instructor.id));

      const scheme = "https";
      const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080";
      const resetUrl = `${scheme}://${domain}/book/instructor/reset-password?token=${token}`;
      const { sendInstructorPasswordResetEmail } = await import("../lib/email");
      void sendInstructorPasswordResetEmail({ to: normalizedEmail, name: instructor.name, resetUrl });
    }
    res.json({ message: "If an instructor account exists for that email, a reset link has been sent." });
  } catch (err) {
    logger.error({ err }, "Failed to process instructor forgot-password");
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/reset-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
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
    const [instructor] = await db
      .select({ id: instructorsTable.id, resetTokenExpiresAt: instructorsTable.resetTokenExpiresAt })
      .from(instructorsTable)
      .where(eq(instructorsTable.resetToken, token))
      .limit(1);

    if (!instructor || !instructor.resetTokenExpiresAt || instructor.resetTokenExpiresAt < new Date()) {
      res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
      return;
    }

    const passwordHash = await hashPin(newPassword);
    await db.update(instructorsTable)
      .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
      .where(eq(instructorsTable.id, instructor.id));

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    logger.error({ err }, "Failed to process instructor reset-password");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ── PIN reset ───────────────────────────────────────────────────────────────

router.post("/forgot-pin", forgotPasswordLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const [instructor] = await db
      .select({ id: instructorsTable.id, name: instructorsTable.name })
      .from(instructorsTable)
      .where(eq(instructorsTable.email, normalizedEmail))
      .limit(1);

    if (instructor) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.update(instructorsTable)
        .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
        .where(eq(instructorsTable.id, instructor.id));

      const scheme = "https";
      const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080";
      const resetUrl = `${scheme}://${domain}/book/instructor/reset-pin?token=${token}`;
      const { sendInstructorPinResetEmail } = await import("../lib/email");
      void sendInstructorPinResetEmail({ to: normalizedEmail, name: instructor.name, resetUrl });
    }
    res.json({ message: "If an instructor account with that email exists, a PIN reset link has been sent." });
  } catch (err) {
    logger.error({ err }, "Failed to process instructor forgot-pin");
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/reset-pin", forgotPasswordLimiter, async (req: Request, res: Response) => {
  const { token, newPin } = req.body as { token?: string; newPin?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Reset token is required" });
    return;
  }
  if (!newPin || typeof newPin !== "string" || !/^\d{6,}$/.test(newPin)) {
    res.status(400).json({ error: "PIN must be at least 6 digits" });
    return;
  }
  try {
    const [instructor] = await db
      .select({ id: instructorsTable.id, resetTokenExpiresAt: instructorsTable.resetTokenExpiresAt })
      .from(instructorsTable)
      .where(eq(instructorsTable.resetToken, token))
      .limit(1);

    if (!instructor || !instructor.resetTokenExpiresAt || instructor.resetTokenExpiresAt < new Date()) {
      res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
      return;
    }

    const pinHash = await hashPin(newPin);
    await db.update(instructorsTable)
      .set({ pinHash, resetToken: null, resetTokenExpiresAt: null })
      .where(eq(instructorsTable.id, instructor.id));

    res.json({ message: "PIN updated successfully" });
  } catch (err) {
    logger.error({ err }, "Failed to process instructor reset-pin");
    res.status(500).json({ error: "Failed to reset PIN" });
  }
});

// ── Demo login (dev only) ───────────────────────────────────────────────────

router.post("/demo-login", async (req: Request, res: Response) => {
  if (process.env.DEMO_MODE !== "true") {
    res.status(403).json({ error: "Demo mode is not enabled" });
    return;
  }
  try {
    const [instructor] = await db
      .select({ id: instructorsTable.id, slug: instructorsTable.slug, name: instructorsTable.name, email: instructorsTable.email })
      .from(instructorsTable)
      .limit(1);

    if (!instructor) {
      res.status(404).json({ error: "No instructor accounts found. Set one up in the mobile app first." });
      return;
    }

    const token = sign(instructor.id);
    logger.info({ instructorId: instructor.id }, "Demo login used");
    res.json({ id: instructor.id, slug: instructor.slug, name: instructor.name, email: instructor.email, token });
  } catch (err) {
    logger.error({ err }, "Demo login failed");
    res.status(500).json({ error: "Demo login failed" });
  }
});

router.get("/verify-session", requireInstructor, async (req: Request, res: Response) => {
  const [instructor] = await db
    .select({ id: instructorsTable.id, slug: instructorsTable.slug, name: instructorsTable.name })
    .from(instructorsTable)
    .where(eq(instructorsTable.id, req.instructorId!))
    .limit(1);

  if (!instructor) {
    res.status(401).json({ valid: false, code: "AUTH_UNKNOWN_USER" });
    return;
  }

  res.json({
    valid: true,
    authSource: req.authSource,
    instructor: { id: instructor.id, slug: instructor.slug, name: instructor.name },
  });
});

export default router;
