"use client";

import { useMemo, useState } from "react";
import { fmt, type Dictionary } from "@/lib/i18n";
import { formatDuration, formatPace, HALF_MARATHON_KM, MARATHON_KM, paceSecPerKm, parseDuration } from "@/lib/pace";
import { currentPhase, run2Prescription, tempoUnlock, weeksToRace, weeklyLanes, type Lane } from "@/lib/plan";
import { describeEasy, describeRun2 } from "../plan-text";

type Goal = "half" | "tenK" | "fiveK" | "marathon" | "fitness";
const KM: Record<Goal, number> = { half: HALF_MARATHON_KM, tenK: 10, fiveK: 5, marathon: MARATHON_KM, fitness: 5 };
const GOALS: Goal[] = ["half", "tenK", "fiveK", "marathon", "fitness"];
const LEVELS = ["new", "easy30", "regular"] as const;
const RUNS = ["2", "3", "4"] as const;

export interface WizardInitial {
  goal: Goal;
  raceName: string;
  raceDate: string;
  target: string;
  experience: (typeof LEVELS)[number] | "";
  runsPerWeek: string;
  strength: "yes" | "no" | "";
}

function inWeeks(weeks: number) {
  const d = new Date(Date.now() + weeks * 7 * 86400_000);
  return d.toISOString().slice(0, 10);
}

function Choice({ name, value, checked, onChange, title, desc }: { name: string; value: string; checked: boolean; onChange: (v: string) => void; title: string; desc: string }) {
  return (
    <label className={`choice${checked ? " on" : ""}`}>
      {/* A click on the already chosen answer fires no change event, but should still move on. */}
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} onClick={() => checked && onChange(value)} />
      <span className="choice-title">{title}</span>
      <span className="choice-desc">{desc}</span>
    </label>
  );
}

