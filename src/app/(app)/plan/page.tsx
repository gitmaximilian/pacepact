import { BackLink } from "@/app/components";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { currentPhase, PHASES, run2Prescription, tempoUnlock, weeklyLanes } from "@/lib/plan";
import { activeGoal, userRuns } from "@/lib/queries";
import { summarize } from "@/lib/stats";

import { describeEasy, describeRun2 } from "@/app/plan-text";

export const metadata = { title: "Plan" };

function phaseStart(raceDate: string, weeksOut: number) {
  const d = new Date(`${raceDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - weeksOut * 7);
  return d.toISOString().slice(0, 10);
}

export default async function PlanPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [goal, runs] = await Promise.all([activeGoal(user.id), userRuns(user.id)]);
  const unlock = tempoUnlock(summarize(runs).reached30MinContinuous, user.experience);
  const reached = !!unlock;
  const lanes = weeklyLanes(user.runsPerWeek);
  const laneName = { run1: t.plan.run1, run2: t.plan.run2, run3: t.plan.run3, run4: t.plan.run4 };
  const now = goal ? currentPhase(goal.raceDate) : null;
  return (
    <>
      <BackLink href="/dashboard" label={t.nav.dashboard} />
      <h1>{t.plan.title}</h1>
      <p className="muted">{t.plan.intro}</p>
      <p className="row" style={{ gap: 8 }}>
        {lanes.map((l) => <span key={l} className="pill">{laneName[l]}</span>)}
        {lanes.includes("run4") ? <span className="small muted">{t.plan.run4Same}</span> : null}
      </p>
      {user.strength ? <p className="small muted">{t.plan.strengthHint}</p> : null}
      {!goal ? <p className="flash ok">{t.plan.needGoal}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>{t.plan.phase}</th><th>{t.plan.run1}</th><th>{t.plan.run2}</th><th>{t.plan.run3}</th></tr>
          </thead>
          <tbody>
            {PHASES.map((p, i) => {
              const upper = i === 0 ? null : PHASES[i - 1].minWeeksOut - 1;
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{t.plan.phases[p.id]}</strong> {now?.id === p.id ? <span className="pill done">{t.plan.current}</span> : null}
                    <div className="small muted">
                      {upper == null ? `≥ ${p.minWeeksOut}` : `${p.minWeeksOut}–${upper}`} · {t.plan.weeksOut}
                    </div>
                    {goal ? (
                      <div className="small muted">
                        {upper == null ? "…" : phaseStart(goal.raceDate, upper + 1)} → {p.minWeeksOut === 0 ? goal.raceDate : phaseStart(goal.raceDate, p.minWeeksOut)}
                      </div>
                    ) : null}
                  </td>
                  <td>{describeEasy(t, p.run1)}</td>
                  <td>{describeRun2(t, run2Prescription(p, reached), p.run2?.kind === "tempo" && !reached)}</td>
                  <td>{describeEasy(t, p.run3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="panel">
        <h3>{t.plan.rules}</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>{t.plan.r1}</li><li>{t.plan.r2}</li><li>{t.plan.r3}</li><li>{t.plan.r4}</li>
        </ul>
        <p className="small muted">{t.plan.disclaimer}</p>
      </section>
    </>
  );
}
