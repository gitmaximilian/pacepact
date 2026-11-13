import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { homeCrew } from "@/lib/social/groups";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { LangSwitch, LegalFooter, Logo } from "./components";

export default async function Landing() {
  const user = await currentUser();
  if (user) {
    const home = user.onboardedAt ? await homeCrew(user.id, (await cookies()).get("pp_crew")?.value) : null;
    redirect(!user.onboardedAt ? "/welcome" : home ? `/groups/${home}` : "/dashboard");
  }
  const { t, locale } = await getT();
  const features = [
    [t.landing.f1t, t.landing.f1d],
    [t.landing.f2t, t.landing.f2d],
    [t.landing.f3t, t.landing.f3d],
    [t.landing.f4t, t.landing.f4d],
  ];
  return (
    <>
      <section className="track hero gutter">
        <div className="wrap">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="brand"><Logo size={40} /> Pacepact</span>
            <LangSwitch locale={locale} back="/" />
          </div>
          <h1>{t.landing.headline}</h1>
          <p>{t.landing.sub}</p>
          <div className="row">
            <Link className="btn signal" href="/signup">{t.landing.cta}</Link>
            <Link className="btn ghost" href="/signin">{t.landing.haveAccount}</Link>
          </div>
        </div>
      </section>
      <main className="gutter">
        <div className="wrap grid">
          {features.map(([title, text], i) => (
            <div className="panel lane-tile" key={title}>
              <span className="lane-no">{i + 1}</span>
              <div className="stack" style={{ gap: 6 }}>
                <h3>{title}</h3>
                <p className="muted small">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
      <LegalFooter t={t} />
    </>
  );
}