export function Wizard({ t, initial, action, skip, error, join }: { t: Dictionary; initial: WizardInitial; action: (fd: FormData) => void; skip: (join?: string) => void; error: string | null; join?: string }) {
  const w = t.welcome;
  const [step, setStep] = useState(0);
  const [v, setV] = useState<WizardInitial>(initial);
  const set = <K extends keyof WizardInitial>(k: K, val: WizardInitial[K]) => setV((x) => ({ ...x, [k]: val }));
  // Single-choice questions move on by themselves: one tap per question.
  const pick = <K extends keyof WizardInitial>(k: K, val: WizardInitial[K]) => {
    set(k, val);
    window.setTimeout(() => setStep((n) => n + 1), 160);
  };
  const today = new Date().toISOString().slice(0, 10);
  const total = 4;

  const valid = [
    !!v.goal && v.raceDate > today && (!v.target || v.goal === "fitness" || !!parseDuration(v.target)),
    !!v.experience,
    !!v.runsPerWeek,
    !!v.strength,
  ];

  const summary = useMemo(() => {
    if (!(v.raceDate > today)) return null;
    const phase = currentPhase(v.raceDate);
    const unlock = tempoUnlock(false, v.experience);
    const sec = v.goal !== "fitness" && v.target ? parseDuration(v.target) : null;
    return { phase, unlock, weeks: weeksToRace(v.raceDate), pace: sec ? paceSecPerKm(sec, KM[v.goal]) : null, sec };
  }, [v, today]);

  const laneText = (lane: Lane) => {
    if (!summary || summary.phase.id === "after" || !("run1" in summary.phase)) return "";
    const p = summary.phase;
    if (lane === "run2") return describeRun2(t, run2Prescription(p, !!summary.unlock), p.run2?.kind === "tempo" && !summary.unlock);
    if (lane === "run3") return describeEasy(t, p.run3);
    return describeEasy(t, p.run1);
  };
  const laneLabel = (lane: Lane) => (lane === "run4" ? t.plan.run4 : lane === "run2" ? t.plan.run2 : lane === "run3" ? t.plan.run3 : t.plan.run1);

  return (
    <form action={action} className="wizard panel">
      {/* All answers are submitted together at the end. */}
      {Object.entries(v).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      {join ? <input type="hidden" name="join" value={join} /> : null}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">{step < total ? fmt(w.step, { i: step + 1, n: total }) : "✓"}</span>
        <button type="button" className="btn ghost small" onClick={() => skip(join)}>{w.skip}</button>
      </div>
      <div className="progress" aria-hidden="true"><span style={{ width: `${(Math.min(step, total) / total) * 100}%` }} /></div>
      {error ? <p className="flash err" role="alert">{t.auth.errInput}</p> : null}

      {step === 0 ? (
        <fieldset className="stack" style={{ gap: 14 }}>
          <legend><h2>{w.goalQ}</h2></legend>
          <div className="choices">
            {GOALS.map((g) => (
              <Choice key={g} name="goal-choice" value={g} checked={v.goal === g} title={w.goals[g].t} desc={w.goals[g].d}
                onChange={(val) => {
                  const goal = val as Goal;
                  setV((x) => ({ ...x, goal, raceDate: x.raceDate || (goal === "fitness" ? inWeeks(12) : ""), raceName: x.raceName || (goal === "fitness" ? w.goals.fitness.t : "") }));
                }} />
            ))}
          </div>
          <h3>{w.raceQ}</h3>
          <div className="fields">
            <div className="field"><label htmlFor="w-name">{w.raceName}</label><input id="w-name" value={v.raceName} maxLength={120} placeholder={v.goal === "fitness" ? "" : "Vienna City Marathon"} onChange={(e) => set("raceName", e.target.value)} /></div>
            <div className="field">
              <label htmlFor="w-date">{v.goal === "fitness" ? w.fitnessDate : w.raceDate}</label>
              <input id="w-date" type="date" min={today} value={v.raceDate} onChange={(e) => set("raceDate", e.target.value)} required />
              {v.goal === "fitness" ? <span className="hint">{w.fitnessHint}</span> : null}
            </div>
            {v.goal !== "fitness" ? (
              <div className="field"><label htmlFor="w-target">{w.target}</label><input id="w-target" inputMode="numeric" placeholder="1:59:59" value={v.target} onChange={(e) => set("target", e.target.value)} /></div>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="stack" style={{ gap: 14 }}>
          <legend><h2>{w.levelQ}</h2></legend>
          <div className="choices">
            {LEVELS.map((l) => <Choice key={l} name="level-choice" value={l} checked={v.experience === l} title={w.levels[l].t} desc={w.levels[l].d} onChange={(val) => pick("experience", val as WizardInitial["experience"])} />)}
          </div>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="stack" style={{ gap: 14 }}>
          <legend><h2>{w.runsQ}</h2></legend>
          <div className="choices">
            {RUNS.map((r) => <Choice key={r} name="runs-choice" value={r} checked={v.runsPerWeek === r} title={w.runs[r].t} desc={w.runs[r].d} onChange={(val) => pick("runsPerWeek", val)} />)}
          </div>
        </fieldset>
      ) : null}

      {step === 3 ? (
        <fieldset className="stack" style={{ gap: 14 }}>
          <legend><h2>{w.strengthQ}</h2></legend>
          <div className="choices">
            {(["yes", "no"] as const).map((s) => <Choice key={s} name="strength-choice" value={s} checked={v.strength === s} title={w.strength[s].t} desc={w.strength[s].d} onChange={(val) => pick("strength", val as WizardInitial["strength"])} />)}
          </div>
        </fieldset>
      ) : null}

      {step === total && summary ? (
        <section className="stack" style={{ gap: 14 }}>
          <h2>{w.summary}</h2>
          <div className="panel track">
            <strong>{v.raceName || w.goals[v.goal].t}</strong>
            <div className="row" style={{ gap: 28 }}>
              <div><div className="num" style={{ fontSize: "2.6rem", lineHeight: 1 }}>{Math.max(0, summary.weeks)}</div><div className="small">{t.dashboard.weeksToGo}</div></div>
              {summary.pace ? <div><div className="num" style={{ fontSize: "2.6rem", lineHeight: 1 }}>{formatPace(summary.pace)}</div><div className="small">{t.dashboard.targetPace} /km · {formatDuration(summary.sec)}</div></div> : null}
              {"run1" in summary.phase ? <div><div className="num" style={{ fontSize: "2.6rem", lineHeight: 1 }}>{t.plan.phases[summary.phase.id]}</div><div className="small">{t.plan.phase}</div></div> : null}
            </div>
          </div>
          {weeklyLanes(Number(v.runsPerWeek)).map((lane) => (
            <div key={lane} className="lane-tile">
              <span className="lane-no">{lane.slice(3)}</span>
              <div><strong>{laneLabel(lane)}</strong><div className="small">{laneText(lane)}</div></div>
            </div>
          ))}
          {summary.unlock === "reported" ? <p className="small muted">{t.plan.unlockReported}</p> : null}
          {v.experience === "new" ? <p className="small muted">{t.plan.r1}</p> : null}
          {v.strength === "yes" ? <p className="small muted">{t.plan.strengthHint}</p> : null}
          <p className="small muted">{t.plan.disclaimer} {w.note}</p>
        </section>
      ) : null}

      <div className="row" style={{ justifyContent: "space-between" }}>
        {step > 0 ? <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>{w.back}</button> : <span />}
        {step < total ? (
          <button key="next" type="button" className="btn signal" disabled={!valid[step]} onClick={() => setStep(step + 1)}>{w.next}</button>
        ) : (
          // Separate element that only submits on its own click, so the last "Next" click can never submit the form.
          <button key="submit" type="button" className="btn signal" onClick={(e) => e.currentTarget.form?.requestSubmit()}>{w.done}</button>
        )}
      </div>
    </form>
  );
}
