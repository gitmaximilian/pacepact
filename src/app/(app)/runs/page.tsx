import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { formatKm, formatPace, paceSecPerKm } from "@/lib/pace";
import { listSize } from "@/lib/paging";
import { param, recentRuns, type SearchParams } from "@/lib/queries";
import { BackLink, Flash } from "@/app/components";

export const metadata = { title: "Runs" };

const STEP = 30;

/** A light list: one row per run, linking to its own edit page. Older runs load on request. */
export default async function RunsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const size = listSize(param(sp, "n"), STEP, 600);
  const { runs, more } = await recentRuns(user.id, size);
  const imported = param(sp, "imported");
  const ok = param(sp, "saved") ? t.runs.saved : param(sp, "deleted") ? t.runs.deleted : imported != null ? fmt(t.runs.imported, { n: imported, s: param(sp, "skipped") ?? 0 }) : null;
  const importError = param(sp, "importError");
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Vienna" });

  return (
    <>
      <BackLink href="/dashboard" label={t.nav.dashboard} />
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{t.runs.title}</h1>
        <Link className="btn signal" href="/runs/new">{t.runs.add}</Link>
      </div>
      <Flash ok={ok} err={importError ? fmt(t.runs.importFailed, { msg: importError }) : null} />

      {runs.length === 0 ? (
        <p className="panel muted">{t.runs.empty} <Link href="/import">{t.dashboard.importApple} →</Link></p>
      ) : (
        <ul className="run-rows panel">
          {runs.map((r) => (
            <li key={r.id}>
              <Link href={`/runs/${r.id}`} prefetch={false}>
                <span className="num big-min">{Math.round(r.durationSec / 60)}<small> {t.common.min}</small></span>
                <span className="run-meta">
                  <b>{dateFmt.format(r.startedAt)}</b>
                  <span className="small muted">
                    {[
                      r.runType !== "other" ? t.runTypes[r.runType] : null,
                      r.distanceKm > 0 ? `${formatKm(r.distanceKm, locale)} km` : null,
                      r.distanceKm > 0 ? `${formatPace(paceSecPerKm(r.durationSec, r.distanceKm))} /km` : null,
                      r.avgHr ? `♥ ${r.avgHr}` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {r.source === "manual" ? <span /> : <span className="src-icon" title="Apple Health" role="img" aria-label="Apple Health">⌚</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {more ? <Link className="btn ghost" href={`/runs?n=${size + STEP}`} scroll={false}>{t.runs.showMore}</Link> : null}
    </>
  );
}
