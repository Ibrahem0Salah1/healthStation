import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import * as relations from "./relations";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not defined. Copy .env.example to .env at the MONOREPO ROOT — this package reads the root .env, not its own.",
  );
}

/**
 * `prepare: false` — serverless-safe.
 *
 * postgres.js defaults to PREPARED STATEMENTS. A prepared statement is tied
 * to a specific backend connection, and every serverless Postgres (Neon,
 * Supabase, Vercel Postgres) sits behind PgBouncer in transaction mode, which
 * does not guarantee the same backend for the PREPARE and the EXECUTE. The
 * failure is a driver-level error deep inside a mutation, on your first
 * production request — and it is silent in local dev, which is exactly why it
 * is worth setting now rather than debugging later.
 */
const client = postgres(connectionString, { prepare: false });

/**
 * THE TYPED INSTANCE, built first so its type is concrete.
 *
 * The previous shape was `globalForDb.db ?? drizzle(client, {...})` with
 * `globalForDb.db: ReturnType<typeof drizzle> | undefined`. `drizzle` is
 * GENERIC, so `ReturnType<typeof drizzle>` resolves its parameters to the
 * unconstrained default — `PostgresJsDatabase<Record<string, unknown>>`. The
 * `??` then produced a UNION of "properly typed" and "unknown schema", and
 * every relational access failed to compile with
 * `Property 'products' does not exist on type '{}'`.
 *
 * Deriving the type from the actual call, then USING that type for the cache,
 * removes the union. A dev-only optimization must not be allowed to influence
 * the public type of `db`.
 */
const drizzleInstance = drizzle(client, {
  schema: { ...schema, ...relations },
});

type Database = typeof drizzleInstance;

/**
 * `globalThis` CACHING — without it, every dev hot-reload allocates a fresh
 * connection pool and abandons the old one. Postgres then refuses new
 * connections ("too many clients") within about ten minutes of normal work,
 * because the abandoned pool is only closed if the garbage collector gets to
 * it, which is often never.
 *
 * It lives on the global object rather than in a module because modules are
 * re-evaluated on every hot reload while the global survives. That is the
 * whole trick.
 */
const globalForDb = globalThis as unknown as {
  postgresClient: ReturnType<typeof postgres> | undefined;
  db: Database | undefined;
};

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client;
  globalForDb.db = drizzleInstance;
}

export const db: Database = globalForDb.db ?? drizzleInstance;

/**
 * Exported so scripts (the seed) can close the pool deliberately instead of
 * relying on `process.exit`. Never import this into a request path — a
 * long-lived pooled connection is a dev-server concern, not a per-request
 * one.
 */
export const postgresClient = globalForDb.postgresClient ?? client;
