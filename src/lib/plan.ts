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

const round5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);
const scale = (r: [number, number] | null, f: number): [number, number] | null => (r ? [round5(r[0] * f), round5(r[1] * f)] : null);

/** Whether the race falls into the week starting on `week` (Monday, YYYY-MM-DD). */
export function isRaceWeek(raceDate: string, week: string): boolean {
  const end = new Date(new Date(`${week}T00:00:00Z`).getTime() + 6 * 86400_000).toISOString().slice(0, 10);
  return raceDate >= week && raceDate <= end;
}

/**
 * What a phase looks like in a specific week. Lighter weeks cut the minutes by about a
 * quarter and drop one tempo repetition. In race week the race replaces the long run.
 */
export function weekPrescription(phase: Phase, opts: { lighter: boolean; raceWeek: boolean }): Phase {
  if (opts.raceWeek) {
    return { ...phase, run1: [20, 30], run2: { kind: "easy", minutes: [15, 20] }, run3: null };
  }
  if (!opts.lighter) return phase;
  const run2: Phase["run2"] = !phase.run2
    ? null
    : phase.run2.kind === "tempo"
      ? { ...phase.run2, reps: Math.max(1, phase.run2.reps - 1) }
      : { kind: "easy", minutes: scale(phase.run2.minutes, 0.75)! };
  return { ...phase, run1: scale(phase.run1, 0.75), run2, run3: scale(phase.run3, 0.75) };
}

export interface WeekTarget {
  /** Runs that make the week "done". */
  runs: number;
  /** Planned minutes plus 10 %: more than this never counts in rankings or challenges. */
  capSec: number;
  lighter: boolean;
  taper: boolean;
  raceWeek: boolean;
}

/**
 * The plan's target for one week. Lighter weeks and taper keep the number of runs, so
 * doing the lighter plan counts as "done"; extra volume beyond the plan earns nothing.
 */
export function weekTarget(runsPerWeek: number, raceDate: string | null, week: string): WeekTarget {
  // Pure and called for every runner and week on crew pages: remember recent answers (bounded).
  const key = `${runsPerWeek}|${raceDate}|${week}`;
  const hit = targetCache.get(key);
  if (hit) return hit;
  if (targetCache.size > 20000) targetCache.clear();
  const t = computeWeekTarget(runsPerWeek, raceDate, week);
  targetCache.set(key, t);
  return t;
}

const targetCache = new Map<string, WeekTarget>();

function computeWeekTarget(runsPerWeek: number, raceDate: string | null, week: string): WeekTarget {
  const mid = new Date(new Date(`${week}T00:00:00Z`).getTime() + 3.5 * 86400_000);
  const lanes = weeklyLanes(runsPerWeek);
  let phase: Phase = PHASES[0];
  let lighter = false;
  let raceWeek = false;
  if (raceDate) {
    const p = currentPhase(raceDate, mid);
    if ("run1" in p) phase = p;
    raceWeek = isRaceWeek(raceDate, week);
    lighter = !raceWeek && "run1" in p && isLighterWeek(raceDate, mid);
  }
  const week_ = weekPrescription(phase, { lighter, raceWeek });
  const upper = (lane: Lane) => {
    if (lane === "run3") return week_.run3?.[1] ?? 150; // race week: the race itself
    if (lane === "run2" && week_.run2) {
      return week_.run2.kind === "easy" ? week_.run2.minutes[1] : 20 + week_.run2.reps * week_.run2.repMinutes * 2;
    }
    return week_.run1?.[1] ?? 30;
  };
  const minutes = lanes.reduce((a, l) => a + upper(l), 0);
  return { runs: lanes.length, capSec: Math.round(minutes * 60 * 1.1), lighter, taper: phase.id === "taper", raceWeek };
}

/**
 * Which of this week's planned runs are done. A run logged as "Run 2" ticks Run 2; runs
 * without a matching lane (imports are "other", tests, or a second "Run 1") tick the first
 * open lanes in order, so imported runs count without retyping them.
 */
export function laneProgress(lanes: Lane[], runTypes: string[]): Record<Lane, boolean> {
  const done = Object.fromEntries(lanes.map((l) => [l, false])) as Record<Lane, boolean>;
  const rest: string[] = [];
  for (const rt of runTypes) {
    if ((lanes as string[]).includes(rt) && !done[rt as Lane]) done[rt as Lane] = true;
    else rest.push(rt);
  }
  for (const _ of rest) {
    const open = lanes.find((l) => !done[l]);
    if (!open) break;
    done[open] = true;
  }
  return done;
}
