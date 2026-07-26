import { pgTable, text, bigint, integer, serial, unique, index } from "drizzle-orm/pg-core";

export const authFailureHistoryTable = pgTable(
  "auth_failure_history",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    ip: text("ip").notNull(),
    count: integer("count").notNull(),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    windowEnd: bigint("window_end", { mode: "number" }).notNull(),
    alertedAt: bigint("alerted_at", { mode: "number" }),
  },
  (t) => [
    unique("auth_failure_history_slug_ip_window_start_key").on(t.slug, t.ip, t.windowStart),
    index("afh_window_end_idx").on(t.windowEnd),
  ],
);

export type AuthFailureHistory = typeof authFailureHistoryTable.$inferSelect;
