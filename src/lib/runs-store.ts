import "server-only";
import { getDb, schema } from "@/db";
import { sanitize, type NormalizedRun } from "./import/types";

/** Inserts runs, skipping duplicates by (user, source, externalId). */
export async function storeRuns(userId: string, source: string, runs: NormalizedRun[]) {
  const db = await getDb();
  const clean = runs.map(sanitize).filter((r): r is NormalizedRun => !!r);
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
