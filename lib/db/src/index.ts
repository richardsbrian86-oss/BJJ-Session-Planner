import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  max: 10,
});

// Prevent idle-client errors (e.g. server-side connection resets during DB
// maintenance) from crashing the process. pg-pool emits 'error' on the pool
// when an idle client encounters an error; without a listener, Node.js treats
// this as an uncaught exception and exits.
pool.on("error", (err) => {
  console.error("[pg-pool] idle client error — connection will be replaced automatically:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
