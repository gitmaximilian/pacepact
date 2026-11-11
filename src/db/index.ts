import path from "node:path";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

declare global {
  // eslint-disable-next-line no-var
  var __pacepactDb: Promise<Db> | undefined;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  if (url && !url.startsWith("pglite:")) {
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { max: 10 });
    const db = drizzlePostgres(client, { schema });
    if (process.env.AUTO_MIGRATE !== "false") await migratePostgres(db, { migrationsFolder });
    return db;
  }
  // Embedded Postgres (WASM) for local development and tests.
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = url?.startsWith("pglite:")
    ? url.slice("pglite:".length) || undefined
    : path.join(process.cwd(), ".data", "pglite");
  const client = dataDir === "memory" ? new PGlite() : new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return db as unknown as Db;
}

/** Lazily connected, migrated database shared across the server process. */
export function getDb(): Promise<Db> {
  globalThis.__pacepactDb ??= connect();
  return globalThis.__pacepactDb;
}

export { schema };
