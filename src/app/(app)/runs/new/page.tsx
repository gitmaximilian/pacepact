import { hrVisibleToCrew } from "@/lib/hr";
import Link from "next/link";
import { RUN_TYPES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { laneProgress, weeklyLanes } from "@/lib/plan";
import { param, userRuns, type SearchParams } from "@/lib/queries";
import { weekStart } from "@/lib/stats";
import { addRun } from "@/app/actions";
import { TzField } from "@/app/(app)/runs/new/tz-field";
import { HrField } from "@/app/(app)/runs/new/hr-field";
import { DatePick } from "@/app/(app)/runs/new/date-pick";
import {Flash} from "@/app/components";

export const metadata = { title: "Log a run" };

/** Two required fields (minutes and km); the run type is preselected; everything else is optional. */
export default async function NewRunPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const error = param(sp, "error");
  const back = param(sp, "back") ?? "";
  // Preselect the first planned run that is still open this week (Run 4 is logged as Run 1).
  const since = weekStart(new Date()).getTime();
  const lanes = weeklyLanes(user.runsPerWeek);
  const done = laneProgress(lanes, (await userRuns(user.id)).filter((r) => r.startedAt.getTime() >= since).map((r) => r.runType));
  const open = lanes.find((l) => !done[l]);
  const preset = open === "run4" ? "run1" : (open ?? "run1");
  const types = RUN_TYPES.filter((rt) => rt !== "run2" || lanes.includes("run2"));
  return (
    <>
      <h1>{t.runs.add}</h1>
      <Flash err={error === "pace" ? t.runs.errPace : error ? t.runs.errInput : null} />
      <p className="small import-hint">
        {t.runs.importHint} <Link href="/import">{t.dashboard.importApple} →</Link>
      </p>
      <form action={addRun} className="panel form log-form">
        <TzField />
        {back.startsWith("/groups/") ? <input type="hidden" name="back" value={back} /> : null}
        <div className="fields two">
          <div className="field">
            <label htmlFor="duration">{t.runs.minutesLabel}</label>
            <input id="duration" name="duration" inputMode="numeric" placeholder="45" autoComplete="off" required className="big-input" />
            <span className="hint">{t.runs.durationHint}</span>
          </div>
          <div className="field">
            <label htmlFor="distanceKm">{t.runs.distance}</label>
            <input id="distanceKm" name="distanceKm" inputMode="decimal" placeholder="6.5" autoComplete="off" required className="big-input" />
          </div>
        </div>
        <HrField
          consented={!!user.hrConsentAt}
          shared={hrVisibleToCrew(user.hrConsentAt)}
          labels={{ avgHr: t.runs.avgHr, optional: t.runs.bpmOptional, private: t.runs.hrPrivate, privateOnly: t.runs.hrOnlyYou, consentTitle: t.runs.hrConsentTitle, consentText: t.settings.hrGrantText }}
        />
        <fieldset className="field type-pick">
          <legend>{t.runs.type}</legend>
          <div className="seg">
            {types.map((rt) => (
              <label key={rt}>
                <input type="radio" name="runType" value={rt} defaultChecked={rt === preset} />
                <span>{t.runTypes[rt]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <DatePick labels={{ date: t.runs.date, today: t.runs.today, yesterday: t.runs.yesterday, twoDays: t.runs.twoDays, other: t.runs.otherDate }} />
        <details className="more">
          <summary>{t.runs.more}</summary>
          <div className="form" style={{ marginTop: 12 }}>
            <div className="fields">
              <div className="field"><label htmlFor="time">{t.runs.time}</label><input id="time" name="time" type="time" /></div>
              <div className="field"><label htmlFor="effort">{t.runs.effort}</label><input id="effort" name="effort" type="number" min={1} max={10} inputMode="numeric" /></div>
              {user.hrConsentAt ? (
                <div className="field"><label htmlFor="maxHr">{t.runs.maxHr}</label><input id="maxHr" name="maxHr" type="number" min={25} max={250} inputMode="numeric" /></div>
              ) : null}
            </div>
            <label className="check"><input type="checkbox" name="walkBreaks" /> {t.runs.walkBreaks}</label>
            <div className="field"><label htmlFor="notes">{t.runs.notes}</label><textarea id="notes" name="notes" maxLength={1000} /></div>
          </div>
        </details>
        <button className="btn signal block">{t.runs.save}</button>
      </form>
    </>
  );
}
