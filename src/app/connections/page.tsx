import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { appUrl, isConfigured, PROVIDERS } from "@/lib/providers/registry";
import { param, type SearchParams } from "@/lib/queries";
import { disconnect, syncNow } from "../actions";
import { Flash, Shell } from "../components";

export const metadata = { title: "Connections" };

export default async function ConnectionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const db = await getDb();
  const conns = await db.select().from(schema.connections).where(eq(schema.connections.userId, user.id));
  const byProvider = new Map(conns.map((c) => [c.provider, c]));
  const nameOf = (id: string | null) => PROVIDERS.find((p) => p.id === id)?.name ?? id ?? "";
  const ok = param(sp, "ok");
  const err = param(sp, "error");
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <Shell t={t} locale={locale} active="/connections">
      <h1>{t.connections.title}</h1>
      <p className="muted">{t.connections.intro}</p>
      <Flash
        ok={ok ? fmt(t.connections.synced, { n: param(sp, "n") ?? 0, name: nameOf(ok) }) : null}
        err={err ? fmt(t.connections.error, { name: nameOf(err), msg: param(sp, "msg") ?? "" }) : null}
      />
      <div className="grid">
        {PROVIDERS.map((p) => {
          const conn = byProvider.get(p.id);
          return (
            <section key={p.id} className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>{p.name}</h3>
                {conn ? <span className="pill done">{t.connections.connected}</span> : null}
              </div>
              {p.kind === "partner" ? (
                <p className="small muted">{fmt(t.connections.partner, { name: p.name })}</p>
              ) : conn ? (
                <>
                  <p className="small muted">{fmt(t.connections.lastSync, { when: conn.lastSyncAt ? dateFmt.format(conn.lastSyncAt) : t.connections.never })}</p>
                  {conn.lastError ? <p className="small" style={{ color: "var(--bad)" }}>{conn.lastError}</p> : null}
                  <div className="row">
                    <form action={syncNow}><input type="hidden" name="provider" value={p.id} /><button className="btn small">{t.connections.sync}</button></form>
                    <form action={disconnect}><input type="hidden" name="provider" value={p.id} /><button className="btn danger small">{t.connections.disconnect}</button></form>
                  </div>
                </>
              ) : isConfigured(p) ? (
                <div><a className="btn signal" href={`/api/connections/${p.id}/start`}>{t.connections.connect}</a></div>
              ) : (
                <p className="small muted">{t.connections.notConfigured}</p>
              )}
            </section>
          );
        })}
        <section className="panel">
          <h3>{t.connections.filesTitle}</h3>
          <p className="small muted">{t.connections.filesText}</p>
        </section>
        <section className="panel">
          <h3>{t.connections.shortcutTitle}</h3>
          <p className="small muted">{fmt(t.connections.shortcutText, { url: `${appUrl()}/api/ingest` })}</p>
        </section>
      </div>
    </Shell>
  );
}
