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
