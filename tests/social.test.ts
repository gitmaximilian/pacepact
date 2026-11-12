import assert from "node:assert/strict";
import { test } from "node:test";
import { weekPrescription, weekTarget, PHASES, isRaceWeek } from "../src/lib/plan.ts";
import { badgeFor, evaluate, longRunTarget, score, validContest, contestEnd } from "../src/lib/social/contests.ts";
import { board, countedWeek, easyPaceGain, enduranceGain, rank, streak, type MemberData } from "../src/lib/social/scoring.ts";
import { sourceKind } from "../src/lib/social/sources.ts";
import { aggregate, aggregateWeeks, milestonesFrom, weekKey, weekRange, type AggRun, type WeekAgg } from "../src/lib/social/weeks.ts";

const RACE = "2027-04-18";
const run = (d: string, km: number, min: number, extra: Partial<AggRun> = {}): AggRun => ({
  startedAt: new Date(`${d}T07:00:00Z`), distanceKm: km, durationSec: min * 60, effort: 4, walkBreaks: false, walkKnown: true,
  runType: "run1", source: "manual", ...extra,
});
const member = (userId: string, runs: AggRun[], runsPerWeek = 3): MemberData => {
  const weeks = new Map<string, WeekAgg>();
  for (const [k, v] of aggregateWeeks(runs)) weeks.set(k, v.all);
  return { userId, runsPerWeek, raceDate: RACE, weeks };
};

test("sources: Apple Health counts as device, everything else as self-reported", () => {
  assert.equal(sourceKind("apple-health"), "device");
  assert.equal(sourceKind("manual"), "manual");
});

test("weekly aggregation skips implausible runs and keeps walk breaks honest", () => {
  const w = aggregateWeeks([
    run("2026-11-09", 5, 30),
    run("2026-11-10", 21, 30), // 1:26 min/km: implausible
    run("2026-11-12", 4, 40, { walkKnown: false, source: "apple-health" }),
    run("2026-11-13", 3, 25, { walkBreaks: true }),
  ]);
  const a = w.get("2026-11-09")!;
  assert.equal(a.all.runs, 3);
  assert.equal(a.all.sec, 95 * 60);
  assert.equal(a.all.continuousSec, 30 * 60); // the 40-minute import does not count as continuous
  assert.equal(a.all.walkRuns, 1);
  assert.equal(a.device.runs, 1);
  assert.equal(weekKey(new Date("2026-11-15T23:00:00Z")), "2026-11-09");
});

test("milestones: first run reaching each threshold", () => {
  const ms = milestonesFrom([run("2026-11-09", 3, 22), run("2026-11-16", 5.2, 31), run("2026-11-23", 5, 33, { runType: "test" })]);
  const c30 = ms.find((m) => m.kind === "continuous" && m.value === 30)!;
  assert.equal(c30.achievedAt.toISOString().slice(0, 10), "2026-11-16");
  assert.ok(ms.some((m) => m.kind === "distance" && m.value === 5));
  assert.ok(ms.some((m) => m.kind === "test" && m.value === 5));
  assert.ok(!ms.some((m) => m.kind === "continuous" && m.value === 45));
});

test("lighter weeks and race week change the prescription", () => {
  const build1 = PHASES.find((p) => p.id === "build1")!;
  const light = weekPrescription(build1, { lighter: true, raceWeek: false });
  assert.deepEqual(light.run1, [25, 30]);
  assert.equal(light.run2?.kind === "tempo" && light.run2.reps, 2);
  const raceWeek = weekPrescription(PHASES.find((p) => p.id === "taper")!, { lighter: false, raceWeek: true });
  assert.equal(raceWeek.run3, null);
  assert.equal(isRaceWeek(RACE, "2027-04-12"), true);
  assert.equal(isRaceWeek(RACE, "2027-04-05"), false);
});

test("week targets keep the run count in lighter weeks and cap minutes", () => {
  const normal = weekTarget(3, RACE, "2026-11-09");
  assert.equal(normal.runs, 3);
  assert.ok(normal.capSec > 60 * 60 && normal.capSec < 120 * 60);
  const lighter = weekTarget(3, RACE, "2027-03-15"); // four weeks out
  assert.equal(lighter.lighter, true);
  assert.equal(lighter.runs, 3);
  assert.ok(lighter.capSec < weekTarget(3, RACE, "2027-03-08").capSec);
  assert.equal(weekTarget(3, RACE, "2027-04-12").raceWeek, true);
  assert.equal(weekTarget(2, null, "2026-11-09").runs, 2);
});

test("extra volume beyond the plan earns nothing", () => {
  const m = member("a", [run("2026-11-09", 10, 60), run("2026-11-10", 10, 60), run("2026-11-11", 10, 60), run("2026-11-12", 10, 60)]);
  const c = countedWeek(m, "2026-11-09", m.weeks.get("2026-11-09"));
  assert.equal(c.runs, 3);
  assert.equal(c.sec, c.target.capSec);
  assert.ok(c.km < 40);
  assert.equal(c.met, true);
});

