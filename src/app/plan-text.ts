import { fmt, type Dictionary } from "@/lib/i18n";
import type { Phase } from "@/lib/plan";

export function describeRun2(t: Dictionary, run2: Phase["run2"], locked: boolean): string {
  if (!run2) return "–";
  if (run2.kind === "easy") return (locked ? `${t.plan.lockedTempo} ` : "") + fmt(t.plan.minutes, { a: run2.minutes[0], b: run2.minutes[1] });
  return fmt(t.plan.tempo, { reps: run2.reps, min: run2.repMinutes });
}

export function describeEasy(t: Dictionary, range: [number, number] | null): string {
  return range ? fmt(t.plan.minutes, { a: range[0], b: range[1] }) : "–";
}
