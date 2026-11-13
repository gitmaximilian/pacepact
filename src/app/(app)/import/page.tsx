import { BackLink } from "@/app/components";
import Link from "next/link";
import { and, count, eq, min, max } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { APPLE_HEALTH } from "@/lib/social/sources";

import { AppleImport } from "@/app/(app)/import/apple-import";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const c = t.importPage;
  const db = await getDb();
  const [stat] = await db
    .select({ n: count(), first: min(schema.runs.startedAt), last: max(schema.runs.startedAt) })
    .from(schema.runs)
    .where(and(eq(schema.runs.userId, user.id), eq(schema.runs.source, APPLE_HEALTH)));
  const day = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium", timeZone: "Europe/Vienna" });
  return (
    <>
      <BackLink href="/runs/new" label={t.nav.log} />
      <h1>{c.title}</h1>
      <p className="muted">{c.intro}</p>

      <section className="panel source-card apple">
        <h2>{c.appleTitle}</h2>
        {stat?.n ? (
          <p className="small"><span className="pill done">{fmt(c.status, { n: stat.n, a: day.format(stat.first!), b: day.format(stat.last!) })}</span></p>
        ) : null}
        <ol className="steps">
          {c.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <AppleImport
          locale={locale}
          labels={{
            choose: c.choose,
            reading: c.reading,
            found: c.found,
            none: c.none,
            noXml: c.noXml,
            from: c.from,
            all: c.all,
            upload: c.upload,
            uploading: c.uploading,
            done: c.done,
            failed: c.failed,
            again: c.choose,
            toRuns: c.toRuns,
          }}
        />
        <p className="small muted">{c.repeat}</p>
        <p className="small muted">{c.privacy}</p>
      </section>

      <section className="panel">
        <h3>{c.manualTitle}</h3>
        <p className="small muted">{c.manualText}</p>
        <div><Link className="btn" href="/runs/new">{t.dashboard.logRun}</Link></div>
      </section>
    </>
  );
}
