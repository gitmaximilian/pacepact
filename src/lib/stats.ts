import { paceSecPerKm } from "./pace";

export interface RunLike {
  startedAt: Date;
  distanceKm: number;
  durationSec: number;
  avgHr: number | null;
  effort: number | null;
  walkBreaks: boolean;
  /** False for imports that cannot tell walk breaks apart. */
  walkKnown?: boolean;
  runType: string;
}

/** Monday 00:00 (UTC) of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

export function summarize(runs: RunLike[], now = new Date()) {
  const since28 = new Date(now.getTime() - 28 * 86400_000);
  const thisWeek = weekStart(now).getTime();
  const last28 = runs.filter((r) => r.startedAt >= since28);
  const week = runs.filter((r) => r.startedAt.getTime() >= thisWeek);
  const sumKm = (rs: RunLike[]) => rs.reduce((a, r) => a + r.distanceKm, 0);
  const sumSec = (rs: RunLike[]) => rs.reduce((a, r) => a + r.durationSec, 0);
  const efforts = runs.filter((r) => r.effort != null).map((r) => r.effort as number);
  const longest = runs.reduce<RunLike | null>((a, r) => (!a || r.distanceKm > a.distanceKm ? r : a), null);
  const latest = runs.reduce<RunLike | null>((a, r) => (!a || r.startedAt > a.startedAt ? r : a), null);
  // Only runs known to be without walk breaks and not logged as hard (effort 7+) count as
  // "continuous easy minutes": this is what unlocks tempo work.
  const longestContinuousSec = runs
    .filter((r) => r.walkKnown !== false && !r.walkBreaks && (r.effort == null || r.effort <= 6))
    .reduce((a, r) => Math.max(a, r.durationSec), 0);

  return {
    count: runs.length,
    totalKm: sumKm(runs),
    totalSec: sumSec(runs),
    weekKm: sumKm(week),
    weekRuns: week.length,
    last28Km: sumKm(last28),
    last28Runs: last28.length,
    avgEffort: efforts.length ? efforts.reduce((a, b) => a + b, 0) / efforts.length : null,
    longest,
    latest,
    longestContinuousSec,
    reached30MinContinuous: longestContinuousSec >= 30 * 60,
  };
}

/** Weekly km for the last `weeks` weeks, oldest first. */
export function weeklyKm(runs: RunLike[], weeks = 12, now = new Date()) {
  const start = weekStart(now);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const from = new Date(start.getTime() - (weeks - 1 - i) * 7 * 86400_000);
    return { weekStart: from, km: 0, runs: 0 };
  });
  for (const r of runs) {
    const ws = weekStart(r.startedAt).getTime();
    const b = buckets.find((x) => x.weekStart.getTime() === ws);
    if (b) {
      b.km += r.distanceKm;
      b.runs += 1;
    }
  }
  return buckets;
}

/**
 * Pace at comparable heart rate: compares the average pace of easy runs whose
 * average HR is within ±`band` bpm of `refHr`. Returns runs oldest first so
 * the UI can show whether the same effort is getting faster.
 */
export function paceAtHeartRate(runs: RunLike[], refHr: number, band = 5) {
  return runs
    .filter((r) => r.avgHr != null && Math.abs((r.avgHr as number) - refHr) <= band && r.distanceKm > 0)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .map((r) => ({ startedAt: r.startedAt, pace: paceSecPerKm(r.durationSec, r.distanceKm), avgHr: r.avgHr }));
}
