import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

const cache = new WeakMap<object, Db>();

/**
 * Drizzle client for the D1 binding `DB`. In `next dev` the binding comes from
 * Wrangler's local D1 (see next.config.ts); in production from the Worker.
 * Migrations are applied with `wrangler d1 migrations apply`.
 */
export async function getDb(): Promise<Db> {
  const { env } = await getCloudflareContext({ async: true });
  const binding = (env as { DB?: D1Database }).DB;
  if (!binding) throw new Error("D1 binding DB is missing. Check wrangler.jsonc.");
  let db = cache.get(binding);
  if (!db) {
    db = drizzle(binding, { schema });
    cache.set(binding, db);
  }
  return db;
}

export { schema };
