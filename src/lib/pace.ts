/** Pace and time helpers. All durations are in seconds, distances in km. */

export const HALF_MARATHON_KM = 21.0975;
export const MARATHON_KM = 42.195;

/** Seconds per kilometre, rounded to the nearest second. */
export function paceSecPerKm(durationSec: number, distanceKm: number): number | null {
  if (!(distanceKm > 0) || !(durationSec > 0)) return null;
  return Math.round(durationSec / distanceKm);
}

/** "7:34" for 454 seconds. */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return "–";
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "1:59:59" or "15:09". */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec == null || !Number.isFinite(totalSec)) return "–";
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Parses "1:59:59", "59:59", "45" (minutes) into seconds. Returns null on bad input. */
export function parseDuration(input: string): number | null {
  const parts = input.trim().split(":");
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  let sec: number;
  if (nums.length === 1) sec = nums[0] * 60;
  else if (nums.length === 2) sec = nums[0] * 60 + nums[1];
  else sec = nums[0] * 3600 + nums[1] * 60 + nums[2];
  if (nums.length > 1 && nums.slice(1).some((n) => n >= 60)) return null;
  return sec > 0 ? sec : null;
}

/** Formats a distance in km with locale-aware decimals ("2.00" / "2,00"). */
export function formatKm(km: number, locale: string, digits = 2): string {
  return new Intl.NumberFormat(locale === "de" ? "de-AT" : "en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(km);
}

/** Great-circle distance in metres between two lat/lon points. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
