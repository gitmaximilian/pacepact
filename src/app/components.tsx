import Link from "next/link";
import type { ReactNode } from "react";
import { setLocale, signOut } from "./actions";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { InstallPrompt } from "./install-prompt";
import { installLabels } from "./install-labels";
import { Logo } from "./logo";

export { Logo } from "./logo";

export function LangSwitch({ locale, back }: { locale: Locale; back: string }) {
  return (
    <form action={setLocale} className="lang-switch" aria-label="Language">
      <input type="hidden" name="back" value={back} />
      <button name="locale" value="en" aria-pressed={locale === "en"}>EN</button>
      <button name="locale" value="de" aria-pressed={locale === "de"}>DE</button>
    </form>
  );
}

const NAV = [
  ["/dashboard", "dashboard"],
  ["/runs", "runs"],
  ["/plan", "plan"],
  ["/groups", "groups"],
  ["/connections", "connections"],
  ["/settings", "settings"],
] as const;

export function Shell({
  t,
  locale,
  active,
  children,
}: {
  t: Dictionary;
  locale: Locale;
  active: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="topbar gutter">
        <div className="wrap">
          <Link href="/dashboard" className="brand">
            <Logo size={30} /> Pacepact
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map(([href, key]) => (
              <Link key={href} href={href} aria-current={active === href ? "page" : undefined}>
                {t.nav[key]}
              </Link>
            ))}
          </nav>
          <div className="tools">
            <LangSwitch locale={locale} back={active} />
            <form action={signOut}>
              <button className="btn ghost small">{t.nav.signOut}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="gutter">
        <div className="wrap stack">{children}</div>
      </main>
      <LegalFooter t={t} />
      <InstallPrompt labels={installLabels(t)} />
    </>
  );
}

export function LegalFooter({ t }: { t: Dictionary }) {
  return (
    <footer className="gutter">
      <div className="wrap row" style={{ justifyContent: "space-between" }}>
        <span>Pacepact · {t.meta.tagline}</span>
        <span className="row" style={{ gap: 16 }}>
          <Link href="/privacy">{t.legal.privacy}</Link>
          <a href={LEGAL.legalUrl} rel="noopener">{t.legal.imprint}</a>
        </span>
      </div>
    </footer>
  );
}

export function Flash({ ok, err }: { ok?: string | null; err?: string | null }) {
  if (err) return <p className="flash err" role="alert">{err}</p>;
  if (ok) return <p className="flash ok" role="status">{ok}</p>;
  return null;
}

export function Stat({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="panel stat">
      <span className="label">{label}</span>
      <span className="value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </span>
    </div>
  );
}

export function LaneNo({ type }: { type: string }) {
  const m = /^run(\d)$/.exec(type);
  return <span className={`lane-no${m ? "" : " test"}`}>{m ? m[1] : type === "test" ? "TEST" : "–"}</span>;
}
