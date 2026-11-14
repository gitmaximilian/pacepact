/**
 * Data for the crew statistics charts. Pure functions over precomputed weekly totals.
 *
 * Fairness: wherever runners are compared with each other, minutes count only up to the plan
 * plus 10 % (see `countedWeek`). Pace and longest run are only ever shown as one runner's own
 * trend, never side by side. Nothing before the crew started is shown, except the four weeks
 * the crew home already shows.
 */
import { countedWeek, type MemberData } from "./scoring";
import { addWeeks, weekRange, type WeekAgg } from "./weeks";
import type { StatPeriod } from "./overview";

/**
 * Weeks the charts cover: the period, but at least eight weeks (never earlier than the crew home
 * shows). Year and all time start with the crew's first run, so they do not open with empty months.
 */
export function chartWeeks(period: StatPeriod, currentWeek: string, crewStart: string, firstRun?: string): string[] {
  const visible = [crewStart, addWeeks(currentWeek, -3)].sort()[0];
  let from: string;
  if (period === "week" || period === "month") from = [addWeeks(currentWeek, -7), visible].sort()[1];
  else if (period === "year") from = [addWeeks(currentWeek, -51), crewStart].sort()[1];
  else from = crewStart;
  if ((period === "year" || period === "all") && firstRun && firstRun > from) from = firstRun;
  if (from > currentWeek) from = currentWeek;
  return weekRange(from, currentWeek);
}

export interface Bucket {
  /** First week (Monday) of the bucket: used for the label. */
  start: string;
  weeks: string[];
  kind: "week" | "month";
}

/** One point per week; past `maxPoints` weeks, one point per calendar month instead. */
export function buckets(weeks: string[], maxPoints = 26): Bucket[] {
  if (weeks.length <= maxPoints) return weeks.map((w) => ({ start: w, weeks: [w], kind: "week" }));
  const out: Bucket[] = [];
  for (const w of weeks) {
    const m = w.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.start.slice(0, 7) === m) last.weeks.push(w);
    else out.push({ start: w, weeks: [w], kind: "month" });
  }
  return out;
}

// Each runner-week is judged once per request, however many charts ask.
const judgedCache = new WeakMap<MemberData, Map<string, ReturnType<typeof countedWeek>>>();
function counted(m: MemberData, w: string) {
  let c = judgedCache.get(m);
  if (!c) judgedCache.set(m, (c = new Map()));
  let v = c.get(w);
  if (!v) c.set(w, (v = countedWeek(m, w, m.weeks.get(w))));
  return v;
}

const firstRun = (m: MemberData) => [...m.weeks.keys()].filter((w) => (m.weeks.get(w)?.runs ?? 0) > 0).sort()[0] ?? null;
const sumOf = (m: MemberData, ws: string[], f: (a: WeekAgg) => number) => ws.reduce((a, w) => a + (m.weeks.has(w) ? f(m.weeks.get(w)!) : 0), 0);

export interface CrewPoint {
  /** Real minutes of the whole crew. */
  minutes: number;
  /** Planned minutes of everyone who had started by then. */
  plan: number;
  runs: number;
  /** Runners with at least one run. */
  active: number;
  /** Share of runner-weeks with the plan done, in %; null when no week could be judged yet. */
  done: number | null;
}

/**
 * The crew per bucket. A runner counts towards the plan from their first run on; the running
 * week is only judged once it is done, so mid-week nobody drags the share down.
 */
export function crewSeries(data: MemberData[], bs: Bucket[], currentWeek: string): CrewPoint[] {
  const starts = new Map(data.map((m) => [m.userId, firstRun(m)]));
  return bs.map((b) => {
    let minutes = 0, plan = 0, runs = 0, active = 0, judged = 0, met = 0;
    for (const m of data) {
      const first = starts.get(m.userId);
      const sec = sumOf(m, b.weeks, (a) => a.sec);
      const n = sumOf(m, b.weeks, (a) => a.runs);
      minutes += sec / 60;
      runs += n;
      if (n > 0) active += 1;
      if (!first) continue;
      for (const w of b.weeks) {
        if (w < first) continue;
        const c = counted(m, w);
        plan += c.target.capSec / 1.1 / 60;
        if (w < currentWeek || c.met) {
          judged += 1;
          if (c.met) met += 1;
        }
      }
    }
    return { minutes: Math.round(minutes), plan: Math.round(plan), runs, active, done: judged ? Math.round((met / judged) * 100) : null };
  });
}

export interface PersonSeries {
  userId: string;
  /** Minutes per bucket, capped at plan + 10 % per week (null before the runner's first run). */
  minutes: (number | null)[];
  /** Running total of the capped minutes since the start of the window. */
  cumulative: (number | null)[];
}

