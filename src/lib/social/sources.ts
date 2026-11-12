/**
 * Where a run came from. Runs reach Pacepact in two ways only:
 * - "apple-health": imported from an Apple Health export (recorded by a watch or phone app): "device";
 * - "manual": typed in by the runner: "manual".
 * Crews see which one it is, and can choose to count device runs only.
 */
export const APPLE_HEALTH = "apple-health";

export function sourceKind(source: string): "device" | "manual" {
  return source === APPLE_HEALTH ? "device" : "manual";
}
