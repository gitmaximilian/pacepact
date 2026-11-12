/**
 * Which runs may be shown to and counted in groups, and how trustworthy they are.
 *
 * - Provider APIs (Strava and others): Strava's API agreement only allows showing a
 *   user's Strava data to that user, so these runs never reach groups, not even as totals.
 *   The other providers' terms are not checked yet (docs/legal/drittanbieter.md), so they
 *   are excluded as well until they are.
 * - Device files (GPX, TCX, FIT) come from a watch or app export: "device".
 * - Everything else (manual entry, CSV, personal API) is self-reported: "manual".
 */

export const PROVIDER_SOURCES = ["strava", "garmin", "polar", "fitbit", "wahoo", "suunto", "coros"] as const;
const DEVICE_FILE_SOURCES = ["gpx", "tcx", "fit"];

export function countsInGroups(source: string): boolean {
  return !(PROVIDER_SOURCES as readonly string[]).includes(source);
}

export function sourceKind(source: string): "device" | "manual" {
  return DEVICE_FILE_SOURCES.includes(source) || (PROVIDER_SOURCES as readonly string[]).includes(source) ? "device" : "manual";
}

/**
 * Source label for runs sent through the personal API. Callers may name their tool
 * ("apple-health"), but can never pose as a device file or a provider.
 */
export function ingestSource(requested: string | undefined): string {
  const s = (requested ?? "").toLowerCase();
  if (!s || s === "api") return "api";
  return s.startsWith("api-") ? s : `api-${s}`;
}
