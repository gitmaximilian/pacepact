/**
 * The crew home in one glance: who ran this week, where do I stand, and a short
 * four-week comparison. Pure functions over precomputed weekly totals.
 */
import { board, countedWeek, type Counted, type MemberData } from "./scoring";
import { addWeeks, weekRange } from "./weeks";

export interface Lane {
  userId: string;
  c: Counted;
}

/** This week's lanes: done first, then by planned runs done, then by (capped) minutes. */
export function weekLanes(data: MemberData[], week: string): Lane[] {
  return data
    .map((d) => ({ userId: d.userId, c: countedWeek(d, week, d.weeks.get(week)) }))
    .sort((a, b) => Number(b.c.met) - Number(a.c.met) || b.c.runs - a.c.runs || b.c.sec - a.c.sec);
}

export interface WeekSummary {
  /** Runners who ran at least once this week. */
  ran: number;
  /** Runners whose week is done. */
  done: number;
  total: number;
  /** The viewer's lane (1-based place) and counts, or null if not a member. */
  me: { place: number; runs: number; target: number; minutes: number; met: boolean } | null;
}

export function weekSummary(lanes: Lane[], meId: string): WeekSummary {
  const i = lanes.findIndex((l) => l.userId === meId);
  const mine = i >= 0 ? lanes[i].c : null;
  return {
    ran: lanes.filter((l) => l.c.runs > 0).length,
    done: lanes.filter((l) => l.c.met).length,
    total: lanes.length,
    me: mine ? { place: i + 1, runs: mine.runs, target: mine.target.runs, minutes: Math.round(mine.sec / 60), met: mine.met } : null,
  };
}

export interface FourWeekRow {
  userId: string;
  /** Weeks in a row with the plan done. */
  streak: number;
  /** Training minutes over the last four weeks, capped at plan + 10 % per week. */
  minutes: number;
  rank: number;
}

/**
 * Last four weeks, side by side: streak first (consistency beats volume), then capped minutes.
 * Ties share a rank. Raw pace is never part of it.
 */
export function fourWeeks(data: MemberData[], currentWeek: string, prepWeeks: string[]): FourWeekRow[] {
  const period = weekRange(addWeeks(currentWeek, -3), currentWeek);
  const streaks = new Map(board("consistency", data, period, currentWeek, prepWeeks).map((r) => [r.userId, r.value ?? 0]));
  const minutes = new Map(board("minutes", data, period, currentWeek, prepWeeks).map((r) => [r.userId, r.value ?? 0]));
  const rows = data
    .map((d) => ({ userId: d.userId, streak: streaks.get(d.userId) ?? 0, minutes: minutes.get(d.userId) ?? 0 }))
    .sort((a, b) => b.streak - a.streak || b.minutes - a.minutes);
  return rows.map((r, i) => {
    const firstEqual = rows.findIndex((o) => o.streak === r.streak && o.minutes === r.minutes);
    return { ...r, rank: (firstEqual >= 0 ? firstEqual : i) + 1 };
  });
}

/**
 * Feed milestones, decluttered: per runner and kind only the highest value reached in the
 * window, so one long run does not post "10, 20 and 30 minutes" as three separate items.
 */
export function topMilestones<T extends { userId: string; kind: string; value: number; achievedAt: Date }>(ms: T[]): T[] {
  const best = new Map<string, T>();
  for (const m of ms) {
    const k = `${m.userId}:${m.kind}`;
    const cur = best.get(k);
    if (!cur || m.value > cur.value) best.set(k, m);
  }
  return [...best.values()];
}

export const STAT_PERIODS = ["week", "month", "year", "all"] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];
export const STAT_KEYS = ["runs", "minutes", "km", "longest", "streak", "onPlan"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** Weeks covered by a statistics period: this week, the last 4 weeks, the last 52 weeks, or everything. */
export function statWeeks(period: StatPeriod, currentWeek: string, firstWeek: string): string[] {
  const from = period === "week" ? currentWeek : period === "month" ? addWeeks(currentWeek, -3) : period === "year" ? addWeeks(currentWeek, -51) : firstWeek;
  return weekRange(from, currentWeek);
}

export interface StatRow {
  userId: string;
  runs: number;
  minutes: number;
  /** Null when the runner does not share distances with this crew. */
  km: number | null;
  /** Longest single run in minutes. */
  longest: number;
  streak: number;
  /** Share of finished weeks (plus the current one once done) with the plan done, in %; null without data. */
  onPlan: number | null;
}

/**
 * Real totals per runner for a period, from the precomputed weekly totals. Hidden distances stay
 * hidden: when sorting by km they always go last, so their order reveals nothing.
 */
export function crewStats(
  data: MemberData[],
  weeks: string[],
  currentWeek: string,
  prepWeeks: string[],
  showKm: (userId: string) => boolean,
): StatRow[] {
  const streaks = new Map(board("consistency", data, weeks, currentWeek, prepWeeks).map((r) => [r.userId, r.value ?? 0]));
  return data.map((m) => {
    const ws = weeks.map((w) => m.weeks.get(w)).filter((w): w is NonNullable<typeof w> => !!w);
    const sum = (f: (w: (typeof ws)[number]) => number) => ws.reduce((a, w) => a + f(w), 0);
    const first = [...m.weeks.keys()].filter((w) => (m.weeks.get(w)?.runs ?? 0) > 0).sort()[0];
    const judged = first ? weeks.filter((w) => w >= first && (w < currentWeek || countedWeek(m, w, m.weeks.get(w)).met)) : [];
    const met = judged.filter((w) => countedWeek(m, w, m.weeks.get(w)).met).length;
    return {
      userId: m.userId,
      runs: sum((w) => w.runs),
      minutes: Math.round(sum((w) => w.sec) / 60),
      km: showKm(m.userId) ? Math.round(sum((w) => w.km) * 10) / 10 : null,
      longest: Math.round(Math.max(0, ...ws.map((w) => w.longestSec)) / 60),
      streak: streaks.get(m.userId) ?? 0,
      onPlan: judged.length ? Math.round((met / judged.length) * 100) : null,
    };
  });
}

export function sortStats(rows: StatRow[], key: StatKey): StatRow[] {
  const v = (r: StatRow) => r[key];
  return [...rows].sort((a, b) => {
    const x = v(a), y = v(b);
    if (x == null && y == null) return a.userId.localeCompare(b.userId);
    if (x == null) return 1;
    if (y == null) return -1;
    return y - x || b.runs - a.runs || a.userId.localeCompare(b.userId);
  });
}
