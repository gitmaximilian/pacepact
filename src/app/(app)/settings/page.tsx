import { hrNeedsRenewal } from "@/lib/hr";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { deleteAccount, deletePasskey, setHrConsent, setLocale, signOut } from "@/app/actions";
import { AddPasskeyButton } from "@/app/passkey-client";
import { InstallRow } from "@/app/install-prompt";
import { installLabels } from "@/app/install-labels";
import Link from "next/link";
import { passkeyLabels } from "@/app/passkey-labels";
import {Flash, Seg, BackLink } from "@/app/components";
import { fmt } from "@/lib/i18n";
import { param, type SearchParams } from "@/lib/queries";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const hr = param(sp, "hr");
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium" });
  const db = await getDb();
  const keys = await db.select().from(schema.passkeys).where(eq(schema.passkeys.userId, user.id));
  return (
    <>
      <BackLink href="/dashboard" label={t.nav.dashboard} />
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{t.settings.title}</h1>
        <div className="row" style={{ gap: 8 }}>
          <form action={signOut}><button className="btn ghost small">{t.nav.signOut}</button></form>
        </div>
      </div>
      <Flash ok={hr === "granted" ? t.settings.hrGranted : hr === "withdrawn" ? t.settings.hrWithdrawn : param(sp, "passkey") === "added" ? t.settings.passkeyAdded : null} />

      <section className="panel">
        <h3>{t.settings.trainingTitle}</h3>
        <p className="small muted">{t.settings.trainingText}</p>
        <div className="row">
          <Link className="btn small" href="/welcome">{t.settings.trainingButton}</Link>
          <InstallRow labels={installLabels(t)} />
        </div>
      </section>

      <section className="panel">
        <h3>{t.settings.passkeys}</h3>
        <p className="small muted">{t.settings.passkeysHint}</p>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }} className="stack">
          {keys.map((k, i) => (
            <li key={k.id} className="row" style={{ justifyContent: "space-between" }}>
              <span>Passkey {i + 1} <span className="small muted">· {fmt(t.settings.passkeyCreated, { date: dateFmt.format(k.createdAt) })}</span></span>
              {keys.length > 1 ? (
                <form action={deletePasskey}><input type="hidden" name="id" value={k.id} /><button className="btn danger small">{t.settings.removePasskey}</button></form>
              ) : (
                <span className="small muted">{t.settings.lastPasskey}</span>
              )}
            </li>
          ))}
        </ul>
        <AddPasskeyButton label={t.settings.addPasskey} done={t.settings.passkeyAdded} labels={passkeyLabels(t)} />
      </section>

      <form action={setLocale} className="panel form">
        <h3>{t.settings.language}</h3>
        <input type="hidden" name="back" value="/settings" />
        <Seg name="locale" label={t.settings.language} hideLabel value={locale} options={[{ value: "en", label: "English" }, { value: "de", label: "Deutsch" }]} />
        <div><button className="btn">{t.settings.saveLanguage}</button></div>
      </form>

      <section className="panel" id="hr">
        <h3>{t.settings.privacy}</h3>
        <strong>{t.settings.hrTitle}</strong>
        {hrNeedsRenewal(user.hrConsentAt) ? (
          <form action={setHrConsent} className="stack hr-consent" style={{ gap: 10 }}>
            <p className="small">{t.settings.hrRenewText}</p>
            <label className="check" style={{ alignItems: "flex-start" }}>
              <input type="checkbox" name="confirm" required />
              <span className="small">{t.settings.hrGrantText}</span>
            </label>
            <input type="hidden" name="consent" value="grant" />
            <div><button className="btn small">{t.settings.hrRenewButton}</button></div>
          </form>
        ) : null}
        {user.hrConsentAt ? (
          <form action={setHrConsent} className="stack" style={{ gap: 10 }}>
            <p className="small">{fmt(t.settings.hrOn, { date: dateFmt.format(user.hrConsentAt) })}</p>
            <input type="hidden" name="consent" value="withdraw" />
            <div><button className="btn danger small">{t.settings.hrWithdraw}</button></div>
          </form>
        ) : (
          <form action={setHrConsent} className="stack" style={{ gap: 10 }}>
            <p className="small muted">{t.settings.hrOffText}</p>
            <label className="check" style={{ alignItems: "flex-start" }}>
              <input type="checkbox" name="confirm" required />
              <span className="small">{t.settings.hrGrantText}</span>
            </label>
            <input type="hidden" name="consent" value="grant" />
            <div><button className="btn small">{t.settings.hrGrant}</button></div>
          </form>
        )}
        <strong>{t.settings.exportTitle}</strong>
        <p className="small muted">{t.settings.exportText}</p>
        <div><a className="btn ghost small" href="/api/export" download>{t.settings.exportButton}</a></div>
        <p className="small"><a href="/privacy">{t.legal.privacy}</a></p>
      </section>

      <form action={deleteAccount} className="panel form">
        <h3>{t.settings.account}</h3>
        <div className="field">
          <label htmlFor="confirm">{t.settings.deleteConfirm}</label>
          <input id="confirm" name="confirm" autoComplete="off" style={{ maxWidth: 260 }} />
        </div>
        <div><button className="btn danger">{t.settings.deleteAccount}</button></div>
      </form>
    </>
  );
}
