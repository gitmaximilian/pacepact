/** Weekly aggregation of runs. Pure functions: used when storing runs and in tests. */
import { isPlausibleRun } from "../plausibility";
import { sourceKind } from "./sources";

export interface AggRun {
  startedAt: Date;
  distanceKm: number;
  durationSec: number;
  effort: number | null;
  walkBreaks: boolean;
  walkKnown: boolean;
  runType: string;
  source: string;
}

export interface WeekAgg {
  runs: number;
  sec: number;
  km: number;
  longestSec: number;
  longestKm: number;
  /** Longest run known to be without walk breaks. */
  continuousSec: number;
  walkRuns: number;
  /** Runs at self-reported easy effort (1–5) with a distance: basis for "pace at comparable effort". */
  easySec: number;
  easyKm: number;
  /** Longest run logged as a test. */
  testKm: number;
}

export const EMPTY_WEEK: WeekAgg = {
  runs: 0, sec: 0, km: 0, longestSec: 0, longestKm: 0, continuousSec: 0, walkRuns: 0, easySec: 0, easyKm: 0, testKm: 0,
};

const DAY = 86400_000;

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD. */
export function weekKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

export function addWeeks(week: string, n: number): string {
  return new Date(new Date(`${week}T00:00:00Z`).getTime() + n * 7 * DAY).toISOString().slice(0, 10);
}

/** Inclusive list of week keys from `from` to `to`. */
export function weekRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let w = from; w <= to && out.length < 520; w = addWeeks(w, 1)) out.push(w);
  return out;
}

/** Whether a run may appear in groups at all: implausible runs never do. */
export function groupEligible(r: Pick<AggRun, "distanceKm" | "durationSec">): boolean {
  return isPlausibleRun(r);
}

export function aggregate(runs: AggRun[]): WeekAgg {
  const a = { ...EMPTY_WEEK };
  for (const r of runs) {
    a.runs += 1;
    a.sec += r.durationSec;
    a.km += r.distanceKm;
    a.longestSec = Math.max(a.longestSec, r.durationSec);
    a.longestKm = Math.max(a.longestKm, r.distanceKm);
    if (r.walkKnown && !r.walkBreaks) a.continuousSec = Math.max(a.continuousSec, r.durationSec);
    if (r.walkBreaks) a.walkRuns += 1;
    if (r.effort != null && r.effort <= 5 && r.distanceKm > 0) {
      a.easySec += r.durationSec;
      a.easyKm += r.distanceKm;
    }
    if (r.runType === "test") a.testKm = Math.max(a.testKm, r.distanceKm);
  }
  a.km = Math.round(a.km * 1000) / 1000;
  a.easyKm = Math.round(a.easyKm * 1000) / 1000;
  return a;
}

/** Group-eligible runs per week and variant ("all", and "device" = imported from Apple Health only). */
export function aggregateWeeks(runs: AggRun[]): Map<string, { all: WeekAgg; device: WeekAgg }> {
  const byWeek = new Map<string, AggRun[]>();
  for (const r of runs) {
    if (!groupEligible(r)) continue;
    const k = weekKey(r.startedAt);
    byWeek.set(k, [...(byWeek.get(k) ?? []), r]);
  }
  const out = new Map<string, { all: WeekAgg; device: WeekAgg }>();
  for (const [k, rs] of byWeek) {
    out.set(k, { all: aggregate(rs), device: aggregate(rs.filter((r) => sourceKind(r.source) === "device")) });
  }
  return out;
}

export const CONTINUOUS_MILESTONES = [10, 20, 30, 45, 60, 90];
export const DISTANCE_MILESTONES = [5, 10, 15, 21];
export const TEST_MILESTONES = [5, 10];

/** Milestones reached by individual group-eligible runs, each with the first run that reached it. */
export function milestonesFrom(runs: AggRun[]): { kind: "continuous" | "distance" | "test"; value: number; achievedAt: Date }[] {
  const out = new Map<string, { kind: "continuous" | "distance" | "test"; value: number; achievedAt: Date }>();
  const sorted = runs.filter(groupEligible).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const add = (kind: "continuous" | "distance" | "test", value: number, at: Date) => {
    const k = `${kind}:${value}`;
    if (!out.has(k)) out.set(k, { kind, value, achievedAt: at });
  };
  for (const r of sorted) {
    if (r.walkKnown && !r.walkBreaks) for (const m of CONTINUOUS_MILESTONES) if (r.durationSec >= m * 60) add("continuous", m, r.startedAt);
    for (const m of DISTANCE_MILESTONES) if (r.distanceKm >= m) add("distance", m, r.startedAt);
    if (r.runType === "test") for (const m of TEST_MILESTONES) if (r.distanceKm >= m) add("test", m, r.startedAt);
  }
  return [...out.values()];
}
