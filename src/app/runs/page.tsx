import Link from "next/link";
import { RUN_TYPES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { formatDuration, formatKm, formatPace, paceSecPerKm } from "@/lib/pace";
import { param, userRuns, type SearchParams } from "@/lib/queries";
import { deleteRun, updateRunType } from "../actions";
import { Flash, Shell } from "../components";

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
    <Shell t={t} locale={locale} active="/dashboard">
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
                <span className={`src ${r.source === "manual" ? "manual" : "device"}`}>{r.source === "manual" ? `✍️ ${t.social.manual}` : "⌚ Apple Health"}</span>
              </div>
              <details className="more">
                <summary>{t.runTypes[r.runType]} · {!r.walkKnown ? t.runs.walkUnknown : r.walkBreaks ? t.runs.walk : t.runs.walkNo} · {t.runs.change}</summary>
                <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                  <form action={updateRunType} className="row" style={{ gap: 8 }}>
                    <input type="hidden" name="id" value={r.id} />
                    <select name="runType" defaultValue={r.runType} aria-label={t.runs.type} className="compact">
                      {RUN_TYPES.map((rt) => <option key={rt} value={rt}>{t.runTypes[rt]}</option>)}
                    </select>
                    <select name="walk" defaultValue={!r.walkKnown ? "" : r.walkBreaks ? "yes" : "no"} aria-label={t.runs.walkBreaks} className="compact">
                      <option value="">{t.runs.walkUnknown}</option>
                      <option value="no">{t.runs.walkNo}</option>
                      <option value="yes">{t.runs.walk}</option>
                    </select>
                    <button className="btn small">{t.common.save}</button>
                  </form>
                  <form action={deleteRun}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn danger small">{t.runs.delete}</button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