test("streak: the running week never breaks it", () => {
  const runs: AggRun[] = [];
  for (const w of ["2026-11-02", "2026-11-09", "2026-11-16"]) for (let i = 0; i < 3; i++) runs.push(run(w.replace(/\d\d$/, (d) => String(Number(d) + i).padStart(2, "0")), 3, 25));
  const m = member("a", runs);
  const weeks = weekRange("2026-10-26", "2026-11-23");
  assert.equal(streak(m, "2026-11-23", weeks), 3); // current week empty: still 3
  assert.equal(streak(m, "2026-11-16", weeks), 3); // current week done: counts
});

test("ranking: ties share a rank, missing values go last", () => {
  const r = rank([{ userId: "a", value: 3 }, { userId: "b", value: null }, { userId: "c", value: 3 }, { userId: "d", value: 5 }]);
  assert.deepEqual(r.map((x) => [x.userId, x.rank]), [["d", 1], ["a", 2], ["c", 2], ["b", null]]);
});

test("progress against own start: endurance and pace at comparable effort", () => {
  const m = member("a", [
    run("2026-11-02", 2, 15, { walkBreaks: true }), run("2026-11-09", 2.5, 18), run("2026-11-16", 3, 21),
    run("2026-11-23", 3.5, 24), run("2026-11-30", 4.5, 30), run("2026-12-07", 5, 32),
  ]);
  assert.equal(enduranceGain(m, ["2026-12-07"]), 32 - 18);
  const g = easyPaceGain(m, "2026-12-07")!;
  assert.ok(g > 0, `expected faster at the same effort, got ${g}`);
  assert.equal(easyPaceGain(member("b", [run("2026-11-02", 3, 20)]), "2026-12-07"), null);
});

test("adherence board: a slower runner who follows the plan beats a fast one who skips runs", () => {
  const slow = member("slow", [run("2026-11-09", 3, 25), run("2026-11-11", 3, 25), run("2026-11-13", 4, 35)]);
  const fast = member("fast", [run("2026-11-09", 12, 50)]);
  const rows = board("adherence", [slow, fast], ["2026-11-09"], "2026-11-16", ["2026-11-09", "2026-11-16"]);
  assert.equal(rows[0].userId, "slow");
  assert.equal(rows[0].value, 100);
  assert.equal(rows[0].done, true);
});

test("challenges: validation and templates stay within the plan", () => {
  assert.equal(validContest({ kind: "coop", metric: "km", target: 200, weeks: 4 }), true);
  assert.equal(validContest({ kind: "duel", metric: "km", target: 50, weeks: 1 }), false); // no km duels
  assert.equal(validContest({ kind: "compete", metric: "planWeeks", target: 6, weeks: 4 }), false);
  assert.equal(validContest({ kind: "personal", metric: "continuous", target: 30, weeks: 13 }), false);
  assert.equal(contestEnd({ startWeek: "2026-11-30", weeks: 5 }), "2027-01-03");
});

test("challenges: long run +10 % is capped and needs a baseline", () => {
  const m = member("a", [run("2026-11-02", 5, 40), run("2026-11-30", 9, 70)]);
  const target = longRunTarget(m, "2026-11-30")!;
  assert.equal(target, 44);
  assert.equal(score({ kind: "personal", metric: "longRun", target, weeks: 4, startWeek: "2026-11-30" }, m), 44);
  assert.equal(longRunTarget(member("b", []), "2026-11-30"), null);
});

test("challenges: duel, coop and compete outcomes with stickers", () => {
  const a = member("a", [run("2026-11-09", 5, 30), run("2026-11-11", 5, 30)]);
  const b = member("b", [run("2026-11-10", 5, 35)]);
  const duel = { kind: "duel" as const, metric: "minutes" as const, target: 90, weeks: 1, startWeek: "2026-11-09" };
  const o = evaluate(duel, [a, b]);
  assert.equal(o.standings[0].userId, "a");
  assert.equal(badgeFor(duel, o, o.standings[0]), "duel");
  assert.equal(badgeFor(duel, o, o.standings[1]), null);

  const coop = { kind: "coop" as const, metric: "minutes" as const, target: 90, weeks: 1, startWeek: "2026-11-09" };
  const oc = evaluate(coop, [a, b]);
  assert.equal(oc.total, 95);
  assert.equal(oc.teamDone, true);
  assert.equal(badgeFor(coop, oc, oc.standings[1]), "team");

  const tie = evaluate(duel, [a, member("c", [run("2026-11-12", 10, 60)])]);
  assert.equal(badgeFor(duel, tie, tie.standings[0]), "draw");
});

test("aggregate of an empty list is zero", () => {
  assert.equal(aggregate([]).runs, 0);
});

test("adherence: weeks before the first run are not counted as missed", () => {
  const fresh = member("new", [run("2026-11-16", 3, 25), run("2026-11-17", 3, 25), run("2026-11-18", 3, 25)]);
  const month = ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"];
  const [row] = board("adherence", [fresh], month, "2026-11-16", month);
  assert.equal(row.value, 100);
  assert.equal(row.done, true);
});
