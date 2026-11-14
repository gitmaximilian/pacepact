import assert from "node:assert/strict";
import { test } from "node:test";
import { buckets, cellFill, smooth, chartWeeks, crewSeries, heatmap, niceMax, paceRange, personSeries, personTrend } from "../src/lib/social/charts.ts";
import type { MemberData } from "../src/lib/social/scoring.ts";
import { aggregate, aggregateWeeks, weekRange, type AggRun, type WeekAgg } from "../src/lib/social/weeks.ts";

const RACE = "2027-04-18";
const run = (d: string, min: number, km = min / 6): AggRun => ({
  startedAt: new Date(`${d}T07:00:00Z`), distanceKm: km, durationSec: min * 60, effort: 4, walkBreaks: false, walkKnown: true, runType: "run1", source: "manual",
});
const member = (userId: string, runs: AggRun[], runsPerWeek = 3): MemberData => {
  const weeks = new Map<string, WeekAgg>();
  for (const [k, v] of aggregateWeeks(runs)) weeks.set(k, v.all);
  return { userId, runsPerWeek, raceDate: RACE, weeks };
};
const CW = "2026-11-09";
const week3 = (w: string, min = 30) => [0, 2, 4].map((d) => run(new Date(new Date(`${w}T00:00:00Z`).getTime() + d * 86400_000).toISOString().slice(0, 10), min));

test("chart window: at least eight weeks, never before what the crew home shows", () => {
  // Crew started long ago: week and 4 weeks show the last 8 weeks.
  assert.equal(chartWeeks("week", CW, "2026-01-05").length, 8);
  assert.equal(chartWeeks("month", CW, "2026-01-05")[0], "2026-09-21");
  // A new crew: only the four weeks the crew home already shows.
  assert.deepEqual(chartWeeks("month", CW, "2026-11-02"), weekRange("2026-10-19", CW));
  // Year and all time start at the crew start.
  assert.equal(chartWeeks("year", CW, "2026-06-01")[0], "2026-06-01");
  assert.equal(chartWeeks("year", CW, "2024-06-03").length, 52);
  assert.equal(chartWeeks("all", CW, "2024-06-03")[0], "2024-06-03");
  // ... but not before the crew's first run.
  assert.equal(chartWeeks("all", CW, "2024-06-03", "2026-08-03")[0], "2026-08-03");
  assert.equal(chartWeeks("year", CW, "2024-06-03", "2026-08-03")[0], "2026-08-03");
  assert.equal(chartWeeks("month", CW, "2024-06-03", "2026-11-02")[0], "2026-09-21");
  // A crew starting this week has one week.
  assert.deepEqual(chartWeeks("all", CW, CW), [CW]);
});

test("buckets: weeks up to the limit, then calendar months", () => {
  assert.equal(buckets(weekRange("2026-09-07", CW)).length, 10);
  const ms = buckets(weekRange("2025-11-10", CW));
  assert.equal(ms[0].kind, "month");
  assert.equal(ms[0].start, "2025-11-10");
  assert.equal(ms.length, 13);
  assert.equal(ms.reduce((a, b) => a + b.weeks.length, 0), weekRange("2025-11-10", CW).length);
  assert.deepEqual(buckets([]), []);
});

test("crew series: real minutes, plan from each runner's first run, running week judged once done", () => {
  const a = member("a", [...week3("2026-10-26"), ...week3("2026-11-02")]);
  const b = member("b", [run("2026-11-03", 40)]); // starts in week 2, not done
  const c = member("c", []); // never ran: no plan
  const bs = buckets(["2026-10-26", "2026-11-02", CW]);
  const s = crewSeries([a, b, c], bs, CW);
  assert.equal(s[0].minutes, 90);
  assert.equal(s[0].active, 1);
  assert.equal(s[0].done, 100);
  assert.equal(s[1].minutes, 130);
  assert.equal(s[1].runs, 4);
  assert.equal(s[1].done, 50);
  assert.ok(s[1].plan > s[0].plan);
  // Running week, nobody done: not judged yet.
  assert.equal(s[2].done, null);
  assert.equal(s[2].minutes, 0);
});

