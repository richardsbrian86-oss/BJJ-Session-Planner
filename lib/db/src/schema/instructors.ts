import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const instructorsTable = pgTable("instructors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  bio: text("bio"),
  location: text("location"),
  phone: text("phone"),
  website: text("website"),
  photoUrl: text("photo_url"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeAccountId: text("stripe_account_id"),
  stripeAccountEnabled: boolean("stripe_account_enabled").notNull().default(false),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type InsertInstructor = typeof instructorsTable.$inferInsert;
export type Instructor = typeof instructorsTable.$inferSelect;
