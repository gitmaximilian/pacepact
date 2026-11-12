/**
 * Challenges (group, duel and personal). Pure definitions and evaluation.
 *
 * Guard rails: challenges never reward more than the plan. Minutes and km count only up to
 * the planned minutes plus 10 % per week, runs only up to the planned runs per week, a long-run
 * challenge only up to +10 %. Lighter weeks and taper keep the run target, so they count as done.
 */
import type { ChallengeKind, ChallengeMetric } from "@/db/schema";
import { countedWeek, type MemberData } from "./scoring";
import { addWeeks, weekRange } from "./weeks";

export const METRICS_BY_KIND: Record<ChallengeKind, ChallengeMetric[]> = {
  coop: ["minutes", "runs", "km"],
  compete: ["minutes", "runs", "planWeeks", "test"],
  duel: ["minutes", "runs"],
  personal: ["planWeeks", "continuous", "longRun", "test", "minutes", "runs"],
};

export interface Template {
  id: string;
  kind: ChallengeKind;
  metric: ChallengeMetric;
  weeks: number;
  target: number;
  sticker: string;
}

export const TEMPLATES: Template[] = [
  { id: "teamMinutes", kind: "coop", metric: "minutes", weeks: 4, target: 1500, sticker: "🤝" },
  { id: "teamKm", kind: "coop", metric: "km", weeks: 4, target: 200, sticker: "🛣️" },
  { id: "planStreak", kind: "compete", metric: "planWeeks", weeks: 4, target: 4, sticker: "🔥" },
  { id: "mostRuns", kind: "compete", metric: "runs", weeks: 4, target: 12, sticker: "🏃" },
  { id: "duelMinutes", kind: "duel", metric: "minutes", weeks: 1, target: 90, sticker: "⚔️" },
  { id: "groupTest5k", kind: "compete", metric: "test", weeks: 4, target: 5, sticker: "⏱️" },
  { id: "groupTest10k", kind: "compete", metric: "test", weeks: 4, target: 10, sticker: "🏁" },
  { id: "myPlanStreak", kind: "personal", metric: "planWeeks", weeks: 4, target: 4, sticker: "📅" },
  { id: "continuous30", kind: "personal", metric: "continuous", weeks: 4, target: 30, sticker: "🫁" },
  { id: "longRun10", kind: "personal", metric: "longRun", weeks: 4, target: 0, sticker: "📈" },
  { id: "test5k", kind: "personal", metric: "test", weeks: 4, target: 5, sticker: "⏱️" },
  { id: "test10k", kind: "personal", metric: "test", weeks: 4, target: 10, sticker: "🏁" },
];

export function template(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

const LIMITS: Record<ChallengeMetric, [number, number]> = {
  minutes: [10, 20000],
  runs: [1, 200],
  km: [1, 5000],
  planWeeks: [1, 12],
  continuous: [5, 180],
  longRun: [10, 240],
  test: [1, 21.1],
};

export interface ContestInput {
  kind: ChallengeKind;
  metric: ChallengeMetric;
  target: number;
  weeks: number;
}

export function validContest(c: ContestInput): boolean {
  if (!METRICS_BY_KIND[c.kind]?.includes(c.metric)) return false;
  if (!Number.isInteger(c.weeks) || c.weeks < 1 || c.weeks > 12) return false;
  const [lo, hi] = LIMITS[c.metric];
  if (!(c.target >= lo && c.target <= hi)) return false;
  if (c.metric === "planWeeks" && c.target > c.weeks) return false;
  return true;
}

/** Long-run challenge target: the longest run of the four weeks before the start, plus 10 %. */
export function longRunTarget(m: MemberData, startWeek: string): number | null {
  const before = weekRange(addWeeks(startWeek, -4), addWeeks(startWeek, -1));
  const base = Math.max(0, ...before.map((w) => m.weeks.get(w)?.longestSec ?? 0));
  if (base < 10 * 60) return null;
  return Math.round((base / 60) * 1.1);
}

export function contestWeeks(c: { startWeek: string; weeks: number }): string[] {
  return weekRange(c.startWeek, addWeeks(c.startWeek, c.weeks - 1));
}

/** Last day (Sunday) of a challenge, YYYY-MM-DD. */
export function contestEnd(c: { startWeek: string; weeks: number }): string {
  const end = new Date(new Date(`${c.startWeek}T00:00:00Z`).getTime() + (c.weeks * 7 - 1) * 86400_000);
  return end.toISOString().slice(0, 10);
}

/** One participant's score, already capped by the plan. */
export function score(c: ContestInput & { startWeek: string }, m: MemberData): number {
  const weeks = contestWeeks(c);
  const counted = weeks.map((w) => ({ w, agg: m.weeks.get(w), c: countedWeek(m, w, m.weeks.get(w)) }));
  const max = (f: (x: (typeof counted)[number]) => number) => Math.max(0, ...counted.map(f));
  switch (c.metric) {
    case "minutes":
      return Math.round(counted.reduce((a, x) => a + x.c.sec, 0) / 60);
    case "runs":
      return counted.reduce((a, x) => a + x.c.runs, 0);
    case "km":
      return Math.round(counted.reduce((a, x) => a + x.c.km, 0) * 10) / 10;
    case "planWeeks":
      return counted.filter((x) => x.c.met).length;
    case "continuous":
      return Math.min(c.target, Math.floor(max((x) => x.agg?.continuousSec ?? 0) / 60));
    case "longRun":
      return Math.min(c.target, Math.floor(max((x) => x.agg?.longestSec ?? 0) / 60));
    case "test":
      return Math.min(c.target, max((x) => x.agg?.testKm ?? 0));
  }
}

export interface Standing {
  userId: string;
  score: number;
  progress: number; // 0..1 towards the target
  completed: boolean;
  rank: number;
}

export interface Outcome {
  standings: Standing[];
  /** Coop: combined score and whether the team made it. */
  total: number;
  teamDone: boolean;
}

export function evaluate(c: ContestInput & { startWeek: string }, participants: MemberData[]): Outcome {
  const scored = participants.map((m) => ({ userId: m.userId, score: score(c, m) }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const standings = sorted.map((s) => ({
    ...s,
    progress: c.kind === "coop" ? 0 : Math.min(1, s.score / c.target),
    completed: c.kind !== "coop" && s.score >= c.target,
    rank: 1 + sorted.filter((o) => o.score > s.score).length,
  }));
  const total = Math.round(scored.reduce((a, s) => a + s.score, 0) * 10) / 10;
  return { standings, total, teamDone: c.kind === "coop" && total >= c.target };
}

/** Sticker earned when a challenge ends, or null. */
export function badgeFor(c: ContestInput, o: Outcome, s: Standing): string | null {
  switch (c.kind) {
    case "coop":
      return o.teamDone && s.score > 0 ? "team" : null;
    case "duel":
      if (s.score === 0) return null;
      return o.standings.every((x) => x.score === s.score) ? "draw" : s.rank === 1 ? "duel" : null;
    case "compete":
      if (s.rank === 1 && s.score > 0) return "gold";
      return s.completed ? "finisher" : null;
    case "personal":
      return s.completed ? "personal" : null;
  }
}
