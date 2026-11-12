import assert from "node:assert/strict";
import { test } from "node:test";
import { isPlausibleRun, safeLocalPath } from "../src/lib/plausibility.ts";

test("rejects runs faster than 2:30 min/km", () => {
  assert.equal(isPlausibleRun({ distanceKm: 21, durationSec: 30 * 60 }), false); // 1:26 min/km
  assert.equal(isPlausibleRun({ distanceKm: 5, durationSec: 12 * 60 }), false); // 2:24 min/km
  assert.equal(isPlausibleRun({ distanceKm: 5, durationSec: 13 * 60 }), true); // 2:36 min/km
  assert.equal(isPlausibleRun({ distanceKm: 2, durationSec: 909 }), true); // Max's 2 km test
});

test("short or distance-less runs are not judged by pace", () => {
  assert.equal(isPlausibleRun({ distanceKm: 0, durationSec: 1800 }), true); // treadmill without distance
  assert.equal(isPlausibleRun({ distanceKm: 0.3, durationSec: 30 }), true);
  assert.equal(isPlausibleRun({ distanceKm: 5, durationSec: 0 }), false);
});

test("only same-origin paths are allowed as redirect targets", () => {
  assert.equal(safeLocalPath("/runs"), "/runs");
  assert.equal(safeLocalPath("/groups/abc?x=1"), "/groups/abc?x=1");
  for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "evil", "", "/a b"]) {
    assert.equal(safeLocalPath(bad), "/", bad);
  }
});
