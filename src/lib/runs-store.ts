import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { resolveDuplicate } from "./dedupe";
import { sanitize, type NormalizedRun } from "./import/types";
import { refreshWeeks, weeksOf } from "./social/store";

/** Sources where the runner states walk breaks explicitly. Watch files, Apple Health and Strava cannot tell. */
const WALK_KNOWN_SOURCES = ["manual", "csv"];

/**
 * Inserts runs. Skips duplicates of the same source (by externalId) and merges the same run
 * arriving from another source (see src/lib/dedupe.ts).
 */
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
  if (!clean.length) return { inserted: 0, skipped: runs.length };

  const times = clean.map((r) => r.startedAt.getTime());
  const nearby = await db
    .select({
      id: schema.runs.id,
      source: schema.runs.source,
      startedAt: schema.runs.startedAt,
      durationSec: schema.runs.durationSec,
      effort: schema.runs.effort,
      notes: schema.runs.notes,
      runType: schema.runs.runType,
      walkBreaks: schema.runs.walkBreaks,
      walkKnown: schema.runs.walkKnown,
    })
    .from(schema.runs)
    .where(
      and(
        eq(schema.runs.userId, userId),
        gte(schema.runs.startedAt, new Date(Math.min(...times) - 10 * 60_000)),
        lte(schema.runs.startedAt, new Date(Math.max(...times) + 10 * 60_000)),
      ),
    );

  let inserted = 0;
  const touched: Date[] = [];
  for (const r of clean) {
    const res = resolveDuplicate({ source, startedAt: r.startedAt, durationSec: r.durationSec }, nearby);
    if (res.action === "skip") continue;
    const old = res.action === "replace" ? res.replace : null;
    const walkKnown = r.walkKnown ?? WALK_KNOWN_SOURCES.includes(source);
    const values = {
      userId,
      source,
      startedAt: r.startedAt,
      distanceKm: r.distanceKm,
      durationSec: r.durationSec,
      avgHr: r.avgHr ?? null,
      maxHr: r.maxHr ?? null,
      // Keep what the runner typed on the copy being replaced.
      effort: r.effort ?? old?.effort ?? null,
      walkBreaks: old?.walkKnown && !walkKnown ? old.walkBreaks : (r.walkBreaks ?? false),
      walkKnown: walkKnown || !!old?.walkKnown,
      runType: r.runType ?? (old?.runType as NormalizedRun["runType"]) ?? "other",
      notes: r.notes ?? old?.notes ?? null,
      externalId: r.externalId ?? null,
    };
    const [row] = await db.insert(schema.runs).values(values).onConflictDoNothing().returning({ id: schema.runs.id });
    if (!row) continue;
    inserted += 1;
    touched.push(r.startedAt);
    nearby.push({ id: row.id, source, startedAt: r.startedAt, durationSec: r.durationSec, effort: values.effort, notes: values.notes, runType: values.runType, walkBreaks: values.walkBreaks, walkKnown: values.walkKnown });
    if (old) {
      // Kudos and comments follow the run to its new copy.
      await db.update(schema.comments).set({ targetId: row.id }).where(eq(schema.comments.targetId, old.id));
      await db.update(schema.reactions).set({ targetId: row.id }).where(eq(schema.reactions.targetId, old.id));
      await db.delete(schema.runs).where(and(eq(schema.runs.id, old.id), eq(schema.runs.userId, userId)));
      nearby.splice(nearby.findIndex((n) => n.id === old.id), 1);
      touched.push(old.startedAt);
    }
  }
  if (touched.length) await refreshWeeks(userId, weeksOf(touched));
  return { inserted, skipped: runs.length - inserted };
}
