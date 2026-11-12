import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDuplicate, sameRun, type StoredLike } from "../src/lib/dedupe.ts";

const stored = (source: string, at: string, min: number): StoredLike => ({
  id: `${source}-${at}`, source, startedAt: new Date(at), durationSec: min * 60, effort: 4, notes: null, runType: "run3", walkBreaks: false, walkKnown: true,
});

test("same run: start within 5 minutes and durations within 15 %", () => {
  assert.equal(sameRun({ startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, { startedAt: new Date("2026-11-12T07:02:00Z"), durationSec: 1750 }), true);
  assert.equal(sameRun({ startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, { startedAt: new Date("2026-11-12T07:20:00Z"), durationSec: 1800 }), false);
  assert.equal(sameRun({ startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, { startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1200 }), false);
});

test("an Apple Health import replaces the hand-typed copy; a later manual twin is skipped", () => {
  assert.equal(resolveDuplicate({ source: "apple-health", startedAt: new Date("2026-11-12T07:01:00Z"), durationSec: 1810 }, [stored("manual", "2026-11-12T07:00:00Z", 30)]).action, "replace");
  assert.equal(resolveDuplicate({ source: "manual", startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, [stored("apple-health", "2026-11-12T07:01:00Z", 30)]).action, "skip");
  assert.equal(resolveDuplicate({ source: "manual", startedAt: new Date("2026-11-12T07:00:00Z"), durationSec: 1800 }, [stored("manual", "2026-11-12T07:00:00Z", 30)]).action, "insert");
  assert.equal(resolveDuplicate({ source: "apple-health", startedAt: new Date("2026-11-13T07:00:00Z"), durationSec: 1800 }, [stored("manual", "2026-11-12T07:00:00Z", 30)]).action, "insert");
});
