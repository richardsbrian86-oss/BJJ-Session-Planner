import { pgTable, text, bigint, integer, primaryKey, index } from "drizzle-orm/pg-core";

export const authFailuresTable = pgTable(
  "auth_failures",
  {
    slug: text("slug").notNull(),
    ip: text("ip").notNull(),
    count: integer("count").notNull().default(1),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    alertedAt: bigint("alerted_at", { mode: "number" }),
  },
  (t) => [
    primaryKey({ columns: [t.slug, t.ip] }),
    index("af_window_start_idx").on(t.windowStart),
  ],
);

export type AuthFailure = typeof authFailuresTable.$inferSelect;
