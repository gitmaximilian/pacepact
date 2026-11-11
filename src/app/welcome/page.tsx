import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { formatDuration, HALF_MARATHON_KM, MARATHON_KM } from "@/lib/pace";
import { activeGoal, param, type SearchParams } from "@/lib/queries";
import { completeOnboarding, skipOnboarding } from "../actions";
import { LangSwitch, LegalFooter, Logo } from "../components";
import { Wizard, type WizardInitial } from "./wizard";

export const metadata = { title: "Welcome" };

function goalKey(km: number | undefined): WizardInitial["goal"] {
  if (km === HALF_MARATHON_KM) return "half";
  if (km === MARATHON_KM) return "marathon";
  if (km === 10) return "tenK";
  if (km === 5) return "fiveK";
  return "half";
}

export default async function WelcomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const goal = await activeGoal(user.id);
  const initial: WizardInitial = {
    goal: goal ? goalKey(goal.distanceKm) : "half",
    raceName: goal?.raceName ?? "",
    raceDate: goal?.raceDate ?? "",
    target: goal?.targetSeconds ? formatDuration(goal.targetSeconds) : "",
    experience: user.experience ?? "",
    runsPerWeek: String(user.runsPerWeek ?? 3),
    strength: user.onboardedAt ? (user.strength ? "yes" : "no") : "",
  };
  return (
    <>
      <div className="track gutter" style={{ paddingBlock: 18 }}>
        <div className="wrap row" style={{ justifyContent: "space-between" }}>
          <span className="brand"><Logo size={30} /> Pacepact</span>
          <LangSwitch locale={locale} back="/welcome" />
        </div>
      </div>
      <main className="gutter">
        <div className="wrap stack" style={{ maxWidth: 720 }}>
          <div className="stack" style={{ gap: 6 }}>
            <h1>{t.welcome.title}</h1>
            <p className="muted">{t.welcome.intro}</p>
          </div>
          <Wizard t={t} initial={initial} action={completeOnboarding} skip={skipOnboarding} error={param(await searchParams, "error")} />
        </div>
      </main>
      <LegalFooter t={t} />
    </>
  );
}
