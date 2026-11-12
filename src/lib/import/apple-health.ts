/**
 * Apple Health workouts as sent by the iOS app "Health Auto Export" (REST API automation,
 * JSON, data type Workouts). Format: https://help.healthyapps.dev/en/health-auto-export/export-format/workouts
 *
 * Body: { "data": { "workouts": [ … ] } }. Version 2 workouts carry id, name, start, end,
 * duration (seconds), distance { qty, units }, avgHeartRate / maxHeartRate { qty } and source.
 * Version 1 has no id and no duration (computed from start and end). Unknown fields are ignored.
 */
import type { NormalizedRun } from "./types";

/** Workout names that are runs ("Running", "Outdoor Run", "Indoor Run", "Trail Running", German "Laufen"). */
const RUN_NAME = /\b(run|running|laufen|lauf)\b/i;
const NOT_RUN = /wheelchair|rollstuhl/i;

const KM_PER: Record<string, number> = { km: 1, m: 0.001, mi: 1.609344, yd: 0.0009144, ft: 0.0003048 };

/** "2024-02-06 07:00:00 -0800" → Date (also accepts ISO strings). */
export function parseHaeDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*([+-])(\d{2}):?(\d{2})$/.exec(v.trim());
  const d = m ? new Date(`${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const qty = (o: unknown): number | null => {
  const n = typeof o === "number" ? o : typeof o === "object" && o && "qty" in o ? Number((o as { qty: unknown }).qty) : NaN;
  return Number.isFinite(n) ? n : null;
};

function distanceKm(d: unknown): number {
  if (!d || typeof d !== "object") return 0;
  const q = qty(d);
  const unit = String((d as { units?: unknown }).units ?? "km").toLowerCase();
  return q != null && KM_PER[unit] ? q * KM_PER[unit] : 0;
}

function heartRate(w: Record<string, unknown>, key: "avg" | "max"): number | null {
  const direct = qty(w[key === "avg" ? "avgHeartRate" : "maxHeartRate"]);
  if (direct != null) return Math.round(direct);
  const nested = qty((w.heartRate as Record<string, unknown> | undefined)?.[key]);
  if (nested != null) return Math.round(nested);
  // Version 1: flat samples [{ qty }]
  const samples = Array.isArray(w.heartRateData) ? (w.heartRateData as { qty?: unknown }[]).map((s) => Number(s.qty)).filter(Number.isFinite) : [];
  if (!samples.length) return null;
  return Math.round(key === "avg" ? samples.reduce((a, b) => a + b, 0) / samples.length : Math.max(...samples));
}

export function mapHaeWorkout(w: Record<string, unknown>): NormalizedRun | null {
  const name = String(w.name ?? "");
  if (!RUN_NAME.test(name) || NOT_RUN.test(name)) return null;
  const start = parseHaeDate(w.start);
  const end = parseHaeDate(w.end);
  if (!start) return null;
  const duration = Number(w.duration) > 0 ? Number(w.duration) : end ? (end.getTime() - start.getTime()) / 1000 : 0;
  if (!(duration > 0)) return null;
  return {
    startedAt: start,
    distanceKm: Math.round(distanceKm(w.distance) * 10000) / 10000,
    durationSec: Math.round(duration),
    avgHr: heartRate(w, "avg"),
    maxHr: heartRate(w, "max"),
    walkKnown: false,
    externalId: typeof w.id === "string" && w.id ? w.id : start.toISOString(),
  };
}

/** All runs in a Health Auto Export body; other workouts are skipped. */
export function parseHaeBody(body: unknown): NormalizedRun[] {
  const data = (body as { data?: { workouts?: unknown } } | null)?.data;
  const list = Array.isArray(data?.workouts) ? (data.workouts as Record<string, unknown>[]) : [];
  return list.slice(0, 1000).map(mapHaeWorkout).filter((r): r is NormalizedRun => !!r);
}
