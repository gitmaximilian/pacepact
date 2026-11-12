/**
 * One run sent by the Pacepact Apple Shortcut (automation "Apple Watch workout ends").
 * Shortcuts serialise values in many ways depending on language and iOS version, so every
 * field is parsed leniently: numbers or text with units ("5,08 km", "3.1 mi", "32 min 5 s",
 * "0:32:05", "1925"), and ISO or common date formats.
 *
 * Body: { start, end?, duration?, distance?, type?, avgHr?, maxHr? }
 */
import type { NormalizedRun } from "./types";

const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

/** Seconds from 1925, "1925 s", "32 min 5 s", "32:05", "0:32:05", "32,1 min", "1 h 5 min", "PT32M5S". */
export function looseDuration(v: unknown): number | null {
  if (typeof v === "number") return v > 0 ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().toLowerCase();
  const iso = /^pt(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(s);
  if (iso) return Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0) || null;
  const clock = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (clock) return clock[3] != null ? +clock[1] * 3600 + +clock[2] * 60 + +clock[3] : +clock[1] * 60 + +clock[2];
  let total = 0;
  let matched = false;
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(h|std|hr|hrs|hours?|stunden?|min|mins|minutes?|minuten?|m|s|sec|secs|seconds?|sek|sekunden?)\b/g)) {
    const n = num(m[1]);
    const u = m[2];
    total += /^(h|std|hr|hrs|hour|hours|stunde|stunden)$/.test(u) ? n * 3600 : /^(s|sec|secs|second|seconds|sek|sekunde|sekunden)$/.test(u) ? n : n * 60;
    matched = true;
  }
  if (matched) return total > 0 ? total : null;
  const plain = num(s);
  return Number.isFinite(plain) && plain > 0 ? plain : null;
}

const KM_PER: Record<string, number> = { km: 1, m: 0.001, mi: 1.609344, meile: 1.609344, meilen: 1.609344, miles: 1.609344, mile: 1.609344, yd: 0.0009144, ft: 0.0003048 };

/** Kilometres from 5.08, "5,08 km", "5080 m", "3.1 mi". A bare number is km (or metres if above 400). */
export function looseDistanceKm(v: unknown): number {
  if (typeof v === "number") return v > 400 ? v / 1000 : Math.max(0, v);
  if (typeof v !== "string") return 0;
  const m = /(\d+(?:[.,]\d+)?)\s*([a-zA-Z]*)/.exec(v.replace(/(\d)[\s.](\d{3})(?!\d)/g, "$1$2"));
  if (!m) return 0;
  const n = num(m[1]);
  const unit = m[2].toLowerCase();
  if (KM_PER[unit]) return n * KM_PER[unit];
  return n > 400 ? n / 1000 : n;
}

/** ISO 8601 ("2026-11-12T14:33:00+01:00"), "2026-11-12 14:33:00 +0100", or "12.11.2026, 14:33" (taken as Vienna time). */
export function looseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  const hae = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*([+-]\d{2}):?(\d{2})$/.exec(s);
  if (hae) return new Date(`${hae[1]}T${hae[2].length === 5 ? `${hae[2]}:00` : hae[2]}${hae[3]}:${hae[4]}`);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s+(?:um\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (de) {
    const [, dd, mm, yyyy, hh, mi, ss] = de;
    return viennaLocal(+yyyy, +mm, +dd, +hh, +mi, +(ss ?? 0));
  }
  return null;
}

/** A wall-clock time in Vienna as an absolute Date (handles summer time). */
function viennaLocal(y: number, mo: number, d: number, h: number, mi: number, s: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vienna", hour: "2-digit", hourCycle: "h23", minute: "2-digit" }).formatToParts(new Date(guess));
  const vh = Number(parts.find((p) => p.type === "hour")?.value);
  const offsetH = ((vh - h + 36) % 24) - 12;
  return new Date(guess - offsetH * 3600_000);
}

const RUN = /run|lauf|laufen|running/i;

export function parseShortcutRun(body: unknown): NormalizedRun | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.type === "string" && b.type.trim() && !RUN.test(b.type)) return null;
  const start = looseDate(b.start);
  if (!start) return null;
  const end = looseDate(b.end);
  const duration = looseDuration(b.duration) ?? (end ? (end.getTime() - start.getTime()) / 1000 : null);
  if (!duration || duration <= 0) return null;
  const hr = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? num(v.replace(/[^\d.,]/g, "")) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  return {
    startedAt: start,
    distanceKm: Math.round(looseDistanceKm(b.distance) * 10000) / 10000,
    durationSec: Math.round(duration),
    avgHr: hr(b.avgHr),
    maxHr: hr(b.maxHr),
    walkKnown: false,
    externalId: `shortcut:${start.toISOString().slice(0, 16)}`,
  };
}
