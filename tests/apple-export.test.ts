import assert from "node:assert/strict";
import { test } from "node:test";
import { AppleExportScanner, parseExportDate, scanExport } from "../src/lib/import/apple-export.ts";

const records = Array.from({ length: 300 }, (_, i) =>
  ` <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" creationDate="2026-11-0${(i % 9) + 1} 10:00:00 +0100" startDate="2026-11-01 10:00:00 +0100" endDate="2026-11-01 10:01:00 +0100" value="${i}"/>`,
).join("\n");

// Newer layout: distance and heart rate in WorkoutStatistics, plus nested children.
const newRun = ` <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="32.08333333333334" durationUnit="min" sourceName="Max’s Apple Watch" sourceVersion="26.0" creationDate="2026-11-12 07:33:01 +0100" startDate="2026-11-12 07:00:00 +0100" endDate="2026-11-12 07:32:05 +0100">
  <MetadataEntry key="HKIndoorWorkout" value="0"/>
  <WorkoutEvent type="HKWorkoutEventTypeSegment" date="2026-11-12 07:00:00 +0100" duration="5.2" durationUnit="min"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-11-12 07:00:00 +0100" endDate="2026-11-12 07:32:05 +0100" sum="350" unit="kcal"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" startDate="2026-11-12 07:00:00 +0100" endDate="2026-11-12 07:32:05 +0100" sum="5.081" unit="km"/>
  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" startDate="2026-11-12 07:00:00 +0100" endDate="2026-11-12 07:32:05 +0100" average="152.4" minimum="98" maximum="171" unit="count/min"/>
  <WorkoutRoute sourceName="Max’s Apple Watch"><FileReference path="/workout-routes/route_2026-11-12_7.32am.gpx"/></WorkoutRoute>
 </Workout>`;
// Older layout: distance as attributes, iPhone app (no watch), miles.
const oldRun = ` <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="25" durationUnit="min" totalDistance="2.6" totalDistanceUnit="mi" totalEnergyBurned="250" totalEnergyBurnedUnit="kcal" sourceName="Strava" startDate="2026-11-10 18:00:00 +0100" endDate="2026-11-10 18:25:00 +0100"/>`;
const ride = ` <Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="60" durationUnit="min" totalDistance="20" totalDistanceUnit="km" sourceName="Strava" startDate="2026-11-09 10:00:00 +0100" endDate="2026-11-09 11:00:00 +0100"/>`;
const walk = ` <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="30" durationUnit="min" startDate="2026-11-08 10:00:00 +0100" endDate="2026-11-08 10:30:00 +0100"><WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="2.5" unit="km"/></Workout>`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary|ClinicalRecord|Audiogram|VisionPrescription)*)>
]>
<HealthData locale="de_AT">
 <ExportDate value="2026-11-12 15:00:00 +0100"/>
${records}
${ride}
${newRun}
${walk}
${oldRun}
 <ActivitySummary dateComponents="2026-11-12" activeEnergyBurned="500"/>
</HealthData>`;

test("export dates", () => {
  assert.equal(parseExportDate("2026-11-12 07:00:00 +0100")!.toISOString(), "2026-11-12T06:00:00.000Z");
  assert.equal(parseExportDate("2026-07-12 07:00:00 +0200")!.toISOString(), "2026-07-12T05:00:00.000Z");
});

test("finds runs in both layouts, skips rides and walks", () => {
  const runs = scanExport(xml);
  assert.equal(runs.length, 2);
  const [a, b] = runs;
  assert.deepEqual([a.start, a.durationSec, a.distanceKm, a.avgHr, a.maxHr], ["2026-11-12T06:00:00.000Z", 1925, 5.081, 152, 171]);
  assert.deepEqual([b.start, b.durationSec, b.avgHr], ["2026-11-10T17:00:00.000Z", 1500, null]);
  assert.ok(Math.abs(b.distanceKm - 4.1843) < 0.001);
});

test("works no matter how the stream is cut into chunks", () => {
  for (const size of [1, 7, 64, 333, 4096]) {
    const s = new AppleExportScanner();
    for (let i = 0; i < xml.length; i += size) s.push(xml.slice(i, i + size));
    assert.equal(s.runs.length, 2, `chunk size ${size}`);
    assert.equal(s.workoutsSeen, 4, `chunk size ${size}`);
    assert.equal(s.runs[0].distanceKm, 5.081);
  }
});

test("memory stays small while scanning records", () => {
  const s = new AppleExportScanner();
  s.push(records);
  assert.ok((s as unknown as { buf: string }).buf.length <= 16);
});
