import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { formatDuration, HALF_MARATHON_KM, MARATHON_KM } from "@/lib/pace";
import { activeGoal, param, type SearchParams } from "@/lib/queries";
import { normalizeCode } from "@/lib/social/join";
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

async function raceOfCrew(code: string) {
  const db = await getDb();
  const [g] = await db.select({ raceName: schema.groups.raceName, raceDate: schema.groups.raceDate }).from(schema.groups).where(eq(schema.groups.inviteCode, code)).limit(1);
  const today = new Date().toISOString().slice(0, 10);
  return g?.raceDate && g.raceDate > today ? { raceName: g.raceName ?? "", raceDate: g.raceDate } : null;
}

export default async function WelcomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const goal = await activeGoal(user.id);
  const join = normalizeCode(param(sp, "join") ?? "") || undefined;
  // Invited runners usually train for the crew's race: prefill it so the first question is one tap.
  const crewRace = !goal && join ? await raceOfCrew(join) : null;
  const initial: WizardInitial = {
    goal: goal ? goalKey(goal.distanceKm) : "half",
    raceName: goal?.raceName ?? crewRace?.raceName ?? "",
    raceDate: goal?.raceDate ?? crewRace?.raceDate ?? "",
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
          <Wizard t={t} initial={initial} action={completeOnboarding} skip={skipOnboarding} error={param(sp, "error")} join={join} />
        </div>
      </main>
      <LegalFooter t={t} />
    </>
  );
}
