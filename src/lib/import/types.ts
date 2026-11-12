import type { RunType } from "@/db/schema";

/** A run as produced by any importer or provider, before it is stored. */
export interface NormalizedRun {
  startedAt: Date;
  distanceKm: number;
  durationSec: number;
  avgHr?: number | null;
  maxHr?: number | null;
  effort?: number | null;
  walkBreaks?: boolean;
  /** Whether walkBreaks was stated explicitly. Defaults by source (manual and CSV yes, files and providers no). */
  walkKnown?: boolean;
  runType?: RunType;
  notes?: string | null;
  externalId?: string | null;
}

export class ImportError extends Error {}

/** Drops obviously broken values instead of storing them. */
export function sanitize(run: NormalizedRun): NormalizedRun | null {
  if (!(run.startedAt instanceof Date) || Number.isNaN(run.startedAt.getTime())) return null;
  if (!(run.durationSec > 0) || run.durationSec > 48 * 3600) return null;
  if (!(run.distanceKm >= 0) || run.distanceKm > 400) return null;
  const hr = (v: number | null | undefined) => (v != null && v >= 25 && v <= 250 ? Math.round(v) : null);
  const effort = run.effort != null && run.effort >= 1 && run.effort <= 10 ? Math.round(run.effort) : null;
  return {
    ...run,
    distanceKm: Math.round(run.distanceKm * 10000) / 10000,
    durationSec: Math.round(run.durationSec),
    avgHr: hr(run.avgHr),
    maxHr: hr(run.maxHr),
    effort,
  };
}
