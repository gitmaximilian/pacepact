import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { formatDuration, HALF_MARATHON_KM, MARATHON_KM } from "@/lib/pace";
import { activeGoal, param, type SearchParams } from "@/lib/queries";
import { saveGoal } from "../actions";
import { Flash, Shell } from "../components";
import { PaceCalc } from "./pace-calc";

export const metadata = { title: "Goal" };

export default async function GoalPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const goal = await activeGoal(user.id);
  const presets = [
    [String(HALF_MARATHON_KM), t.goal.half],
    [String(MARATHON_KM), t.goal.marathon],
    ["10", t.goal.tenK],
    ["5", t.goal.fiveK],
  ] as const;
  const preset = goal && presets.some(([v]) => Number(v) === goal.distanceKm) ? String(goal.distanceKm) : goal ? "custom" : String(HALF_MARATHON_KM);
  const error = param(sp, "error");
  return (
    <Shell t={t} locale={locale} active="/goal">
      <h1>{t.goal.title}</h1>
      <Flash err={error === "date" ? t.goal.errDate : error ? t.auth.errInput : null} />
      <form action={saveGoal} className="panel form">
        <div className="fields">
          <div className="field"><label htmlFor="raceName">{t.goal.race}</label><input id="raceName" name="raceName" defaultValue={goal?.raceName ?? ""} placeholder="Vienna City Half Marathon" maxLength={120} required /></div>
          <div className="field"><label htmlFor="raceDate">{t.goal.date}</label><input id="raceDate" name="raceDate" type="date" defaultValue={goal?.raceDate ?? ""} required /></div>
        </div>
        <PaceCalc
          presets={presets.map(([value, label]) => ({ value, label }))}
          labels={{ distance: t.goal.distance, custom: t.goal.custom, target: t.goal.target, optional: t.goal.targetOptional, pace: t.goal.requiredPace }}
          initialPreset={preset}
          initialCustom={goal && preset === "custom" ? String(goal.distanceKm) : ""}
          initialTarget={goal?.targetSeconds ? formatDuration(goal.targetSeconds) : ""}
        />
        <div><button className="btn signal">{t.goal.save}</button></div>
      </form>
    </Shell>
  );
}
