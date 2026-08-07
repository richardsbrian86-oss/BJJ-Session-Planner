import { createHmac, timingSafeEqual } from "crypto";

const HEX_RE = /^[0-9a-f]+$/;

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_SECRET environment variable must be set in production");
    }
    return "dev-only-insecure-secret-change-in-prod";
  }
  return secret;
}

function sign(instructorId: number): string {
  const issuedAt = Date.now();
  const payload = `${instructorId}.${issuedAt}`;
  const mac = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

function verify(token: string): number | null {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return null;

  const payload = token.slice(0, dotIdx);
  const provided = token.slice(dotIdx + 1);

  const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");

  if (provided.length !== expected.length) return null;
  if (!HEX_RE.test(provided)) return null;

  try {
    const providedBuf = Buffer.from(provided, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (!timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }
  } catch {
    return null;
  }

  const parts = payload.split(".");
  if (parts.length !== 2) return null;

  const id = parseInt(parts[0], 10);
  if (isNaN(id)) return null;

  const issuedAt = parseInt(parts[1], 10);
  if (isNaN(issuedAt)) return null;

  if (Date.now() - issuedAt > TOKEN_MAX_AGE_MS) return null;

  return id;
}

export { sign, verify };
