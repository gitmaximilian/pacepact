import { XMLParser } from "fast-xml-parser";
import { haversineMeters } from "../pace";
import { ImportError, type NormalizedRun } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: true,
  processEntities: false,
});

const arr = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** GPX 1.1 tracks, with heart rate from Garmin TrackPointExtension when present. */
export function parseGpx(xml: string): NormalizedRun[] {
  const doc = parser.parse(xml);
  if (!doc?.gpx) throw new ImportError("Not a GPX file");
  const out: NormalizedRun[] = [];
  for (const trk of arr<any>(doc.gpx.trk)) {
    const points = arr<any>(trk.trkseg).flatMap((seg) => arr<any>(seg.trkpt));
    const timed = points
      .map((p) => ({
        lat: num(p["@lat"]),
        lon: num(p["@lon"]),
        time: p.time ? new Date(String(p.time)) : null,
        hr: num(p.extensions?.TrackPointExtension?.hr ?? p.extensions?.hr),
      }))
      .filter((p) => p.lat != null && p.lon != null);
    if (timed.length < 2) continue;
    let meters = 0;
    for (let i = 1; i < timed.length; i++) {
      meters += haversineMeters(timed[i - 1].lat!, timed[i - 1].lon!, timed[i].lat!, timed[i].lon!);
    }
    const times = timed.map((p) => p.time).filter((t): t is Date => !!t && !Number.isNaN(t.getTime()));
    if (times.length < 2) continue;
    const hrs = timed.map((p) => p.hr).filter((h): h is number => h != null);
    out.push({
      startedAt: times[0],
      durationSec: (times[times.length - 1].getTime() - times[0].getTime()) / 1000,
      distanceKm: meters / 1000,
      avgHr: avg(hrs),
      maxHr: hrs.length ? Math.max(...hrs) : null,
      externalId: `gpx:${times[0].toISOString()}`,
      notes: trk.name ? String(trk.name) : null,
    });
  }
  if (!out.length) throw new ImportError("No timed track found in GPX");
  return out;
}

/**
 * TCX (Garmin Training Center). Uses lap totals; falls back to trackpoint
 * heart rate when laps carry no average (common on treadmill exports).
 */
export function parseTcx(xml: string): NormalizedRun[] {
  const doc = parser.parse(xml);
  const activities = arr<any>(doc?.TrainingCenterDatabase?.Activities?.Activity);
  if (!activities.length) throw new ImportError("No activity found in TCX");
  const out: NormalizedRun[] = [];
  for (const act of activities) {
    const laps = arr<any>(act.Lap);
    if (!laps.length) continue;
    const start = new Date(String(act.Id ?? laps[0]["@StartTime"]));
    let sec = 0;
    let meters = 0;
    let hrWeighted = 0;
    let hrSec = 0;
    let maxHr: number | null = null;
    const pointHr: number[] = [];
    let lastPointMeters: number | null = null;
    for (const lap of laps) {
      const lapSec = num(lap.TotalTimeSeconds) ?? 0;
      sec += lapSec;
      meters += num(lap.DistanceMeters) ?? 0;
      const lapAvg = num(lap.AverageHeartRateBpm?.Value);
      if (lapAvg != null && lapSec > 0) {
        hrWeighted += lapAvg * lapSec;
        hrSec += lapSec;
      }
      const lapMax = num(lap.MaximumHeartRateBpm?.Value);
      if (lapMax != null) maxHr = Math.max(maxHr ?? 0, lapMax);
      for (const tp of arr<any>(lap.Track).flatMap((t) => arr<any>(t.Trackpoint))) {
        const h = num(tp.HeartRateBpm?.Value);
        if (h != null) pointHr.push(h);
        const d = num(tp.DistanceMeters);
        if (d != null) lastPointMeters = Math.max(lastPointMeters ?? 0, d);
      }
    }
    if (meters === 0 && lastPointMeters) meters = lastPointMeters;
    const avgHr = hrSec > 0 ? hrWeighted / hrSec : avg(pointHr);
    if (maxHr == null && pointHr.length) maxHr = Math.max(...pointHr);
    out.push({
      startedAt: start,
      durationSec: sec,
      distanceKm: meters / 1000,
      avgHr,
      maxHr,
      externalId: `tcx:${start.toISOString()}`,
    });
  }
  if (!out.length) throw new ImportError("No laps found in TCX");
  return out;
}
