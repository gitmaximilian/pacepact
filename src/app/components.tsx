import Link from "next/link";
import type { ReactNode } from "react";
import { setLocale, signOut } from "./actions";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { InstallPrompt } from "./install-prompt";
import { installLabels } from "./install-labels";
import { Logo } from "./logo";
import { GearLink, TabBar, TopNav } from "./nav-client";

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

/** Header, content column, footer and tab bar of the signed-in app. Used by the (app) layout and by /rules. */
export function AppChrome({ t, children }: { t: Dictionary; children: ReactNode }) {
  const labels = { crew: t.nav.groups, log: t.nav.log, me: t.nav.dashboard, settings: t.nav.settings };
  return (
    <>
      <header className="topbar gutter">
        <div className="wrap">
          <Link href="/groups" className="brand">
            <Logo size={30} /> Pacepact
          </Link>
          <TopNav labels={labels} />
          <div className="tools">
            <GearLink label={t.nav.settings} />
            <form action={signOut} className="desktop-only">
              <button className="btn ghost small">{t.nav.signOut}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="gutter">
        <div className="wrap stack">{children}</div>
      </main>
      <LegalFooter t={t} />
      <TabBar labels={labels} />
      <InstallPrompt labels={installLabels(t)} />
    </>
  );
}

/** Pages outside the (app) group that still show the app chrome when signed in (e.g. /rules). */
export function Shell({ t, children }: { t: Dictionary; locale?: Locale; active?: string; children: ReactNode }) {
  return <AppChrome t={t}>{children}</AppChrome>;
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

/** Tap chips instead of a dropdown: one radio group, styled as pills. Works without JavaScript. */
export function Seg({ name, label, options, value, hideLabel }: { name: string; label: string; options: { value: string; label: string }[]; value?: string; hideLabel?: boolean }) {
  return (
    <fieldset className="field type-pick">
      <legend className={hideLabel ? "sr-only" : undefined}>{label}</legend>
      <div className="seg">
        {options.map((o) => (
          <label key={o.value}>
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === (value ?? options[0]?.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A quiet "back" link at the top of sub-pages: on phones the header is hidden and installed apps have no back button. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="back-link">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      {label}
    </Link>
  );
}
