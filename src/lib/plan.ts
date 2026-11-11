/**
 * The simple, repeating plan: Run 1 (easy), Run 2 (easy, later tempo) and
 * Run 3 (long run). No fixed weekdays. Phases are counted back from race day
 * so the same template works for any race date.
 */

export type PhaseId = "base" | "build1" | "build2" | "peak" | "taper" | "after";

export interface Phase {
  id: PhaseId;
  /** Applies while weeksToRace is greater than or equal to this value. */
  minWeeksOut: number;
  run1: [number, number] | null; // minutes
  run2: { kind: "easy"; minutes: [number, number] } | { kind: "tempo"; reps: number; repMinutes: number } | null;
  run3: [number, number] | null; // minutes
}

export const PHASES: Phase[] = [
  { id: "base", minWeeksOut: 16, run1: [20, 30], run2: { kind: "easy", minutes: [20, 30] }, run3: [20, 40] },
  { id: "build1", minWeeksOut: 12, run1: [30, 40], run2: { kind: "tempo", reps: 3, repMinutes: 5 }, run3: [45, 70] },
  { id: "build2", minWeeksOut: 8, run1: [35, 45], run2: { kind: "tempo", reps: 3, repMinutes: 5 }, run3: [70, 95] },
  { id: "peak", minWeeksOut: 3, run1: [40, 45], run2: { kind: "tempo", reps: 3, repMinutes: 8 }, run3: [90, 120] },
  { id: "taper", minWeeksOut: 0, run1: [20, 30], run2: { kind: "tempo", reps: 2, repMinutes: 5 }, run3: [40, 60] },
];

export function weeksToRace(raceDate: string, now = new Date()): number {
  const race = new Date(`${raceDate}T00:00:00Z`).getTime();
  return Math.floor((race - now.getTime()) / (7 * 86400_000));
}

export function currentPhase(raceDate: string, now = new Date()): Phase | { id: "after" } {
  const w = weeksToRace(raceDate, now);
  const race = new Date(`${raceDate}T23:59:59Z`).getTime();
  if (now.getTime() > race) return { id: "after" };
  return PHASES.find((p) => w >= p.minWeeksOut) ?? PHASES[PHASES.length - 1];
}

/**
 * Tempo work in Run 2 is only unlocked once the runner can do 30 easy minutes
 * without walking. The calendar alone never unlocks it.
 */
export function run2Prescription(phase: Phase, reached30MinContinuous: boolean): Phase["run2"] {
  if (!phase.run2) return null;
  if (phase.run2.kind === "tempo" && !reached30MinContinuous) {
    return { kind: "easy", minutes: phase.run1 ?? [20, 30] };
  }
  return phase.run2;
}

/** Every fourth week of the build is a lighter week. */
export function isLighterWeek(raceDate: string, now = new Date()): boolean {
  const w = weeksToRace(raceDate, now);
  return w > 2 && w % 4 === 0;
}

export type Lane = "run1" | "run2" | "run3" | "run4";

/**
 * Which runs make up a week. Three is the default (Run 1, 2, 3). Two drops the
 * tempo run; four adds a second easy run (Run 4) – the long run stays last.
 */
export function weeklyLanes(runsPerWeek: number): Lane[] {
  if (runsPerWeek <= 2) return ["run1", "run3"];
  if (runsPerWeek >= 4) return ["run1", "run2", "run4", "run3"];
  return ["run1", "run2", "run3"];
}

/**
 * Whether tempo work may start. A measured 30-minute run without walk breaks
 * counts first; otherwise the runner's own statement from the welcome flow.
 */
export function tempoUnlock(measured30: boolean, experience: string | null | undefined): "measured" | "reported" | null {
  if (measured30) return "measured";
  if (experience === "easy30" || experience === "regular") return "reported";
  return null;
}
