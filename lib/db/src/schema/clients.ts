import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";

export const clientsTable = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    isExternalStudent: boolean("is_external_student").notNull().default(false),
    waiverSigned: boolean("waiver_signed").notNull().default(false),
    waiverSignedAt: timestamp("waiver_signed_at"),
    waiverDocumentUrl: text("waiver_document_url"),
    resetToken: text("reset_token"),
    resetTokenExpiresAt: timestamp("reset_token_expires_at"),
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerificationToken: text("email_verification_token"),
    emailVerificationTokenExpiresAt: timestamp("email_verification_token_expires_at"),
    tokenIssuedAfter: timestamp("token_issued_after"),
  },
  (t) => [
    index("clients_reset_token_idx").on(t.resetToken),
    index("clients_email_verification_token_idx").on(t.emailVerificationToken),
  ],
);

export type InsertClient = typeof clientsTable.$inferInsert;
export type Client = typeof clientsTable.$inferSelect;
