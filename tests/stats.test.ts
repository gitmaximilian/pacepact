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

test("pace at the same heart rate: compares first and last runs around the typical HR", async () => {
  const { hrTrend } = await import("../src/lib/stats.ts");
  const now = new Date("2026-11-12T12:00:00Z");
  const hr = (d: string, paceSec: number, avgHr: number | null, runType = "run1") => ({
    startedAt: new Date(`${d}T07:00:00Z`), distanceKm: 5, durationSec: paceSec * 5, avgHr, effort: 4, walkBreaks: false, runType,
  });
  const runs = [
    hr("2026-10-01", 400, 148), hr("2026-10-08", 395, 150), hr("2026-10-15", 390, 147),
    hr("2026-10-22", 385, 149), hr("2026-10-29", 375, 148), hr("2026-11-05", 370, 151),
    hr("2026-11-06", 300, 175), // hard run, far from the typical HR: ignored
    hr("2026-11-07", 280, 148, "test"), // tests are ignored
    hr("2026-11-08", 360, null), // no heart rate
  ];
  const t = hrTrend(runs, now)!;
  assert.equal(t.refHr, 149);
  assert.equal(t.points.length, 6);
  assert.equal(t.firstPace, 398);
  assert.equal(t.lastPace, 373);
  assert.equal(t.fasterSec, 25);
  assert.equal(hrTrend(runs.slice(0, 3), now), null);
  assert.equal(hrTrend(runs, new Date("2027-06-01T00:00:00Z")), null); // too old
});
