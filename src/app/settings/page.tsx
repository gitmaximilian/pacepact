import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { appUrl } from "@/lib/providers/registry";
import { deleteAccount, revokeApiToken, setHrConsent, setLocale } from "../actions";
import { Flash, Shell } from "../components";
import { fmt } from "@/lib/i18n";
import { param, type SearchParams } from "@/lib/queries";
import { TokenForm } from "./token-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const hr = param(await searchParams, "hr");
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium" });
  const db = await getDb();
  const tokens = await db.select().from(schema.apiTokens).where(eq(schema.apiTokens.userId, user.id));
  return (
    <Shell t={t} locale={locale} active="/settings">
      <h1>{t.settings.title}</h1>
      <Flash ok={hr === "granted" ? t.settings.hrGranted : hr === "withdrawn" ? t.settings.hrWithdrawn : null} />

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

      <section className="panel">
        <h3>{t.settings.tokens}</h3>
        <p className="small muted">{t.settings.tokensHint}</p>
        {tokens.length ? (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }} className="stack">
            {tokens.map((tk) => (
              <li key={tk.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>{tk.label} <span className="small muted">· {tk.lastUsedAt ? tk.lastUsedAt.toISOString().slice(0, 10) : "–"}</span></span>
                <form action={revokeApiToken}><input type="hidden" name="id" value={tk.id} /><button className="btn danger small">{t.settings.revoke}</button></form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t.settings.noTokens}</p>
        )}
        <TokenForm
          ingestUrl={`${appUrl()}/api/ingest`}
          labels={{ label: t.settings.tokenLabel, create: t.settings.createToken, newToken: t.settings.newToken, example: t.settings.example }}
        />
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
