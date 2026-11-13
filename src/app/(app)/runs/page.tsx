import Link from "next/link";
import { RUN_TYPES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { formatDuration, formatKm, formatPace, paceSecPerKm } from "@/lib/pace";
import { param, userRuns, type SearchParams } from "@/lib/queries";
import { deleteRun, updateRunType } from "@/app/actions";
import {Flash, Seg, BackLink } from "@/app/components";

export const metadata = { title: "Runs" };

export default async function RunsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const runs = await userRuns(user.id);
  const imported = param(sp, "imported");
  const ok = param(sp, "saved") ? t.runs.saved : imported != null ? fmt(t.runs.imported, { n: imported, s: param(sp, "skipped") ?? 0 }) : null;
  const importError = param(sp, "importError");
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium", timeZone: "Europe/Vienna" });

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
        <ul className="run-cards">
          {runs.map((r) => (
            <li key={r.id} className="panel">
              <div className="run-top">
                <span className="num big-min">{Math.round(r.durationSec / 60)}<small> {t.common.min}</small></span>
                <div className="run-meta">
                  <b>{dateFmt.format(r.startedAt)}</b>
                  <span className="small muted">
                    {[
                      r.distanceKm > 0 ? `${formatKm(r.distanceKm, locale)} km` : null,
                      r.distanceKm > 0 ? `${formatPace(paceSecPerKm(r.durationSec, r.distanceKm))} /km` : null,
                      formatDuration(r.durationSec),
                      r.effort ? `${t.runs.effort.split(" ")[0]} ${r.effort}` : null,
                      r.avgHr ? `${r.avgHr} ${t.common.bpm}` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {r.source === "manual" ? <span /> : <span className="src-icon" title="Apple Health" role="img" aria-label="Apple Health">⌚</span>}
              </div>
              <details className="more">
                <summary>{[r.runType !== "other" ? t.runTypes[r.runType] : null, t.runs.change].filter(Boolean).join(" · ")}</summary>
                <form action={updateRunType} className="form" style={{ marginTop: 10, gap: 10 }}>
                  <input type="hidden" name="id" value={r.id} />
                  <Seg name="runType" label={t.runs.type} value={r.runType} options={RUN_TYPES.map((rt) => ({ value: rt, label: t.runTypes[rt] }))} />
                  <Seg name="walk" label={t.runs.walkBreaksQ} value={!r.walkKnown ? "" : r.walkBreaks ? "yes" : "no"} options={[{ value: "no", label: t.runs.walkNo }, { value: "yes", label: t.runs.walk }, { value: "", label: t.runs.walkUnknown }]} />
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <button className="btn small">{t.common.save}</button>
                    <button className="btn danger small" formAction={deleteRun}>{t.runs.delete}</button>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
