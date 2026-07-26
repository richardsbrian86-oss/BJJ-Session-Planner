import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, instructorsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verify } from "./token";
import { verifyClientToken } from "./clientToken";

declare global {
  namespace Express {
    interface Request {
      instructorId?: number;
      clientId?: number;
      authSource?: "bearer" | "x-header" | "cookie";
    }
  }
}

function pickHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export const requireInstructor: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let rawToken: string | undefined;
  let authSource: "bearer" | "x-header" | "cookie" | undefined;

  // 1. Authorization: Bearer <token>  (highest priority)
  const authHeader = pickHeader(req.headers["authorization"]);
  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      const candidate = bearerMatch[1].trim();
      if (candidate) {
        rawToken = candidate;
        authSource = "bearer";
      }
    }
  }

  // 2. x-instructor-token header  (fallback)
  if (!rawToken) {
    const xHeader = pickHeader(req.headers["x-instructor-token"]);
    if (xHeader) {
      const candidate = xHeader.trim();
      if (candidate) {
        rawToken = candidate;
        authSource = "x-header";
      }
    }
  }

  // 3. instructor_token cookie  (future-proofing — inert until login sets it)
  if (!rawToken && req.cookies) {
    const cookie = req.cookies["instructor_token"];
    if (typeof cookie === "string" && cookie.trim()) {
      rawToken = cookie.trim();
      authSource = "cookie";
    }
  }

  if (!rawToken) {
    res.status(401).json({
      error: "Missing credentials. Send 'Authorization: Bearer <token>' or 'x-instructor-token'.",
      code: "AUTH_MISSING",
    });
    return;
  }

  const instructorId = verify(rawToken);

  if (instructorId === null) {
    res.status(401).json({
      error: "Session expired or token invalid. Please log in again.",
      code: "AUTH_INVALID",
    });
    return;
  }

  const [instructor] = await db
    .select({ id: instructorsTable.id })
    .from(instructorsTable)
    .where(eq(instructorsTable.id, instructorId))
    .limit(1);

  if (!instructor) {
    res.status(401).json({
      error: "Instructor not found",
      code: "AUTH_UNKNOWN_USER",
    });
    return;
  }

  req.instructorId = instructorId;
  req.authSource = authSource;
  next();
};

export const requireClient: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"] as string | undefined;
  const token =
    (req.headers["x-client-token"] as string | undefined) ||
    (authHeader?.replace(/^Bearer\s+/i, ""));

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = verifyClientToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [client] = await db
    .select({ id: clientsTable.id, tokenIssuedAfter: clientsTable.tokenIssuedAfter })
    .from(clientsTable)
    .where(eq(clientsTable.id, payload.id))
    .limit(1);

  if (!client) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  if (client.tokenIssuedAfter) {
    if (payload.issuedAt < client.tokenIssuedAfter.getTime()) {
      res.status(401).json({ error: "Session has been invalidated. Please log in again." });
      return;
    }
  }

  req.clientId = payload.id;
  next();
};
