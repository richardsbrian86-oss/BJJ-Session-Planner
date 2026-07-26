import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { instructorsTable } from "./instructors";

export const availabilityTable = pgTable(
  "availability",
  {
    id: serial("id").primaryKey(),
    instructorId: integer("instructor_id")
      .notNull()
      .references(() => instructorsTable.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    startTime: text("start_time").notNull().default("09:00"),
    endTime: text("end_time").notNull().default("17:00"),
    sessionDurationMinutes: integer("session_duration_minutes")
      .notNull()
      .default(60),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("availability_instructor_id_idx").on(t.instructorId),
  ],
);

export type InsertAvailability = typeof availabilityTable.$inferInsert;
export type Availability = typeof availabilityTable.$inferSelect;
