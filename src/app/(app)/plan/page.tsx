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
  const now = goal ? currentPhase(goal.raceDate) : null;
  const dayFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const day = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));
  return (
    <>
      <BackLink href="/dashboard" label={t.nav.dashboard} />
      <h1>{t.plan.title}</h1>
      <p className="muted">{t.plan.intro}</p>
      {lanes.includes("run4") ? <p className="small muted">{t.plan.run4Same}</p> : null}
      {user.strength ? <p className="small muted">{t.plan.strengthHint}</p> : null}
      {!goal ? <p className="flash ok">{t.plan.needGoal}</p> : null}
      {PHASES.map((p, i) => {
        const upper = i === 0 ? null : PHASES[i - 1].minWeeksOut - 1;
        const isNow = now?.id === p.id;
        const from = goal && upper != null ? phaseStart(goal.raceDate, upper + 1) : null;
        const to = goal ? (p.minWeeksOut === 0 ? goal.raceDate : phaseStart(goal.raceDate, p.minWeeksOut)) : null;
        return (
          <section key={p.id} className={`panel phase${isNow ? " now" : ""}`}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 className="h-small">{t.plan.phases[p.id]} {isNow ? <span className="pill done">{t.plan.current}</span> : null}</h2>
              <span className="small muted">
                {to ? (from ? `${day(from)} – ${day(to)}` : `→ ${day(to)}`) : `${upper == null ? `≥ ${p.minWeeksOut}` : `${p.minWeeksOut}–${upper}`} ${t.plan.weeksOut}`}
              </span>
            </div>
            <ul className="phase-runs">
              <li data-n="1"><span>{describeEasy(t, p.run1)}</span></li>
              {lanes.includes("run2") ? <li data-n="2"><span>{describeRun2(t, run2Prescription(p, reached), p.run2?.kind === "tempo" && !reached)}</span></li> : null}
              <li data-n="3"><span>{describeEasy(t, p.run3)}</span></li>
            </ul>
          </section>
        );
      })}
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
