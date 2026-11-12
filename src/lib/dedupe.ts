/**
 * The same run can arrive twice: typed in by hand and later imported from Apple Health,
 * or imported twice from overlapping exports. Runs from different sources starting within
 * 5 minutes with durations within 15 % are treated as one run.
 *
 * Which copy wins: the recorded one (Apple Health) beats a manual entry. The manual entry's
 * effort, notes, run type and walk breaks are carried over, so nothing the runner typed is lost.
 */
import { sourceKind } from "./social/sources";

export interface StoredLike {
  id: string;
  source: string;
  startedAt: Date;
  durationSec: number;
  effort: number | null;
  notes: string | null;
  runType: string;
  walkBreaks: boolean;
  walkKnown: boolean;
}

const WINDOW_MS = 5 * 60_000;

export function sameRun(a: { startedAt: Date; durationSec: number }, b: { startedAt: Date; durationSec: number }): boolean {
  if (Math.abs(a.startedAt.getTime() - b.startedAt.getTime()) > WINDOW_MS) return false;
  const ratio = Math.min(a.durationSec, b.durationSec) / Math.max(a.durationSec, b.durationSec);
  return ratio >= 0.85;
}

const rankOf = (source: string) => (sourceKind(source) === "device" ? 1 : 0);

export type Resolution = { action: "insert" } | { action: "skip" } | { action: "replace"; replace: StoredLike };

export function resolveDuplicate(incoming: { source: string; startedAt: Date; durationSec: number }, existing: StoredLike[]): Resolution {
  const twin = existing.find((e) => e.source !== incoming.source && sameRun(e, incoming));
  if (!twin) return { action: "insert" };
  return rankOf(incoming.source) > rankOf(twin.source) ? { action: "replace", replace: twin } : { action: "skip" };
}
