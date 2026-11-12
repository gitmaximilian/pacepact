import assert from "node:assert/strict";
import { test } from "node:test";
import { zonedDate } from "../src/lib/tz.ts";

test("manual run times are local times", () => {
  assert.equal(zonedDate("2026-11-12", "06:00", "Europe/Vienna")!.toISOString(), "2026-11-12T05:00:00.000Z");
  assert.equal(zonedDate("2026-07-12", "06:00", "Europe/Vienna")!.toISOString(), "2026-07-12T04:00:00.000Z");
  assert.equal(zonedDate("2026-11-12", "06:00", "America/New_York")!.toISOString(), "2026-11-12T11:00:00.000Z");
  assert.equal(zonedDate("2026-11-12", "06:00", "Not/AZone")!.toISOString(), "2026-11-12T05:00:00.000Z");
  assert.equal(zonedDate("12.11.2026", "06:00", "Europe/Vienna"), null);
});
