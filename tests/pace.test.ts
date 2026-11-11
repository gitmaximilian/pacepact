import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDuration, formatPace, HALF_MARATHON_KM, paceSecPerKm, parseDuration } from "../src/lib/pace.ts";

test("sub-2 half marathon needs about 5:41/km", () => {
  assert.equal(formatPace(paceSecPerKm(7199, HALF_MARATHON_KM)), "5:41");
  assert.equal(formatPace(paceSecPerKm(6600, HALF_MARATHON_KM)), "5:13");
});

test("baseline treadmill test: 2.0008 km in 15:09 is 7:34/km", () => {
  assert.equal(formatPace(paceSecPerKm(909, 2.0008)), "7:34");
});

test("parseDuration accepts h:mm:ss, mm:ss and minutes", () => {
  assert.equal(parseDuration("1:59:59"), 7199);
  assert.equal(parseDuration("15:09"), 909);
  assert.equal(parseDuration("45"), 2700);
  assert.equal(parseDuration("1:75"), null);
  assert.equal(parseDuration("abc"), null);
  assert.equal(parseDuration("0"), null);
});

test("formatDuration", () => {
  assert.equal(formatDuration(909), "15:09");
  assert.equal(formatDuration(7199), "1:59:59");
});
