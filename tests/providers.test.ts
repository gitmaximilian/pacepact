import assert from "node:assert/strict";
import { test } from "node:test";
import { isoDurationToSec, mapFitbitActivity, mapPolarExercise, mapSuuntoWorkout, mapWahooWorkout } from "../src/lib/providers/others.ts";
import { mapStravaActivity } from "../src/lib/providers/strava.ts";

test("Strava: keeps runs, drops rides", () => {
  const r = mapStravaActivity({ id: 1, sport_type: "Run", start_date: "2026-11-12T07:00:00Z", distance: 5200, moving_time: 1980, average_heartrate: 158.4 });
  assert.deepEqual([r!.distanceKm, r!.durationSec, r!.externalId], [5.2, 1980, "1"]);
  assert.equal(mapStravaActivity({ id: 2, sport_type: "Ride" }), null);
});

test("Fitbit: converts miles", () => {
  const r = mapFitbitActivity({ logId: 9, activityName: "Run", startTime: "2026-11-12T07:00:00.000+01:00", distance: 3.1, distanceUnit: "Mile", activeDuration: 1800000 });
  assert.ok(Math.abs(r!.distanceKm - 4.989) < 0.01);
  assert.equal(r!.durationSec, 1800);
});

test("Polar: ISO durations and sport filter", () => {
  assert.equal(isoDurationToSec("PT1H2M3S"), 3723);
  assert.equal(isoDurationToSec("PT33M0.5S"), 1980.5);
  const r = mapPolarExercise({ id: "a", sport: "RUNNING", start_time: "2026-11-12T07:00:00", duration: "PT30M", distance: 5000, heart_rate: { average: 150, maximum: 170 } });
  assert.deepEqual([r!.distanceKm, r!.durationSec, r!.avgHr], [5, 1800, 150]);
  assert.equal(mapPolarExercise({ id: "b", sport: "CYCLING", duration: "PT1H" }), null);
});

test("Wahoo and Suunto mapping", () => {
  const w = mapWahooWorkout({ id: 5, workout_type_id: 1, starts: "2026-11-12T07:00:00Z", workout_summary: { distance_accum: "5000.0", duration_active_accum: "1800.0", heart_rate_avg: "150.0" } });
  assert.deepEqual([w!.distanceKm, w!.durationSec, w!.avgHr], [5, 1800, 150]);
  const s = mapSuuntoWorkout({ workoutKey: "k", activityId: 3, startTime: 1794470400000, totalDistance: 5000, totalTime: 1800, hrdata: { workoutAvgHR: 150 } });
  assert.deepEqual([s!.distanceKm, s!.durationSec, s!.avgHr], [5, 1800, 150]);
});
