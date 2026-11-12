import assert from "node:assert/strict";
import { test } from "node:test";
import { mapStravaActivity } from "../src/lib/providers/strava.ts";

test("Strava: keeps runs, drops rides", () => {
  const r = mapStravaActivity({ id: 1, sport_type: "Run", start_date: "2026-11-12T07:00:00Z", distance: 5200, moving_time: 1980, average_heartrate: 158.4 });
  assert.deepEqual([r!.distanceKm, r!.durationSec, r!.externalId], [5.2, 1980, "1"]);
  assert.equal(mapStravaActivity({ id: 2, sport_type: "Ride" }), null);
  assert.equal(mapStravaActivity({ id: 3, sport_type: "TrailRun", start_date: "2026-11-12T07:00:00Z", distance: 8000, moving_time: 3600 })!.distanceKm, 8);
});

import { fetchStravaPage } from "../src/lib/providers/strava.ts";

test("Strava history: one page at a time, runs only, 'more' when the page is full", async () => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    const page = Number(new URL(String(url)).searchParams.get("page"));
    const items = page === 1
      ? [
          { id: 1, sport_type: "Run", start_date: "2026-01-02T07:00:00Z", distance: 5000, moving_time: 1800 },
          { id: 2, sport_type: "Ride", start_date: "2026-01-03T07:00:00Z", distance: 20000, moving_time: 3600 },
        ]
      : [];
    return new Response(JSON.stringify(items), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const p1 = await fetchStravaPage("tok", new Date("2026-01-01T00:00:00Z"), 1, 2);
    assert.deepEqual([p1.runs.length, p1.activities, p1.more], [1, 2, true]);
    const p2 = await fetchStravaPage("tok", new Date("2026-01-01T00:00:00Z"), 2, 2);
    assert.deepEqual([p2.runs.length, p2.more], [0, false]);
    assert.ok(calls[0].includes("after=1767225600") && calls[0].includes("per_page=2") && calls[0].includes("page=1"));
  } finally {
    globalThis.fetch = realFetch;
  }
});
