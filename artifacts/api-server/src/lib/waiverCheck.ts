import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireWaiverSigned(emailField: string = "clientEmail"): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const email: string | undefined =
      req.body?.[emailField] ?? (req.query?.[emailField] as string | undefined);

    if (!email) {
      next();
      return;
    }

    const [client] = await db
      .select({
        isExternalStudent: clientsTable.isExternalStudent,
        waiverSigned: clientsTable.waiverSigned,
      })
      .from(clientsTable)
      .where(eq(clientsTable.email, email))
      .limit(1);

    if (!client) {
      next();
      return;
    }

    if (client.isExternalStudent && !client.waiverSigned) {
      res.status(403).json({
        error: "Waiver required before booking. Please sign the liability waiver first.",
        code: "WAIVER_UNSIGNED",
      });
      return;
    }

    next();
  };
}
