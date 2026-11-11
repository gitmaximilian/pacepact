import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseCsv } from "../src/lib/import/csv.ts";
import { parseActivityFile } from "../src/lib/import/index.ts";
import { sanitize } from "../src/lib/import/types.ts";
import { parseGpx, parseTcx } from "../src/lib/import/xml.ts";

const fixture = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

test("TCX: lap totals and trackpoint heart rate fallback", () => {
  const [r] = parseTcx(fixture("treadmill.tcx"));
  assert.equal(r.durationSec, 909);
  assert.equal(r.distanceKm, 2.0008);
  assert.equal(Math.round(r.avgHr!), 176);
  assert.equal(r.maxHr, 192);
});

test("GPX: distance from coordinates, duration from timestamps, HR from extension", () => {
  const [r] = parseGpx(fixture("run.gpx"));
  assert.equal(r.durationSec, 720);
  assert.ok(Math.abs(r.distanceKm - 2.0) < 0.01, `distance ${r.distanceKm}`);
  assert.equal(r.avgHr, 150);
  assert.equal(r.notes, "Prater loop");
});

test("CSV: German team-sheet export, filtered to one person", () => {
  const csv = [
    "Datum;Name;Run;Distanz;Minuten;Sekunden;Pace;Ø Puls;Anstrengung;Gehpause;Notizen;Wochenstart",
    '05.11.2026;Max;Test;2,0008;15;9;7:34;176;10;Ja;"Laufband, fast am Limit";03.11.2026',
    "06.11.2026;Clemens;Run 1;3,1;22;0;;;4;Nein;;03.11.2026",
  ].join("\n");
  const runs = parseCsv(csv, { onlyName: "Max" });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].durationSec, 909);
  assert.equal(runs[0].distanceKm, 2.0008);
  assert.equal(runs[0].runType, "test");
  assert.equal(runs[0].walkBreaks, true);
  assert.equal(runs[0].notes, "Laufband, fast am Limit");
  assert.equal(runs[0].startedAt.toISOString().slice(0, 10), "2026-11-05");
});

test("CSV: English export with duration column", () => {
  const runs = parseCsv("date,distance_km,duration,avg_hr,type\n2026-11-12,5.2,33:00,158,run1\n");
  assert.equal(runs[0].durationSec, 1980);
  assert.equal(runs[0].runType, "run1");
});

test("unsupported file types are rejected", async () => {
  await assert.rejects(parseActivityFile("x.pdf", new ArrayBuffer(4)), /Unsupported/);
});

test("sanitize drops impossible values", () => {
  assert.equal(sanitize({ startedAt: new Date("x"), distanceKm: 1, durationSec: 60 }), null);
  const r = sanitize({ startedAt: new Date(), distanceKm: 5, durationSec: 1800, avgHr: 400, effort: 11 })!;
  assert.equal(r.avgHr, null);
  assert.equal(r.effort, null);
});
