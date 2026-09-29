import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * Load the MONOREPO ROOT .env — there is exactly one, and it is not here.
 *
 * Why not let drizzle-kit find it automatically? It auto-loads from
 * `process.cwd()`. Every script here runs via `pnpm --filter`, which sets
 * cwd to packages/database — so the automatic lookup would look for a file
 * that does not exist and silently produce `DATABASE_URL: undefined`.
 *
 * `process.cwd()` is therefore packages/database, and "../../" is the root.
 * An explicit path works no matter which directory the script is run from.
 */
config({ path: path.resolve(process.cwd(), "../../.env") });

const databaseUrl = process.env.DATABASE_URL;

if(!databaseUrl) {
    throw new Error( "DATABASE_URL is not set. Expected it in the repo root .env file. " +
      "Copy .env.example to .env and fill it in.")
}

export default defineConfig({
    dialect : "postgresql",
    schema : './src/schema.ts',
    out: './drizzle',
     dbCredentials: { url: databaseUrl },

  /** Ask before running anything destructive. Keep this on. */
  strict: true,

  /** Print the SQL it intends to run. Free insight; leave it on in dev. */
  verbose: true,
})