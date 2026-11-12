import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { deleteAccount, deletePasskey, setHrConsent, setLocale, signOut } from "../actions";
import { AddPasskeyButton } from "../passkey-client";
import { InstallRow } from "../install-prompt";
import { installLabels } from "../install-labels";
import Link from "next/link";
import { passkeyLabels } from "../passkey-labels";
import { Flash, Shell } from "../components";
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
    <Shell t={t} locale={locale} active="/settings">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{t.settings.title}</h1>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/import" className="btn ghost small">{t.nav.connections}</Link>
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
        <div className="field">
          <label htmlFor="locale">{t.settings.language}</label>
          <select id="locale" name="locale" defaultValue={locale} style={{ maxWidth: 260 }}>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
        <div><button className="btn">{t.settings.saveLanguage}</button></div>
      </form>

      <section className="panel">
        <h3>{t.settings.privacy}</h3>
        <strong>{t.settings.hrTitle}</strong>
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
    </Shell>
  );
}
