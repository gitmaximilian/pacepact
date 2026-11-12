import Link from "next/link";
import { and, count, eq, max, min } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { appUrl, getOAuthProvider, isConfigured } from "@/lib/providers/registry";
import { param, type SearchParams } from "@/lib/queries";
import { APPLE_HEALTH } from "@/lib/social/sources";
import { disconnect, syncNow } from "../actions";
import { Flash, Shell } from "../components";
import { AppleSetup } from "./apple-setup";
import { StravaHistory } from "./strava-history";

export const metadata = { title: "Connections" };

export default async function ConnectionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const c = t.connections;
  const sp = await searchParams;
  const db = await getDb();
  const strava = getOAuthProvider("strava")!;
  const [[conn], [apple], appleTokens] = await Promise.all([
    db.select().from(schema.connections).where(and(eq(schema.connections.userId, user.id), eq(schema.connections.provider, "strava"))).limit(1),
    db
      .select({ n: count(), last: max(schema.runs.createdAt), first: min(schema.runs.startedAt) })
      .from(schema.runs)
      .where(and(eq(schema.runs.userId, user.id), eq(schema.runs.source, APPLE_HEALTH))),
    db
      .select({ lastUsedAt: schema.apiTokens.lastUsedAt })
      .from(schema.apiTokens)
      .where(and(eq(schema.apiTokens.userId, user.id), eq(schema.apiTokens.label, "Apple Health"))),
  ]);
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Vienna" });
  const dayFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium", timeZone: "Europe/Vienna" });
  const lastApple = appleTokens.map((x) => x.lastUsedAt?.getTime() ?? 0).reduce((a, b) => Math.max(a, b), 0);
  const ok = param(sp, "ok");
  const err = param(sp, "error");

  return (
    <Shell t={t} locale={locale} active="/connections">
      <h1>{c.title}</h1>
      <p className="muted">{c.intro}</p>
      <Flash
        ok={ok ? fmt(c.synced, { n: param(sp, "n") ?? 0, name: "Strava" }) : param(sp, "disconnected") ? c.disconnected : null}
        err={err ? fmt(c.error, { name: "Strava", msg: param(sp, "msg") ?? "" }) : null}
      />

      <section className="panel source-card apple">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>{c.appleTitle}</h2>
          {lastApple ? <span className="pill done">{c.active}</span> : null}
        </div>
        <p>{process.env.APPLE_SHORTCUT_URL ? c.appleTextFree : c.appleText}</p>
        {lastApple ? (
          <p className="small muted">
            {fmt(c.appleStatus, { n: apple?.n ?? 0, when: dateFmt.format(new Date(lastApple)) })}
            {apple?.first ? ` · ${fmt(c.since, { date: dayFmt.format(apple.first) })}` : ""}
          </p>
        ) : null}
        <AppleSetup
          url={`${appUrl()}/api/ingest/apple-health`}
          hasToken={appleTokens.length > 0}
          shortcutUrl={process.env.APPLE_SHORTCUT_URL?.startsWith("https://www.icloud.com/shortcuts/") ? process.env.APPLE_SHORTCUT_URL : null}
          labels={{
            setup: c.appleSetup,
            again: c.appleAgain,
            step1: c.appleStep1,
            step1Link: c.appleStep1Link,
            step2: c.appleStep2,
            oneTap: c.appleOneTap,
            oneTapHint: c.appleOneTapHint,
            manual: c.appleManual,
            urlLabel: c.appleUrl,
            headerKey: c.appleHeaderKey,
            headerValue: c.appleHeaderValue,
            settings: c.appleSettings,
            step3: c.appleStep3,
            tokenOnce: c.appleTokenOnce,
            copy: c.copy,
            copied: c.copied,
            shortcut: c.shortcut,
          }}
        />
        <details className="history">
          <summary><strong>{c.appleHistoryTitle}</strong></summary>
          <ol className="steps small" style={{ marginTop: 8 }}>
            {c.appleHistorySteps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </details>
        <p className="small muted">{c.appleNote}</p>
      </section>

      <section className="panel source-card strava">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Strava</h2>
          {conn ? <span className="pill done">{c.connected}</span> : null}
        </div>
        <p>{c.stravaText}</p>
        {conn ? (
          <>
            <p className="small muted">{fmt(c.lastSync, { when: conn.lastSyncAt ? dateFmt.format(conn.lastSyncAt) : c.never })}</p>
            {conn.lastError ? <p className="small" style={{ color: "var(--bad)" }}>{conn.lastError}</p> : null}
            <div className="row">
              <form action={syncNow}><input type="hidden" name="provider" value="strava" /><button className="btn small">{c.sync}</button></form>
            </div>
            <StravaHistory labels={c.stravaHistory} />
            <form action={disconnect} className="stack" style={{ gap: 8 }}>
              <input type="hidden" name="provider" value="strava" />
              <label className="check small"><input type="checkbox" name="deleteRuns" defaultChecked /> {c.deleteStravaRuns}</label>
              <div><button className="btn danger small">{c.disconnect}</button></div>
            </form>
          </>
        ) : isConfigured(strava) ? (
          <div><a className="btn strava-btn" href="/api/connections/strava/start">{c.connectStrava}</a></div>
        ) : (
          <p className="small muted">{c.notConfigured}</p>
        )}
        <p className="small"><strong>{c.stravaCrewTitle}</strong> {c.stravaCrew}</p>
        <p className="powered">Powered by Strava</p>
      </section>

      <section className="panel">
        <h3>{c.filesTitle}</h3>
        <p className="small muted">{c.filesText} <Link href="/runs">{t.nav.runs} →</Link></p>
        <p className="small muted">{c.apiText} <Link href="/settings">{t.nav.settings} →</Link></p>
      </section>
    </Shell>
  );
}
