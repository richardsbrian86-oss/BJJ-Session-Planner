import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { instructorsTable } from "./instructors";

export const servicesTable = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    instructorId: integer("instructor_id")
      .notNull()
      .references(() => instructorsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    stripePriceId: text("stripe_price_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("services_instructor_id_idx").on(t.instructorId),
  ],
);

export type InsertService = typeof servicesTable.$inferInsert;
export type Service = typeof servicesTable.$inferSelect;
