import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  pgEnum,
  uuid,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { instructorsTable } from "./instructors";
import { waiversTable } from "./waivers";

export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const sessionsTable = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    instructorId: integer("instructor_id")
      .notNull()
      .references(() => instructorsTable.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    date: text("date").notNull(),
    time: text("time").notNull(),
    status: sessionStatusEnum("status").notNull().default("scheduled"),
    serviceName: text("service_name").notNull(),
    servicePrice: integer("service_price").notNull().default(0),
    packageCount: integer("package_count"),
    packageTotal: integer("package_total"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    paymentIntentId: text("payment_intent_id"),
    subscriptionId: text("subscription_id"),
    calendarEventId: text("calendar_event_id"),
    cancellationToken: uuid("cancellation_token").defaultRandom().unique(),
    notes: text("notes"),
    waiverId: integer("waiver_id").references(() => waiversTable.id, { onDelete: "set null" }),
    isPlaceholder: boolean("is_placeholder").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("sessions_instructor_id_idx").on(t.instructorId),
    index("sessions_instructor_date_time_idx").on(t.instructorId, t.date, t.time),
    index("sessions_payment_intent_id_idx").on(t.paymentIntentId),
    index("sessions_subscription_id_idx").on(t.subscriptionId),
  ],
);

export type InsertSession = typeof sessionsTable.$inferInsert;
export type Session = typeof sessionsTable.$inferSelect;
