import assert from "node:assert/strict";
import { test } from "node:test";
import { looseDate, looseDistanceKm, looseDuration, parseShortcutRun } from "../src/lib/import/shortcut.ts";

test("durations in all the shapes Shortcuts produces", () => {
  assert.equal(looseDuration(1925), 1925);
  assert.equal(looseDuration("1925"), 1925);
  assert.equal(looseDuration("32 min 5 s"), 1925);
  assert.equal(looseDuration("32:05"), 1925);
  assert.equal(looseDuration("0:32:05"), 1925);
  assert.equal(looseDuration("1 h 5 min"), 3900);
  assert.equal(looseDuration("1 Std. 5 Min."), 3900);
  assert.equal(looseDuration("32,5 min"), 1950);
  assert.equal(looseDuration("PT32M5S"), 1925);
  assert.equal(looseDuration(""), null);
});

test("distances with units and decimal commas", () => {
  assert.equal(looseDistanceKm("5,08 km"), 5.08);
  assert.equal(looseDistanceKm("5.08 km"), 5.08);
  assert.equal(looseDistanceKm("5080 m"), 5.08);
  assert.equal(looseDistanceKm("5.080 m"), 5.08); // German thousands separator
  assert.ok(Math.abs(looseDistanceKm("3.1 mi") - 4.989) < 0.001);
  assert.equal(looseDistanceKm(5.08), 5.08);
  assert.equal(looseDistanceKm(5080), 5.08);
  assert.equal(looseDistanceKm(undefined), 0);
});

test("dates: ISO, Health format and German short format (Vienna time)", () => {
  assert.equal(looseDate("2026-11-12T14:33:00+01:00")!.toISOString(), "2026-11-12T13:33:00.000Z");
  assert.equal(looseDate("2026-11-12 14:33:00 +0100")!.toISOString(), "2026-11-12T13:33:00.000Z");
  assert.equal(looseDate("12.11.2026, 14:33")!.toISOString(), "2026-11-12T13:33:00.000Z");
  assert.equal(looseDate("12.07.2026 um 08:05")!.toISOString(), "2026-07-12T06:05:00.000Z"); // summer time
  assert.equal(looseDate("gestern"), null);
});

test("a Shortcut run: duration from start/end if missing, rides skipped", () => {
  const r = parseShortcutRun({ start: "2026-11-12T07:00:00+01:00", end: "2026-11-12T07:32:00+01:00", distance: "5,1 km", avgHr: "152 bpm", type: "Laufen (Outdoor)" })!;
  assert.deepEqual([r.durationSec, r.distanceKm, r.avgHr, r.walkKnown], [1920, 5.1, 152, false]);
  assert.equal(r.externalId, "shortcut:2026-11-12T06:00");
  assert.equal(parseShortcutRun({ start: "2026-11-12T07:00:00+01:00", duration: 1800, type: "Outdoor Cycling" }), null);
  assert.equal(parseShortcutRun({ start: "nope", duration: 1800 }), null);
  assert.equal(parseShortcutRun({ start: "2026-11-12T07:00:00+01:00" }), null);
});
