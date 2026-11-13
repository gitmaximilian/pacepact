import assert from "node:assert/strict";
import { test } from "node:test";
import { HR_CREW_SINCE, hrNeedsRenewal, hrVisibleToCrew } from "../src/lib/hr.ts";

test("heart rate: crews see it only with a consent that covers crews", () => {
  assert.equal(hrVisibleToCrew(null), false);
  assert.equal(hrVisibleToCrew(new Date(HR_CREW_SINCE.getTime() - 1)), false);
  assert.equal(hrVisibleToCrew(HR_CREW_SINCE), true);
  assert.equal(hrNeedsRenewal(new Date("2026-11-01T00:00:00Z")), true);
  assert.equal(hrNeedsRenewal(null), false);
  assert.equal(hrNeedsRenewal(new Date(HR_CREW_SINCE.getTime() + 1000)), false);
});
