import { RUN_TYPES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { param, type SearchParams } from "@/lib/queries";
import { addRun } from "../../actions";
import { Flash, Shell } from "../../components";

export const metadata = { title: "Log a run" };

export default async function NewRunPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { t, locale } = await getT();
  const error = param(await searchParams, "error");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Shell t={t} locale={locale} active="/runs">
      <h1>{t.runs.add}</h1>
      <Flash err={error ? t.runs.errInput : null} />
      <form action={addRun} className="panel form">
        <div className="fields">
          <div className="field"><label htmlFor="date">{t.runs.date}</label><input id="date" name="date" type="date" defaultValue={today} max={today} required /></div>
          <div className="field"><label htmlFor="time">{t.runs.time}</label><input id="time" name="time" type="time" /></div>
          <div className="field">
            <label htmlFor="runType">{t.runs.type}</label>
            <select id="runType" name="runType" defaultValue="run1">
              {RUN_TYPES.map((rt) => <option key={rt} value={rt}>{t.runTypes[rt]}</option>)}
            </select>
          </div>
        </div>
        <div className="fields">
          <div className="field"><label htmlFor="distanceKm">{t.runs.distance}</label><input id="distanceKm" name="distanceKm" inputMode="decimal" placeholder="5.0" required /></div>
          <div className="field"><label htmlFor="duration">{t.runs.duration}</label><input id="duration" name="duration" inputMode="numeric" placeholder="32:30" required /></div>
          <div className="field"><label htmlFor="avgHr">{t.runs.avgHr}</label><input id="avgHr" name="avgHr" type="number" min={25} max={250} /></div>
          <div className="field"><label htmlFor="maxHr">{t.runs.maxHr}</label><input id="maxHr" name="maxHr" type="number" min={25} max={250} /></div>
          <div className="field"><label htmlFor="effort">{t.runs.effort}</label><input id="effort" name="effort" type="number" min={1} max={10} /></div>
        </div>
        <label className="check"><input type="checkbox" name="walkBreaks" /> {t.runs.walkBreaks}</label>
        <div className="field"><label htmlFor="notes">{t.runs.notes}</label><textarea id="notes" name="notes" maxLength={1000} /></div>
        <div><button className="btn signal">{t.runs.save}</button></div>
      </form>
    </Shell>
  );
}
