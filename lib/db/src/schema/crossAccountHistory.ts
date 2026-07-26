import { pgTable, text, bigint, integer, serial, index, unique } from "drizzle-orm/pg-core";

export const crossAccountHistoryTable = pgTable(
  "cross_account_history",
  {
    id: serial("id").primaryKey(),
    ip: text("ip").notNull(),
    firstSeen: bigint("first_seen", { mode: "number" }).notNull(),
    lastSeen: bigint("last_seen", { mode: "number" }).notNull(),
    totalFailures: integer("total_failures").notNull(),
    affectedSlugs: integer("affected_slugs").notNull().default(1),
    archivedAt: bigint("archived_at", { mode: "number" }).notNull(),
  },
  (t) => [
    unique("cah_ip_first_seen_key").on(t.ip, t.firstSeen),
    index("cah_archived_at_idx").on(t.archivedAt),
    index("cah_last_seen_idx").on(t.lastSeen),
  ],
);

export type CrossAccountHistory = typeof crossAccountHistoryTable.$inferSelect;
