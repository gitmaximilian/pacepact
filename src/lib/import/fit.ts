import FitParser from "fit-file-parser";
import { ImportError, type NormalizedRun } from "./types";

/** Garmin/COROS/Wahoo/Suunto FIT activity files. Uses the session summary. */
export async function parseFit(buffer: ArrayBuffer): Promise<NormalizedRun[]> {
  const parser = new FitParser({ force: true, speedUnit: "km/h", lengthUnit: "km", mode: "list" });
  const data: any = await new Promise((resolve, reject) => {
    parser.parse(buffer as any, (err: unknown, result: unknown) => (err ? reject(err) : resolve(result)));
  });
  const sessions: any[] = data?.sessions ?? [];
  if (!sessions.length) throw new ImportError("No session found in FIT file");
  return sessions.map((s) => {
    const start = new Date(s.start_time);
    return {
      startedAt: start,
      durationSec: Number(s.total_timer_time ?? s.total_elapsed_time),
      distanceKm: Number(s.total_distance ?? 0),
      avgHr: s.avg_heart_rate ?? null,
      maxHr: s.max_heart_rate ?? null,
      externalId: `fit:${start.toISOString()}`,
      notes: s.sport && s.sport !== "running" ? `Sport: ${s.sport}` : null,
    };
  });
}
