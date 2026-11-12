/**
 * Apple Health export ("Export All Health Data" → export.zip → apple_health_export/export.xml).
 *
 * The file can be several gigabytes, so it is scanned as a stream of text chunks and only
 * running workouts are kept. Runs in the browser (the export never leaves the phone) and in tests.
 *
 * Two layouts exist, depending on the iOS version:
 * - older: <Workout … totalDistance="5.08" totalDistanceUnit="km" …>
 * - newer: distance and heart rate in child elements
 *   <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="5.08" unit="km"/>
 *   <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" average="152" maximum="171" unit="count/min"/>
 */

export interface AppleRun {
  start: string; // ISO 8601
  durationSec: number;
  distanceKm: number;
  avgHr: number | null;
  maxHr: number | null;
}

const RUNNING = "HKWorkoutActivityTypeRunning";
const KM_PER: Record<string, number> = { km: 1, m: 0.001, mi: 1.609344, yd: 0.0009144, ft: 0.0003048 };
const SEC_PER: Record<string, number> = { min: 60, s: 1, sec: 1, h: 3600, hr: 3600 };

/** "2026-11-12 07:00:00 +0100" → Date. */
export function parseExportDate(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*([+-])(\d{2}):?(\d{2})$/.exec(v.trim());
  const d = m ? new Date(`${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) if (!(m[1] in out)) out[m[1]] = m[2];
  return out;
}

const toKm = (value: string | undefined, unit: string | undefined) => {
  const n = Number(value);
  const f = KM_PER[(unit ?? "km").toLowerCase()];
  return Number.isFinite(n) && f ? n * f : null;
};

/** Parses one <Workout …>…</Workout> element; returns null for anything that is not a run. */
export function parseWorkoutElement(xml: string): AppleRun | null {
  const head = /^<Workout\s[^>]*>/.exec(xml)?.[0] ?? xml;
  const a = attrs(head);
  if (a.workoutActivityType !== RUNNING) return null;
  const start = parseExportDate(a.startDate);
  const end = parseExportDate(a.endDate);
  if (!start) return null;
  const dur = Number(a.duration) * (SEC_PER[(a.durationUnit ?? "min").toLowerCase()] ?? 60);
  const durationSec = Number.isFinite(dur) && dur > 0 ? dur : end ? (end.getTime() - start.getTime()) / 1000 : 0;
  if (!(durationSec > 0)) return null;

  let distanceKm = toKm(a.totalDistance, a.totalDistanceUnit);
  let avgHr: number | null = null;
  let maxHr: number | null = null;
  for (const m of xml.matchAll(/<WorkoutStatistics\s[^>]*>/g)) {
    const s = attrs(m[0]);
    if (s.type === "HKQuantityTypeIdentifierDistanceWalkingRunning" && !distanceKm) distanceKm = toKm(s.sum, s.unit);
    if (s.type === "HKQuantityTypeIdentifierHeartRate") {
      avgHr = Number(s.average) > 0 ? Math.round(Number(s.average)) : null;
      maxHr = Number(s.maximum) > 0 ? Math.round(Number(s.maximum)) : null;
    }
  }
  return {
    start: start.toISOString(),
    durationSec: Math.round(durationSec),
    distanceKm: Math.round((distanceKm ?? 0) * 10000) / 10000,
    avgHr,
    maxHr,
  };
}

/**
 * Feed text chunks of export.xml in order; collects running workouts. Memory stays small:
 * everything before the next <Workout is dropped as soon as it has been looked at.
 */
export class AppleExportScanner {
  private buf = "";
  readonly runs: AppleRun[] = [];
  workoutsSeen = 0;

  push(text: string) {
    this.buf += text;
    for (;;) {
      const startRe = /<Workout\s/g;
      const hit = startRe.exec(this.buf);
      if (!hit) {
        // Keep a short tail in case "<Workout" is split across chunks.
        this.buf = this.buf.slice(-16);
        return;
      }
      const from = hit.index;
      const tagEnd = this.buf.indexOf(">", from);
      if (tagEnd < 0) {
        this.buf = this.buf.slice(from);
        return;
      }
      let end: number;
      if (this.buf[tagEnd - 1] === "/") {
        end = tagEnd + 1;
      } else {
        const close = this.buf.indexOf("</Workout>", tagEnd);
        if (close < 0) {
          this.buf = this.buf.slice(from);
          return;
        }
        end = close + "</Workout>".length;
      }
      this.workoutsSeen += 1;
      const run = parseWorkoutElement(this.buf.slice(from, end));
      if (run) this.runs.push(run);
      this.buf = this.buf.slice(end);
    }
  }
}

/** Convenience for tests and small files. */
export function scanExport(xml: string): AppleRun[] {
  const s = new AppleExportScanner();
  s.push(xml);
  return s.runs;
}