/** Capped minutes per runner and bucket, for comparing runners fairly. */
export function personSeries(data: MemberData[], bs: Bucket[]): PersonSeries[] {
  return data.map((m) => {
    const first = firstRun(m);
    let total = 0;
    const minutes: (number | null)[] = [];
    const cumulative: (number | null)[] = [];
    for (const b of bs) {
      if (!first || b.weeks[b.weeks.length - 1] < first) {
        minutes.push(null);
        cumulative.push(null);
        continue;
      }
      const v = Math.round(b.weeks.reduce((a, w) => a + counted(m, w).sec, 0) / 60);
      total += v;
      minutes.push(v);
      cumulative.push(total);
    }
    return { userId: m.userId, minutes, cumulative };
  });
}

/** Trailing average over up to `n` points (gaps stay gaps): calmer lines, the same totals. */
export function smooth(values: (number | null)[], n = 3): (number | null)[] {
  return values.map((v, i) => {
    if (v == null) return null;
    const win = values.slice(Math.max(0, i - n + 1), i + 1).filter((x): x is number => x != null);
    return Math.round(win.reduce((a, x) => a + x, 0) / win.length);
  });
}

/** done: plan done · part: ran, not done yet · miss: no run · open: running week, nothing yet · pre: before the first run */
export const CELL_STATES = ["pre", "done", "part", "miss", "open"] as const;
export type CellState = (typeof CELL_STATES)[number];
export interface Cell {
  state: CellState;
  runs: number;
  /** Planned runs (weeks) or judged weeks (months). */
  of: number;
  /** For months: weeks with the plan done. */
  met: number;
}

/** Consistency grid: one cell per runner and bucket. Months show how many weeks were done. */
export function heatmap(data: MemberData[], bs: Bucket[], currentWeek: string): { userId: string; cells: Cell[] }[] {
  return data.map((m) => {
    const first = firstRun(m);
    const cells = bs.map((b): Cell => {
      const runs = sumOf(m, b.weeks, (a) => a.runs);
      const ws = first ? b.weeks.filter((w) => w >= first) : [];
      if (!ws.length) return { state: "pre", runs, of: 0, met: 0 };
      if (b.kind === "week") {
        const w = ws[0];
        const c = counted(m, w);
        const state: CellState = c.met ? "done" : runs > 0 ? "part" : w === currentWeek ? "open" : "miss";
        return { state, runs, of: c.target.runs, met: c.met ? 1 : 0 };
      }
      const judged = ws.filter((w) => w < currentWeek || counted(m, w).met);
      const met = judged.filter((w) => counted(m, w).met).length;
      const state: CellState = !judged.length ? (runs > 0 ? "part" : "open") : met === judged.length ? "done" : runs > 0 ? "part" : "miss";
      return { state, runs, of: judged.length, met };
    });
    return { userId: m.userId, cells };
  });
}

/** How much of a grid square is filled: 1 for a done week, a part for a started one; months by done weeks. */
export function cellFill(c: Cell, kind: "week" | "month"): number {
  if (c.state === "pre" || c.state === "miss" || c.state === "open") return c.state === "open" && c.runs ? 0.2 : 0;
  if (c.state === "done") return 1;
  const share = kind === "week" ? c.runs / Math.max(1, c.of) : c.met / Math.max(1, c.of);
  return Math.max(0.2, Math.min(0.67, share));
}

export interface TrendPoint {
  /** Average pace in seconds per km of runs with a distance; null without any. */
  pace: number | null;
  /** Longest single run in minutes; null without a run. */
  longest: number | null;
}

/** One runner's own trend: average pace and longest run per bucket. */
export function personTrend(m: MemberData, bs: Bucket[]): TrendPoint[] {
  return bs.map((b) => {
    let sec = 0, km = 0, longest = 0, runs = 0;
    for (const w of b.weeks) {
      const a = m.weeks.get(w);
      if (!a || !a.runs) continue;
      runs += a.runs;
      longest = Math.max(longest, a.longestSec);
      if (a.km > 0) {
        // Older rows have no distSec: then all the week's time counts (exact when every run had a distance).
        sec += a.distSec ?? a.sec;
        km += a.km;
      }
    }
    return { pace: km > 0 && sec > 0 ? Math.round(sec / km) : null, longest: runs ? Math.round(longest / 60) : null };
  });
}

/** A round axis maximum (1, 2, 2.5, 5 × 10ⁿ) at or above `v`, and its tick step. */
export function niceMax(v: number, ticks = 4): { max: number; step: number } {
  if (!(v > 0)) return { max: ticks, step: 1 };
  const raw = v / ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * p).find((s) => s >= raw)!;
  return { max: Math.ceil(v / step) * step, step };
}

/** Lower and upper pace bounds (seconds per km) rounded to 15 s, with a little air. */
export function paceRange(values: (number | null)[]): { lo: number; hi: number } | null {
  const v = values.filter((x): x is number => x != null);
  if (!v.length) return null;
  const lo = Math.floor((Math.min(...v) - 5) / 15) * 15;
  const hi = Math.ceil((Math.max(...v) + 5) / 15) * 15;
  return { lo, hi: Math.max(hi, lo + 30) };
}
