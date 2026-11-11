import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { formatDuration, formatKm, formatPace, paceSecPerKm } from "@/lib/pace";
import { currentPhase, isLighterWeek, run2Prescription, weeksToRace } from "@/lib/plan";
import { activeGoal, param, userRuns, type SearchParams } from "@/lib/queries";
import { summarize, weeklyKm } from "@/lib/stats";
import { Flash, LaneNo, Shell, Stat } from "../components";
import { describeEasy, describeRun2 } from "../plan-text";

export const metadata = { title: "Today" };

export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const [goal, runs] = await Promise.all([activeGoal(user.id), userRuns(user.id)]);
  const s = summarize(runs);
  const weeks = weeklyKm(runs, 12);
  const maxWeek = Math.max(1, ...weeks.map((w) => w.km));
  const phase = goal ? currentPhase(goal.raceDate) : null;
  const targetPace = goal?.targetSeconds ? paceSecPerKm(goal.targetSeconds, goal.distanceKm) : null;
  const continuousMin = Math.floor(s.longestContinuousSec / 60);

  return (
    <Shell t={t} locale={locale} active="/dashboard">
      <h1>{fmt(t.dashboard.hello, { name: user.name })}</h1>
      <Flash ok={param(sp, "saved") === "goal" ? t.goal.saved : null} />

      {goal ? (
        <section className="panel track">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>{goal.raceName}</h2>
            <Link href="/goal" className="btn ghost small">{t.goal.title}</Link>
          </div>
          <div className="row" style={{ gap: 32 }}>
            <div><div className="num" style={{ fontSize: "3.4rem", lineHeight: 1 }}>{Math.max(0, weeksToRace(goal.raceDate))}</div><div className="small">{t.dashboard.weeksToGo}</div></div>
            <div><div className="num" style={{ fontSize: "3.4rem", lineHeight: 1 }}>{formatKm(goal.distanceKm, locale, goal.distanceKm % 1 ? 1 : 0)}</div><div className="small">km · {goal.raceDate}</div></div>
            {goal.targetSeconds ? (
              <div><div className="num" style={{ fontSize: "3.4rem", lineHeight: 1 }}>{formatPace(targetPace)}</div><div className="small">{t.dashboard.targetPace} /km · {formatDuration(goal.targetSeconds)}</div></div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="panel">
          <p>{t.dashboard.noGoal}</p>
          <div><Link className="btn signal" href="/goal">{t.dashboard.setGoal}</Link></div>
        </section>
      )}

      <div className="grid">
        <Stat label={t.dashboard.thisWeek} value={formatKm(s.weekKm, locale, 1)} unit={`km · ${s.weekRuns} ${t.dashboard.runs}`} />
        <Stat label={t.dashboard.last28} value={formatKm(s.last28Km, locale, 1)} unit={`km · ${s.last28Runs} ${t.dashboard.runs}`} />
        <Stat label={t.dashboard.longest} value={s.longest ? formatKm(s.longest.distanceKm, locale) : "–"} unit="km" />
        <Stat label={t.dashboard.latest} value={s.latest ? formatPace(paceSecPerKm(s.latest.durationSec, s.latest.distanceKm)) : "–"} unit="/km" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <section className="panel">
          <h3>{t.dashboard.milestone30}</h3>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className={`pill${s.reached30MinContinuous ? " done" : ""}`}>{s.reached30MinContinuous ? t.dashboard.reached : t.dashboard.open}</span>
            <span className="small muted">{fmt(t.dashboard.longestContinuous, { min: continuousMin })}</span>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.min(30, continuousMin)}>
            <span style={{ width: `${Math.min(100, (continuousMin / 30) * 100)}%` }} />
          </div>
        </section>
        <section className="panel">
          <h3>{t.dashboard.weeklyKm}</h3>
          <div className="bars" aria-hidden="true">
            {weeks.map((w, i) => (
              <div key={w.weekStart.toISOString()} className={i === weeks.length - 1 ? "now" : ""} style={{ height: `${(w.km / maxWeek) * 100}%` }} title={`${formatKm(w.km, locale, 1)} km`} />
            ))}
          </div>
        </section>
      </div>

      {phase && phase.id !== "after" && "run1" in phase ? (
        <section className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>{t.dashboard.thisPhase} · {t.plan.phases[phase.id]}</h3>
            <Link className="small" href="/plan">{t.nav.plan} →</Link>
          </div>
          {isLighterWeek(goal!.raceDate) ? <p className="flash ok">{t.dashboard.lighterWeek}</p> : null}
          <div className="lane-tile"><LaneNo type="run1" /><span>{describeEasy(t, phase.run1)}</span></div>
          <div className="lane-tile"><LaneNo type="run2" /><span>{describeRun2(t, run2Prescription(phase, s.reached30MinContinuous), phase.run2?.kind === "tempo" && !s.reached30MinContinuous)}</span></div>
          <div className="lane-tile"><LaneNo type="run3" /><span>{describeEasy(t, phase.run3)}</span></div>
        </section>
      ) : null}

      {runs.length === 0 ? (
        <section className="panel">
          <p>{t.dashboard.noRuns}</p>
          <div className="row">
            <Link className="btn" href="/runs/new">{t.dashboard.logRun}</Link>
            <Link className="btn ghost" href="/connections">{t.dashboard.connect}</Link>
          </div>
        </section>
      ) : (
        <div className="row"><Link className="btn signal" href="/runs/new">{t.dashboard.logRun}</Link></div>
      )}
    </Shell>
  );
}
