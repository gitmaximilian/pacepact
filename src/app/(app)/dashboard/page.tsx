import { Icon } from "@/app/icons";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { formatPace, paceSecPerKm } from "@/lib/pace";
import { currentPhase, isLighterWeek, isRaceWeek, laneProgress, run2Prescription, tempoUnlock, weekPrescription, weeklyLanes, weeksToRace } from "@/lib/plan";
import { weekKey } from "@/lib/social/weeks";
import { redirect } from "next/navigation";
import { activeGoal, param, userRuns, type SearchParams } from "@/lib/queries";
import { hrTrend, summarize, weekStart, weeklyKm } from "@/lib/stats";
import {Flash, LaneNo} from "@/app/components";
import { describeEasy, describeRun2 } from "@/app/plan-text";

export const metadata = { title: "Me" };

/** "Me": my week against my plan, my recent runs, and the way to plan, import and challenges. */
export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!user.onboardedAt) redirect("/welcome");
  const { t, locale } = await getT();
  const d = t.dashboard;
  const sp = await searchParams;
  const [goal, runs] = await Promise.all([activeGoal(user.id), userRuns(user.id)]);
  const s = summarize(runs);
  const weeks = weeklyKm(runs, 12);
  const maxSec = Math.max(1, ...weeks.map((w) => w.sec));
  const thisWeekSec = weeks[weeks.length - 1]?.sec ?? 0;
  const basePhase = goal ? currentPhase(goal.raceDate) : null;
  const raceWeek = !!goal && isRaceWeek(goal.raceDate, weekKey(new Date()));
  const lighter = !!goal && !raceWeek && isLighterWeek(goal.raceDate);
  // This week's actual prescription: lighter weeks are shorter, in race week the race replaces the long run.
  const phase = basePhase && "run1" in basePhase ? weekPrescription(basePhase, { lighter, raceWeek }) : basePhase;
  const targetPace = goal?.targetSeconds ? paceSecPerKm(goal.targetSeconds, goal.distanceKm) : null;
  const continuousMin = Math.floor(s.longestContinuousSec / 60);
  const unlock = tempoUnlock(s.reached30MinContinuous, user.experience);
  const lanes = weeklyLanes(user.runsPerWeek);
  const since = weekStart(new Date()).getTime();
  const weekRuns = runs.filter((r) => r.startedAt.getTime() >= since);
  const done = laneProgress(lanes, weekRuns.map((r) => r.runType));
  const doneCount = lanes.filter((l) => done[l]).length;
  const dayFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Vienna" });
  const trend = user.hrConsentAt ? hrTrend(runs) : null;
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return (
    <>
      <div className="page-head">
        <h1>{fmt(d.hello, { name: firstName })}</h1>
        <Link href="/settings" className="round-btn" aria-label={t.nav.settings}><Icon name="gear" size={20} /></Link>
      </div>
      <Flash ok={param(sp, "saved") === "goal" ? t.goal.saved : null} />

      <section className="panel track me-week">
        <span className="eyebrow light">{d.thisWeek}</span>
        <div className="row" style={{ gap: 28, alignItems: "flex-end" }}>
          <div>
            <div className="num hero-num">{doneCount}<span className="of">/{lanes.length}</span></div>
            <div className="small">{d.plannedRuns}</div>
          </div>
          <div>
            <div className="num hero-num">{Math.round(thisWeekSec / 60)}</div>
            <div className="small">{d.minutes}</div>
          </div>
        </div>
        {goal ? (
          <p className="small">
            {fmt(d.goalLine, { weeks: Math.max(0, weeksToRace(goal.raceDate)), race: goal.raceName })}
            {targetPace ? ` · ${d.targetPace} ${formatPace(targetPace)} /km` : ""} · <Link href="/goal">{d.change}</Link>
          </p>
        ) : (
          <p className="small"><Link href="/goal">{d.setGoal}</Link></p>
        )}
      </section>

      {phase && phase.id !== "after" && "run1" in phase ? (
        <section className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="h-small">{d.thisPhase} · {t.plan.phases[phase.id]}</h2>
            <Link className="small" href="/plan">{d.fullPlan} →</Link>
          </div>
          {lighter ? <p className="flash ok">{d.lighterWeek}</p> : null}
          {raceWeek ? <p className="flash ok">{t.plan.raceWeek}</p> : null}
          {lanes.map((lane) => (
            <div key={lane} className={`lane-tile${done[lane] ? " done" : ""}`}>
              <LaneNo type={lane} />
              <span>
                {lane === "run2"
                  ? describeRun2(t, run2Prescription(phase, !!unlock), phase.run2?.kind === "tempo" && !unlock)
                  : lane === "run3" && raceWeek
                    ? t.plan.raceInstead
                    : describeEasy(t, lane === "run3" ? phase.run3 : phase.run1)}
              </span>
              {done[lane] ? <span className="tick" role="img" aria-label={d.done}>✓</span> : <span />}
            </div>
          ))}
          {unlock && phase.run2?.kind === "tempo" ? (
            <p className="small muted">{unlock === "measured" ? t.plan.unlockMeasured : t.plan.unlockReported}</p>
          ) : null}
          {user.strength ? <p className="small muted">{t.plan.strengthHint}</p> : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="h-small">{d.recent}</h2>
          <span className="row small" style={{ gap: 14 }}>
            <Link href="/import">{d.importShort}</Link>
            {runs.length ? <Link href="/runs">{d.allRuns} →</Link> : null}
          </span>
        </div>
        {runs.length ? (
          <ul className="run-list">
            {runs.slice(0, 5).map((r) => (
              <li key={r.id}>
                <span className="muted small">{dayFmt.format(r.startedAt)}</span>
                <span className="num">{Math.round(r.durationSec / 60)} {t.common.min}</span>
                <span className="small muted">{[r.runType !== "other" ? t.runTypes[r.runType] : null, r.avgHr ? `Ø ${r.avgHr} ${t.common.bpm}` : null].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{d.noRuns}</p>
        )}
      </section>

      {runs.length ? (
        <section className="panel">
          <h2 className="h-small">{d.weeklyMin}</h2>
          <div className="bars" role="img" aria-label={d.weeklyMin}>
            {weeks.map((w, i) => (
              <div key={w.weekStart.toISOString()} className={i === weeks.length - 1 ? "now" : ""} style={{ height: `${(w.sec / maxSec) * 100}%` }} title={`${Math.round(w.sec / 60)} ${t.common.min}`} />
            ))}
          </div>
        </section>
      ) : null}

      {user.hrConsentAt ? (
        <section className="panel">
          <h2 className="h-small">{d.hrTitle}</h2>
          {trend ? (
            <>
              <p>
                {fmt(d.hrAt, { hr: trend.refHr })}{" "}
                <b className="num big-pace">{formatPace(trend.firstPace)} → {formatPace(trend.lastPace)}</b> /km
              </p>
              <p className={`small ${trend.fasterSec > 0 ? "good" : "muted"}`}>
                {trend.fasterSec > 0 ? fmt(d.hrFaster, { s: trend.fasterSec }) : trend.fasterSec < 0 ? fmt(d.hrSlower, { s: -trend.fasterSec }) : d.hrSame}
              </p>
              <HrChart points={trend.points} label={fmt(d.hrAt, { hr: trend.refHr })} />
              <p className="small muted">{d.hrHint}</p>
            </>
          ) : (
            <p className="small muted">{d.hrEmpty}</p>
          )}
        </section>
      ) : null}

      {!s.reached30MinContinuous ? (
        <section className="panel">
          <h2 className="h-small">{d.milestone30}</h2>
          <span className="small muted">{fmt(d.longestContinuous, { min: continuousMin })}</span>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.min(30, continuousMin)}>
            <span style={{ width: `${Math.min(100, (continuousMin / 30) * 100)}%` }} />
          </div>
        </section>
      ) : null}

      <p className="small"><Link href="/challenges">{t.social.personalTitle} →</Link></p>
    </>
  );
}

/** Pace per matching run, faster = higher. Only the runner sees it. */
function HrChart({ points, label }: { points: { startedAt: Date; pace: number }[]; label: string }) {
  const w = 300, h = 80, pad = 8;
  const paces = points.map((p) => p.pace);
  const lo = Math.min(...paces), hi = Math.max(...paces);
  const t0 = points[0].startedAt.getTime(), t1 = points[points.length - 1].startedAt.getTime();
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (w - 2 * pad);
  const y = (p: number) => pad + ((p - lo) / Math.max(1, hi - lo)) * (h - 2 * pad);
  const xy = points.map((p) => `${x(p.startedAt.getTime()).toFixed(1)},${y(p.pace).toFixed(1)}`);
  return (
    <svg className="hr-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="none">
      <polyline points={xy.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {xy.map((p, i) => {
        const [cx, cy] = p.split(",");
        return <circle key={i} cx={cx} cy={cy} r="3.5" />;
      })}
    </svg>
  );
}
