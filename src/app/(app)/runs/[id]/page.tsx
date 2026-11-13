import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { RUN_TYPES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { formatDuration, formatKm, formatPace, paceSecPerKm } from "@/lib/pace";
import { deleteRun, updateRunType } from "@/app/actions";
import { BackLink, Seg } from "@/app/components";
import { ConfirmButton } from "@/app/(app)/groups/client";

export const metadata = { title: "Run" };

/** Edit one run: type and walk breaks (imports cannot tell), or delete it. */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, locale } = await getT();
  const db = await getDb();
  const [r] = await db.select().from(schema.runs).where(and(eq(schema.runs.id, id), eq(schema.runs.userId, user.id))).limit(1);
  if (!r) notFound();
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Vienna" });
  return (
    <>
      <BackLink href="/runs" label={t.runs.title} />
      <h1>{Math.round(r.durationSec / 60)} {t.common.min}</h1>
      <section className="panel">
        <b>{dateFmt.format(r.startedAt)}</b>
        <p className="muted">
          {[
            r.distanceKm > 0 ? `${formatKm(r.distanceKm, locale)} km` : null,
            r.distanceKm > 0 ? `${formatPace(paceSecPerKm(r.durationSec, r.distanceKm))} /km` : null,
            formatDuration(r.durationSec),
            r.avgHr ? `Ø ${r.avgHr} ${t.common.bpm}` : null,
            r.maxHr ? `max ${r.maxHr} ${t.common.bpm}` : null,
            r.effort ? `${t.runs.effort.split(" ")[0]} ${r.effort}` : null,
            r.source === "manual" ? `✍️ ${t.social.manual}` : "⌚ Apple Health",
          ].filter(Boolean).join(" · ")}
        </p>
        {r.notes ? <p className="small">{r.notes}</p> : null}
      </section>
      <form action={updateRunType} className="panel form">
        <input type="hidden" name="id" value={r.id} />
        <Seg name="runType" label={t.runs.type} value={r.runType} options={RUN_TYPES.map((rt) => ({ value: rt, label: t.runTypes[rt] }))} />
        <Seg name="walk" label={t.runs.walkBreaksQ} value={!r.walkKnown ? "" : r.walkBreaks ? "yes" : "no"} options={[{ value: "no", label: t.runs.walkNo }, { value: "yes", label: t.runs.walk }, { value: "", label: t.runs.walkUnknown }]} />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="btn">{t.common.save}</button>
          <ConfirmButton message={`${t.runs.delete}?`} className="btn danger" formAction={deleteRun}>{t.runs.delete}</ConfirmButton>
        </div>
      </form>
    </>
  );
}
