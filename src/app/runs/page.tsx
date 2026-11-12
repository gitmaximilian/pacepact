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
    <Shell t={t} locale={locale} active="/runs">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{t.runs.title}</h1>
        <Link className="btn signal" href="/runs/new">{t.runs.add}</Link>
      </div>
      <Flash ok={ok} err={importError ? fmt(t.runs.importFailed, { msg: importError }) : null} />

      <p className="panel small">{t.runs.importHint} <Link href="/import">{t.nav.connections} →</Link></p>

      {runs.length === 0 ? (
        <p className="panel muted">{t.runs.empty}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.runs.date}</th><th>{t.runs.type}</th><th>km</th><th>{t.runs.duration.split(" (")[0]}</th>
                <th>{t.runs.pace}</th><th>{t.runs.avgHr}</th><th>{t.runs.effort.split(" ")[0]}</th><th>{t.runs.source}</th><th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{dateFmt.format(r.startedAt)}</td>
                  <td>
                    <form action={updateRunType} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <select name="runType" defaultValue={r.runType} aria-label={t.runs.type} style={{ width: "auto" }}>
                        {RUN_TYPES.map((rt) => <option key={rt} value={rt}>{t.runTypes[rt]}</option>)}
                      </select>
                      <select name="walk" defaultValue={!r.walkKnown ? "" : r.walkBreaks ? "yes" : "no"} aria-label={t.runs.walkBreaks} style={{ width: "auto" }}>
                        <option value="">{t.runs.walkUnknown}</option>
                        <option value="no">{t.runs.walkNo}</option>
                        <option value="yes">{t.runs.walk}</option>
                      </select>
                      <button className="btn ghost small">{t.runs.change}</button>
                    </form>
                  </td>
                  <td className="num">{formatKm(r.distanceKm, locale)}</td>
                  <td className="num">{formatDuration(r.durationSec)}</td>
                  <td className="num">{formatPace(paceSecPerKm(r.durationSec, r.distanceKm))}</td>
                  <td>{r.avgHr ?? "–"}</td>
                  <td>{r.effort ?? "–"}</td>
                  <td><span className="pill">{r.source}</span></td>
                  <td>
                    <form action={deleteRun}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn danger small">{t.runs.delete}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
