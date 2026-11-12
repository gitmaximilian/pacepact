import "server-only";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addWeeks, aggregateWeeks, milestonesFrom, weekKey } from "./weeks";

/** Bump when the weekly formulas change: affected users are rebuilt on their next group view. */
export const STATS_VERSION = 1;

const runCols = {
  startedAt: schema.runs.startedAt,
  distanceKm: schema.runs.distanceKm,
  durationSec: schema.runs.durationSec,
  effort: schema.runs.effort,
  walkBreaks: schema.runs.walkBreaks,
  walkKnown: schema.runs.walkKnown,
  runType: schema.runs.runType,
  source: schema.runs.source,
};

/**
 * Rebuilds the weekly totals for the given weeks of one runner and records new milestones.
 * Called after runs are stored, changed or deleted, so group pages never scan raw runs.
 */
export async function refreshWeeks(userId: string, weeks: Iterable<string>) {
  const keys = [...new Set(weeks)].sort();
  if (!keys.length) return;
  if (keys.length > 30) return rebuildStats(userId);
  const db = await getDb();
  const from = new Date(`${keys[0]}T00:00:00Z`);
  const to = new Date(`${addWeeks(keys[keys.length - 1], 1)}T00:00:00Z`);
  const runs = await db
    .select(runCols)
    .from(schema.runs)
    .where(and(eq(schema.runs.userId, userId), gte(schema.runs.startedAt, from), lt(schema.runs.startedAt, to)));
  const agg = aggregateWeeks(runs);
  const rows = keys.flatMap((week) => {
    const a = agg.get(week);
    if (!a) return [];
    return [
      { userId, week, variant: "all" as const, ...a.all },
      { userId, week, variant: "device" as const, ...a.device },
    ];
  });
  await db.delete(schema.runWeeks).where(and(eq(schema.runWeeks.userId, userId), inArray(schema.runWeeks.week, keys)));
  await insertStats(userId, rows, milestonesFrom(runs));
}

type WeekRow = typeof schema.runWeeks.$inferInsert;

// D1 allows 100 bound parameters per statement: insert in small batches.
async function insertStats(userId: string, rows: WeekRow[], ms: ReturnType<typeof milestonesFrom>) {
  const db = await getDb();
  for (let i = 0; i < rows.length; i += 6) await db.insert(schema.runWeeks).values(rows.slice(i, i + 6));
  for (let i = 0; i < ms.length; i += 20) {
    await db.insert(schema.milestones).values(ms.slice(i, i + 20).map((m) => ({ userId, ...m }))).onConflictDoNothing();
  }
}

/** Full rebuild for one runner (first use, or after a formula change). */
export async function rebuildStats(userId: string) {
  const db = await getDb();
  const runs = await db.select(runCols).from(schema.runs).where(eq(schema.runs.userId, userId));
  await db.delete(schema.runWeeks).where(eq(schema.runWeeks.userId, userId));
  const agg = aggregateWeeks(runs);
  const rows = [...agg].flatMap(([week, a]) => [
    { userId, week, variant: "all" as const, ...a.all },
    { userId, week, variant: "device" as const, ...a.device },
  ]);
  await insertStats(userId, rows, milestonesFrom(runs));
  await db.update(schema.users).set({ statsVersion: STATS_VERSION }).where(eq(schema.users.id, userId));
}

export async function ensureStats(users: { id: string; statsVersion: number }[]) {
  for (const u of users) if (u.statsVersion < STATS_VERSION) await rebuildStats(u.id);
}

export function weeksOf(dates: Date[]): string[] {
  return [...new Set(dates.map(weekKey))];
}
