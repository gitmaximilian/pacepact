import assert from "node:assert/strict";
import { test } from "node:test";
import { mapStravaActivity } from "../src/lib/providers/strava.ts";

test("Strava: keeps runs, drops rides", () => {
  const r = mapStravaActivity({ id: 1, sport_type: "Run", start_date: "2026-11-12T07:00:00Z", distance: 5200, moving_time: 1980, average_heartrate: 158.4 });
  assert.deepEqual([r!.distanceKm, r!.durationSec, r!.externalId], [5.2, 1980, "1"]);
  assert.equal(mapStravaActivity({ id: 2, sport_type: "Ride" }), null);
  assert.equal(mapStravaActivity({ id: 3, sport_type: "TrailRun", start_date: "2026-11-12T07:00:00Z", distance: 8000, moving_time: 3600 })!.distanceKm, 8);
});
