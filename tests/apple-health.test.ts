import assert from "node:assert/strict";
import { test } from "node:test";
import { mapHaeWorkout, parseHaeBody, parseHaeDate } from "../src/lib/import/apple-health.ts";
import { resolveDuplicate, sameRun, type StoredLike } from "../src/lib/dedupe.ts";

test("Health Auto Export dates", () => {
  assert.equal(parseHaeDate("2026-11-12 07:00:00 +0100")!.toISOString(), "2026-11-12T06:00:00.000Z");
  assert.equal(parseHaeDate("2024-02-06 07:00:00 -0800")!.toISOString(), "2024-02-06T15:00:00.000Z");
  assert.equal(parseHaeDate("nonsense"), null);
});

test("Health Auto Export v2 body: runs only, units converted, ids kept", () => {
  const runs = parseHaeBody({
    data: {
      workouts: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000", name: "Outdoor Run",
          start: "2026-11-12 07:00:00 +0100", end: "2026-11-12 07:32:00 +0100", duration: 1920,
          distance: { qty: 5.1, units: "km" }, avgHeartRate: { qty: 152.4, units: "count/min" }, maxHeartRate: { qty: 171, units: "count/min" },
          source: { name: "Apple Watch", identifier: "com.apple.health" },
        },
        { id: "b", name: "Indoor Run", start: "2026-11-13 18:00:00 +0100", end: "2026-11-13 18:30:00 +0100", duration: 1800, distance: { qty: 3.1, units: "mi" } },
        { id: "c", name: "Outdoor Cycling", start: "2026-11-14 10:00:00 +0100", duration: 3600, distance: { qty: 20, units: "km" } },
        { id: "d", name: "Traditional Strength Training", start: "2026-11-14 10:00:00 +0100", duration: 1800 },
      ],
      metrics: [],
    },
  });
  assert.equal(runs.length, 2);
  assert.deepEqual([runs[0].distanceKm, runs[0].durationSec, runs[0].avgHr, runs[0].maxHr, runs[0].externalId, runs[0].walkKnown], [5.1, 1920, 152, 171, "550e8400-e29b-41d4-a716-446655440000", false]);
  assert.ok(Math.abs(runs[1].distanceKm - 4.989) < 0.001);
});

test("Health Auto Export v1: no id, no duration, flat heart rate samples", () => {
  const r = mapHaeWorkout({
    name: "Running", start: "2026-11-12 07:00:00 +0100", end: "2026-11-12 07:30:00 +0100",
    distance: { qty: 5000, units: "m" }, heartRateData: [{ qty: 140 }, { qty: 160 }],
  })!;
  assert.deepEqual([r.durationSec, r.distanceKm, r.avgHr, r.maxHr], [1800, 5, 150, 160]);
  assert.equal(r.externalId, "2026-11-12T06:00:00.000Z");
  assert.equal(parseHaeBody({}).length, 0);
  assert.equal(parseHaeBody(null).length, 0);
});

const stored = (source: string, at: string, min: number, extra: Partial<StoredLike> = {}): StoredLike => ({
  id: `${source}-${at}`, source, startedAt: new Date(at), durationSec: min * 60, effort: null, notes: null, runType: "other", walkBreaks: false, walkKnown: false, ...extra,
});

test("dedupe: same run from Strava and Apple Health", () => {
  assert.equal(sameRun({ startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, { startedAt: new Date("2026-11-12T07:02:00Z"), durationSec: 1750 }), true);
  assert.equal(sameRun({ startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, { startedAt: new Date("2026-11-12T07:20:00Z"), durationSec: 1800 }), false);
  // Apple Health replaces the Strava copy (only it may count in crews) …
  const r1 = resolveDuplicate({ source: "apple-health", startedAt: new Date("2026-11-12T07:01:00Z"), durationSec: 1810 }, [stored("strava", "2026-11-12T07:00:00Z", 30)]);
  assert.equal(r1.action, "replace");
  // … and a later Strava copy is skipped.
  const r2 = resolveDuplicate({ source: "strava", startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, [stored("apple-health", "2026-11-12T07:01:00Z", 30)]);
  assert.equal(r2.action, "skip");
  // A watch recording replaces a hand-typed entry; a second manual entry is never merged into itself.
  assert.equal(resolveDuplicate({ source: "apple-health", startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, [stored("manual", "2026-11-12T07:00:00Z", 31)]).action, "replace");
  assert.equal(resolveDuplicate({ source: "manual", startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, [stored("manual", "2026-11-12T07:00:00Z", 30)]).action, "insert");
  assert.equal(resolveDuplicate({ source: "apple-health", startedAt: new Date("2026-11-13T07:00:00Z"), durationSec: 1800 }, [stored("strava", "2026-11-12T07:00:00Z", 30)]).action, "insert");
});
