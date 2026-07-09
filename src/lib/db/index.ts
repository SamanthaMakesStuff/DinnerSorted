/**
 * Lazy database client. Nothing connects at build time, and the whole app
 * still works (guest mode) when DATABASE_URL isn't configured.
 *
 * postgres-js options are chosen for serverless + external poolers:
 *  - max: 1        one connection per function instance
 *  - prepare: false required for PgBouncer transaction pooling (Supabase)
 */
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let cached: PostgresJsDatabase<typeof schema> | null = null;

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — accounts and server-side persistence are disabled."
    );
  }
  if (!cached) {
    const client = postgres(url, { max: 1, prepare: false });
    cached = drizzle(client, { schema });
  }
  return cached;
}
