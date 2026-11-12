/**
 * Fair group rankings. Pure functions over precomputed weekly totals.
 *
 * Principles: everyone is measured against the plan and their own start, never against the
 * fastest runner. Volume counts in minutes (not km), and only up to the planned minutes plus
 * 10 %, so skipping rest days or overdoing the long run earns nothing. Lighter weeks and taper
 * keep the number of runs, so following them counts as "done".
 */
import { weekTarget, type WeekTarget } from "../plan";
import { EMPTY_WEEK, type WeekAgg } from "./weeks";

export interface MemberData {
  userId: string;
  runsPerWeek: number;
  raceDate: string | null;
  weeks: Map<string, WeekAgg>;
}

export const BOARDS = ["consistency", "minutes", "adherence", "endurance", "easyPace"] as const;
export type Board = (typeof BOARDS)[number];
export const PERIODS = ["week", "month", "prep"] as const;
export type Period = (typeof PERIODS)[number];

export interface Counted {
  target: WeekTarget;
  runs: number;
  sec: number;
  km: number;
  met: boolean;
}

/** What one week counts for, after applying the plan's caps. */
export function countedWeek(m: Pick<MemberData, "runsPerWeek" | "raceDate">, week: string, agg: WeekAgg | undefined): Counted {
  const a = agg ?? EMPTY_WEEK;
  const target = weekTarget(m.runsPerWeek, m.raceDate, week);
  const sec = Math.min(a.sec, target.capSec);
  const km = a.sec > 0 ? a.km * Math.min(1, target.capSec / a.sec) : 0;
  return { target, runs: Math.min(a.runs, target.runs), sec, km, met: a.runs >= target.runs };
}

/** Weeks in a row with the plan done. The current week only adds once it is done; it never breaks a streak. */
export function streak(m: MemberData, currentWeek: string, allWeeks: string[]): number {
  const past = allWeeks.filter((w) => w <= currentWeek).sort().reverse();
  let n = 0;
  for (const w of past) {
    const done = countedWeek(m, w, m.weeks.get(w)).met;
    if (w === currentWeek) {
      if (done) n += 1;
      continue;
    }
    if (!done) break;
    n += 1;
  }
  return n;
}

const dataWeeks = (m: MemberData, upTo: string) => [...m.weeks.keys()].filter((w) => w <= upTo && (m.weeks.get(w)?.runs ?? 0) > 0).sort();

/** Best continuous minutes in the period minus the best of the member's first two weeks. */
export function enduranceGain(m: MemberData, period: string[]): number | null {
  const all = dataWeeks(m, period[period.length - 1]);
  if (all.length < 2) return null;
  const start = Math.max(...all.slice(0, 2).map((w) => m.weeks.get(w)!.continuousSec));
  const now = Math.max(0, ...period.map((w) => m.weeks.get(w)?.continuousSec ?? 0));
  return Math.round((now - start) / 60);
}

/**
 * Pace at comparable (self-reported easy) effort: first weeks vs latest weeks, in percent
 * faster. Needs at least four weeks with easy runs; returns null otherwise.
 */
export function easyPaceGain(m: MemberData, upTo: string): number | null {
  const ws = [...m.weeks.keys()].filter((w) => w <= upTo && (m.weeks.get(w)?.easyKm ?? 0) > 0).sort();
  if (ws.length < 4) return null;
  const n = Math.min(3, Math.floor(ws.length / 2));
  const pace = (keys: string[]) => {
    const sec = keys.reduce((a, w) => a + m.weeks.get(w)!.easySec, 0);
    const km = keys.reduce((a, w) => a + m.weeks.get(w)!.easyKm, 0);
    return sec / km;
  };
  const first = pace(ws.slice(0, n));
  const last = pace(ws.slice(-n));
  return Math.round(((first - last) / first) * 1000) / 10;
}

export interface BoardRow {
  userId: string;
  value: number | null;
  rank: number | null;
  /** The plan for this period is fully done (everyone who gets here "wins"). */
  done: boolean;
}

/** Ranks rows by value (higher is better). Ties share a rank; rows without a value go last. */
export function rank(rows: { userId: string; value: number | null; done?: boolean }[]): BoardRow[] {
  const sorted = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  let last: number | null = null;
  let lastRank = 0;
  return sorted.map((r, i) => {
    if (r.value == null) return { userId: r.userId, value: null, rank: null, done: !!r.done };
    const rk = r.value === last ? lastRank : i + 1;
    last = r.value;
    lastRank = rk;
    return { userId: r.userId, value: r.value, rank: rk, done: !!r.done };
  });
}

export function board(kind: Board, members: MemberData[], fullPeriod: string[], currentWeek: string, prepWeeks: string[]): BoardRow[] {
  const rows = members.map((m) => {
    // Weeks before a runner's first logged run are not "missed": newcomers start with a clean slate.
    const first = [...m.weeks.keys()].filter((w) => (m.weeks.get(w)?.runs ?? 0) > 0).sort()[0] ?? currentWeek;
    const period = fullPeriod.filter((w) => w >= first);
    const counted = period.map((w) => countedWeek(m, w, m.weeks.get(w)));
    // The running week only counts towards adherence once it is done, so mid-week nobody looks behind.
    const judged = period.map((w, i) => ({ w, c: counted[i] })).filter(({ w, c }) => w < currentWeek || c.met);
    // "On plan": every finished week in the period done (and, for the running week alone, that week done).
    const pastOk = period.every((w, i) => w >= currentWeek || counted[i].met);
    const hasPast = period.some((w) => w < currentWeek);
    const cur = period.indexOf(currentWeek);
    const allDone = pastOk && (hasPast || (cur >= 0 && counted[cur].met));
    switch (kind) {
      case "consistency":
        return { userId: m.userId, value: streak(m, currentWeek, prepWeeks), done: allDone };
      case "minutes":
        return { userId: m.userId, value: Math.round(counted.reduce((a, c) => a + c.sec, 0) / 60), done: allDone };
      case "adherence": {
        const planned = judged.reduce((a, { c }) => a + c.target.runs, 0);
        const done = judged.reduce((a, { c }) => a + c.runs, 0);
        if (planned) return { userId: m.userId, value: Math.round((done / planned) * 100), done: allDone };
        // Only the running week, not done yet: show its progress so far.
        const c = counted[period.indexOf(currentWeek)];
        return { userId: m.userId, value: c ? Math.round((c.runs / c.target.runs) * 100) : null, done: allDone };
      }
      case "endurance":
        return { userId: m.userId, value: enduranceGain(m, fullPeriod), done: false };
      case "easyPace":
        return { userId: m.userId, value: easyPaceGain(m, fullPeriod[fullPeriod.length - 1]), done: false };
    }
  });
  return rank(rows);
}
