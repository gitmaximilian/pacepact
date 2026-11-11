import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize, weekStart } from "../src/lib/stats.ts";

const run = (d: string, km: number, sec: number, walk = false) => ({
  startedAt: new Date(d), distanceKm: km, durationSec: sec, avgHr: null, effort: 5, walkBreaks: walk, runType: "run1",
});

test("week starts on Monday", () => {
  assert.equal(weekStart(new Date("2026-11-11T10:00:00Z")).toISOString().slice(0, 10), "2026-11-09");
  assert.equal(weekStart(new Date("2026-11-15T23:00:00Z")).toISOString().slice(0, 10), "2026-11-09");
});

test("summary and 30-minute milestone ignore runs with walk breaks", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const s = summarize([run("2026-11-05T18:00:00Z", 2.0, 909, true), run("2026-11-18T18:00:00Z", 4.0, 1900, true), run("2026-11-19T18:00:00Z", 3.5, 1500)], now);
  assert.equal(s.count, 3);
  assert.equal(s.weekRuns, 2);
  assert.equal(Math.round(s.totalKm * 10) / 10, 9.5);
  assert.equal(s.longestContinuousSec, 1500);
  assert.equal(s.reached30MinContinuous, false);
});
