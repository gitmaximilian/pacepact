import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sanitize, type NormalizedRun } from "./import/types";

/** Inserts runs, skipping duplicates by (user, source, externalId). */
export async function storeRuns(userId: string, source: string, runs: NormalizedRun[]) {
  const db = await getDb();
  const [user] = await db
    .select({ hrConsentAt: schema.users.hrConsentAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) return { inserted: 0, skipped: runs.length };
  // Heart rate is health data (Art. 9 GDPR): only stored with explicit consent.
  const keepHr = !!user.hrConsentAt;
  const clean = runs
    .map(sanitize)
    .filter((r): r is NormalizedRun => !!r)
    .map((r) => (keepHr ? r : { ...r, avgHr: null, maxHr: null }));
  let inserted = 0;
  for (const r of clean) {
    const res = await db
      .insert(schema.runs)
      .values({
        userId,
        source,
        startedAt: r.startedAt,
        distanceKm: r.distanceKm,
        durationSec: r.durationSec,
        avgHr: r.avgHr ?? null,
        maxHr: r.maxHr ?? null,
        effort: r.effort ?? null,
        walkBreaks: r.walkBreaks ?? false,
        runType: r.runType ?? "other",
        notes: r.notes ?? null,
        externalId: r.externalId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.runs.id });
    inserted += res.length;
  }
  return { inserted, skipped: runs.length - inserted };
}
