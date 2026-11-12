import assert from "node:assert/strict";
import { test } from "node:test";
import { fourWeeks, topMilestones, weekLanes, weekSummary } from "../src/lib/social/overview.ts";
import type { MemberData } from "../src/lib/social/scoring.ts";
import { aggregateWeeks, weekRange, type AggRun, type WeekAgg } from "../src/lib/social/weeks.ts";

const RACE = "2027-04-18";
const run = (d: string, min: number): AggRun => ({
  startedAt: new Date(`${d}T07:00:00Z`), distanceKm: min / 6, durationSec: min * 60, effort: 4, walkBreaks: false, walkKnown: true, runType: "run1", source: "manual",
});
const member = (userId: string, runs: AggRun[], runsPerWeek = 3): MemberData => {
  const weeks = new Map<string, WeekAgg>();
  for (const [k, v] of aggregateWeeks(runs)) weeks.set(k, v.all);
  return { userId, runsPerWeek, raceDate: RACE, weeks };
};
const CW = "2026-11-09";

test("week lanes: done first, then runs, then minutes; summary finds me", () => {
  const a = member("a", [run("2026-11-09", 30), run("2026-11-10", 30), run("2026-11-11", 30)]);
  const b = member("b", [run("2026-11-09", 200)]); // lots of minutes, but one run
  const c = member("c", [run("2026-11-09", 20), run("2026-11-10", 20)], 2);
  const d = member("d", []);
  const lanes = weekLanes([b, d, a, c], CW);
  assert.deepEqual(lanes.map((l) => l.userId), ["a", "c", "b", "d"]);
  const s = weekSummary(lanes, "b");
  assert.equal(s.ran, 3);
  assert.equal(s.done, 2);
  assert.equal(s.total, 4);
  assert.deepEqual(s.me && { place: s.me.place, runs: s.me.runs, target: s.me.target, met: s.me.met }, { place: 3, runs: 1, target: 3, met: false });
  // Minutes are capped at the plan + 10 %: 200 minutes in one run do not all count.
  assert.ok(s.me!.minutes < 200);
  assert.equal(weekSummary(lanes, "nobody").me, null);
});

test("four weeks: streak beats minutes, ties share a rank", () => {
  const weeks = ["2026-10-19", "2026-10-26", "2026-11-02"];
  const steady = member("steady", weeks.flatMap((w) => [run(w, 30), run(w, 30), run(w, 30)].map((r, i) => ({ ...r, startedAt: new Date(new Date(`${w}T07:00:00Z`).getTime() + i * 86400_000) }))));
  const burst = member("burst", [run("2026-11-02", 120), run("2026-11-03", 120)]);
  const twin: MemberData = { ...steady, userId: "twin" };
  const rows = fourWeeks([burst, steady, twin], CW, weekRange("2026-09-28", CW));
  assert.equal(rows[0].streak, 3);
  assert.deepEqual(rows.map((r) => r.rank), [1, 1, 3]);
  assert.equal(rows[2].userId, "burst");
});

test("milestones: only the highest per runner and kind", () => {
  const at = new Date();
  const ms = topMilestones([
    { userId: "a", kind: "continuous", value: 10, achievedAt: at },
    { userId: "a", kind: "continuous", value: 30, achievedAt: at },
    { userId: "a", kind: "continuous", value: 20, achievedAt: at },
    { userId: "a", kind: "distance", value: 5, achievedAt: at },
    { userId: "b", kind: "continuous", value: 10, achievedAt: at },
  ]);
  assert.deepEqual(ms.map((m) => `${m.userId}:${m.kind}:${m.value}`).sort(), ["a:continuous:30", "a:distance:5", "b:continuous:10"]);
});
