/**
 * Which runs may be shown to and counted in groups, and how trustworthy they are.
 *
 * - Strava (API): Strava's API agreement only allows showing a user's Strava data to that
 *   user, so these runs never reach groups, not even as totals.
 * - Device files (GPX, TCX, FIT) and Apple Health workouts come from a watch or phone: "device".
 * - Everything else (manual entry, CSV, personal API) is self-reported: "manual".
 */

export const PROVIDER_SOURCES = ["strava"] as const;
export const APPLE_HEALTH = "apple-health";
const DEVICE_SOURCES = ["gpx", "tcx", "fit", APPLE_HEALTH];

export function countsInGroups(source: string): boolean {
  return !(PROVIDER_SOURCES as readonly string[]).includes(source);
}

export function sourceKind(source: string): "device" | "manual" {
  return DEVICE_SOURCES.includes(source) || (PROVIDER_SOURCES as readonly string[]).includes(source) ? "device" : "manual";
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
