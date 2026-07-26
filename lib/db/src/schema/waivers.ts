import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { instructorsTable } from "./instructors";

export const waiversTable = pgTable(
  "waivers",
  {
    id: serial("id").primaryKey(),
    instructorId: integer("instructor_id")
      .notNull()
      .references(() => instructorsTable.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    signatureData: text("signature_data").notNull(),
    signedAt: timestamp("signed_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    isUsed: boolean("is_used").notNull().default(false),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [
    index("waivers_instructor_id_idx").on(t.instructorId),
  ],
);

export type InsertWaiver = typeof waiversTable.$inferInsert;
export type Waiver = typeof waiversTable.$inferSelect;
