/**
 * Plausibility checks for runs. Implausible runs stay in the owner's log
 * (they may be a GPS glitch or a mislabelled ride) but never count in groups.
 */

/** Faster than this over a real distance is not a run (the 5 km world record is ~2:31 min/km). */
export const MIN_PACE_SEC_PER_KM = 150;
/** Below this distance pace is too noisy to judge. */
const MIN_JUDGED_KM = 0.5;

export function isPlausibleRun(run: { distanceKm: number; durationSec: number }): boolean {
  if (!(run.durationSec > 0) || !(run.distanceKm >= 0)) return false;
  if (run.distanceKm < MIN_JUDGED_KM) return true;
  return run.durationSec / run.distanceKm >= MIN_PACE_SEC_PER_KM;
}

/** Only same-origin relative paths: "/runs" yes; "//evil", "/\\evil", "https://…" no. */
export function safeLocalPath(path: string, fallback = "/"): string {
  return /^\/(?![/\\])[^\\\s]*$/.test(path) ? path : fallback;
}
