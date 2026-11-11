import assert from "node:assert/strict";
import { test } from "node:test";
import { currentPhase, PHASES, run2Prescription } from "../src/lib/plan.ts";

const race = "2027-04-18";
const at = (d: string) => new Date(`${d}T12:00:00Z`);

test("phases line up with the agreed monthly plan for 18 April 2027", () => {
  assert.equal(currentPhase(race, at("2026-11-11")).id, "base");
  assert.equal(currentPhase(race, at("2026-12-20")).id, "base");
  assert.equal(currentPhase(race, at("2027-01-15")).id, "build1");
  assert.equal(currentPhase(race, at("2027-02-15")).id, "build2");
  assert.equal(currentPhase(race, at("2027-03-15")).id, "peak");
  assert.equal(currentPhase(race, at("2027-04-08")).id, "taper");
  assert.equal(currentPhase(race, at("2027-04-20")).id, "after");
});

test("tempo in Run 2 stays locked until 30 continuous easy minutes", () => {
  const build1 = PHASES.find((p) => p.id === "build1")!;
  assert.equal(run2Prescription(build1, false)?.kind, "easy");
  assert.deepEqual(run2Prescription(build1, true), { kind: "tempo", reps: 3, repMinutes: 5 });
});

import { tempoUnlock, weeklyLanes } from "../src/lib/plan.ts";

test("runs per week map to lanes, long run always last", () => {
  assert.deepEqual(weeklyLanes(2), ["run1", "run3"]);
  assert.deepEqual(weeklyLanes(3), ["run1", "run2", "run3"]);
  assert.deepEqual(weeklyLanes(4), ["run1", "run2", "run4", "run3"]);
});

test("tempo unlock: measured beats self-reported, beginners stay locked", () => {
  assert.equal(tempoUnlock(true, "new"), "measured");
  assert.equal(tempoUnlock(false, "easy30"), "reported");
  assert.equal(tempoUnlock(false, "regular"), "reported");
  assert.equal(tempoUnlock(false, "new"), null);
  assert.equal(tempoUnlock(false, null), null);
});