test("person series: capped minutes, gaps before the first run, cumulative total", () => {
  const big = member("big", [run("2026-10-26", 400), ...week3("2026-11-02")]);
  const late = member("late", week3("2026-11-02"));
  const bs = buckets(["2026-10-19", "2026-10-26", "2026-11-02"]);
  const [p, q] = personSeries([big, late], bs);
  assert.equal(p.minutes[0], null);
  assert.ok(p.minutes[1]! < 400, "capped at plan + 10 %");
  assert.equal(p.minutes[2], 90);
  assert.equal(p.cumulative[2], p.minutes[1]! + 90);
  assert.deepEqual(q.minutes, [null, null, 90]);
  assert.deepEqual(q.cumulative, [null, null, 90]);
});

test("heatmap: done, part, miss, open and before the first run", () => {
  const m = member("m", [...week3("2026-10-19"), run("2026-10-26", 30)]);
  const bs = buckets(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", CW]);
  const [row] = heatmap([m], bs, CW);
  assert.deepEqual(row.cells.map((c) => c.state), ["pre", "done", "part", "miss", "open"]);
  assert.equal(row.cells[2].runs, 1);
  assert.equal(row.cells[2].of, 3);
  // Months: share of done weeks.
  const months = buckets(weekRange("2025-09-01", CW));
  const steady = member("s", weekRange("2026-10-05", "2026-11-02").flatMap((w) => week3(w)));
  const cells = heatmap([steady], months, CW)[0].cells;
  const oct = cells.find((c) => c.of > 0 && c.state === "done");
  assert.ok(oct);
  assert.equal(cells[0].state, "pre");
});

test("person trend: pace from runs with a distance only, longest run", () => {
  const m = member("m", [run("2026-11-02", 30, 5), run("2026-11-03", 60, 0), run("2026-11-04", 36, 6)]);
  const [t, none] = personTrend(m, buckets(["2026-11-02", CW]));
  assert.equal(t.pace, Math.round((66 * 60) / 11)); // the run without distance does not slow the pace down
  assert.equal(t.longest, 60);
  assert.deepEqual(none, { pace: null, longest: null });
  // Rows stored before distSec existed fall back to all the week's time.
  const old = { ...aggregate([run("2026-11-02", 30, 5)]), distSec: null };
  const o = personTrend({ ...m, weeks: new Map([["2026-11-02", old]]) }, buckets(["2026-11-02"]));
  assert.equal(o[0].pace, 360);
});

test("axis helpers", () => {
  assert.deepEqual(niceMax(0), { max: 4, step: 1 });
  assert.deepEqual(niceMax(87), { max: 100, step: 25 });
  assert.deepEqual(niceMax(412), { max: 600, step: 200 });
  assert.equal(paceRange([null, null]), null);
  assert.deepEqual(paceRange([330, 345]), { lo: 315, hi: 360 });
  assert.deepEqual(paceRange([400]), { lo: 390, hi: 420 });
});

test("grid fill: full only when done, partial weeks and months stay visibly partial", () => {
  assert.equal(cellFill({ state: "done", runs: 3, of: 3, met: 1 }, "week"), 1);
  assert.equal(cellFill({ state: "part", runs: 1, of: 3, met: 0 }, "week"), 1 / 3);
  assert.equal(cellFill({ state: "part", runs: 5, of: 3, met: 0 }, "week"), 0.67);
  assert.equal(cellFill({ state: "part", runs: 2, of: 4, met: 0 }, "month"), 0.2);
  assert.equal(cellFill({ state: "part", runs: 9, of: 4, met: 2 }, "month"), 0.5);
  assert.equal(cellFill({ state: "miss", runs: 0, of: 3, met: 0 }, "week"), 0);
  assert.equal(cellFill({ state: "pre", runs: 0, of: 0, met: 0 }, "week"), 0);
});

test("smooth: trailing average, gaps stay gaps", () => {
  assert.deepEqual(smooth([null, 30, 90, 0, null, 60]), [null, 30, 60, 40, null, 30]);
  assert.deepEqual(smooth([]), []);
});
