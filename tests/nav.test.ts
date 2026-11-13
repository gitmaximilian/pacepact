import assert from "node:assert/strict";
import { test } from "node:test";
import { sectionOf } from "../src/lib/nav.ts";

test("nav: every app path belongs to one of the three places", () => {
  assert.equal(sectionOf("/groups"), "crew");
  assert.equal(sectionOf("/groups/0e3c01b0-b378-4b14-b6d3-6637270dfcd2?tab=crew"), "crew");
  assert.equal(sectionOf("/rules"), "crew");
  assert.equal(sectionOf("/runs/new?back=%2Fgroups%2Fx"), "log");
  assert.equal(sectionOf("/import"), "log");
  assert.equal(sectionOf("/runs"), "me");
  assert.equal(sectionOf("/runs/"), "me");
  assert.equal(sectionOf("/dashboard"), "me");
  assert.equal(sectionOf("/challenges/new"), "me");
  assert.equal(sectionOf("/plan"), "me");
  assert.equal(sectionOf("/settings"), "settings");
  assert.equal(sectionOf("/runsx"), null);
  assert.equal(sectionOf("/"), null);
});
