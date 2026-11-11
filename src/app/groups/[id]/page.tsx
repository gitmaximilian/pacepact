import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { formatDuration, formatKm, formatPace, paceSecPerKm } from "@/lib/pace";
import { leaveGroup } from "../../actions";
import { Shell, Stat } from "../../components";

export const metadata = { title: "Group" };

/** Average pace of the first three vs. the last three runs, in sec/km (negative = faster). */
function ownProgress(runs: { startedAt: Date; distanceKm: number; durationSec: number }[]) {
  const valid = runs.filter((r) => r.distanceKm > 0).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  if (valid.length < 6) return null;
  const pace = (rs: typeof valid) => rs.reduce((a, r) => a + r.durationSec, 0) / rs.reduce((a, r) => a + r.distanceKm, 0);
  return Math.round(pace(valid.slice(-3)) - pace(valid.slice(0, 3)));
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, locale } = await getT();
  const db = await getDb();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [membership] = await db
    .select()
    .from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, id), eq(schema.groupMembers.userId, user.id)))
    .limit(1);
  if (!membership) notFound();
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, id)).limit(1);
  const members = await db
    .select({ id: schema.users.id, name: schema.users.name, role: schema.groupMembers.role })
    .from(schema.groupMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.groupMembers.userId))
    .where(eq(schema.groupMembers.groupId, id));
  const ids = members.map((m) => m.id);
  // Group members see run summaries only (no notes, no body metrics).
  const runs = await db
    .select({
      userId: schema.runs.userId,
      startedAt: schema.runs.startedAt,
      distanceKm: schema.runs.distanceKm,
      durationSec: schema.runs.durationSec,
      runType: schema.runs.runType,
    })
    .from(schema.runs)
    .where(inArray(schema.runs.userId, ids))
    .orderBy(desc(schema.runs.startedAt));
  const since = new Date(Date.now() - 28 * 86400_000);
  const recent = runs.filter((r) => r.startedAt >= since);
  const name = new Map(members.map((m) => [m.id, m.name]));
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium" });

  return (
    <Shell t={t} locale={locale} active="/groups">
      <h1>{group.name}</h1>
      <div className="grid">
        <Stat label={t.groups.teamKm28} value={formatKm(recent.reduce((a, r) => a + r.distanceKm, 0), locale, 1)} unit="km" />
        <Stat label={t.groups.teamRuns28} value={recent.length} />
        <div className="panel stat">
          <span className="label">{t.groups.invite}</span>
          <span className="invite">{group.inviteCode}</span>
          <span className="small muted">{t.groups.inviteHint}</span>
        </div>
      </div>

      <section className="stack" style={{ gap: 12 }}>
        <h2>{t.groups.progress}</h2>
        <p className="small muted">{t.groups.progressHint}</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t.groups.members}</th><th>{t.groups.km28}</th><th>{t.groups.runs28}</th><th>Δ {t.runs.pace}</th></tr></thead>
            <tbody>
              {members.map((m) => {
                const mine = runs.filter((r) => r.userId === m.id);
                const mineRecent = mine.filter((r) => r.startedAt >= since);
                const delta = ownProgress(mine);
                return (
                  <tr key={m.id}>
                    <td>{m.name} {m.role === "owner" ? <span className="pill">{t.groups.owner}</span> : null}</td>
                    <td className="num">{formatKm(mineRecent.reduce((a, r) => a + r.distanceKm, 0), locale, 1)}</td>
                    <td className="num">{mineRecent.length}</td>
                    <td>
                      {delta == null ? (
                        <span className="small muted">{t.groups.notEnough}</span>
                      ) : (
                        <span className={`pill${delta < 0 ? " done" : ""}`}>{delta <= 0 ? "−" : "+"}{formatPace(Math.abs(delta))} /km</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <h2>{t.groups.feed}</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t.runs.date}</th><th>{t.groups.members}</th><th>{t.runs.type}</th><th>km</th><th>{t.runs.duration.split(" (")[0]}</th><th>{t.runs.pace}</th></tr></thead>
            <tbody>
              {runs.slice(0, 30).map((r, i) => (
                <tr key={i}>
                  <td>{dateFmt.format(r.startedAt)}</td>
                  <td>{name.get(r.userId)}</td>
                  <td>{t.runTypes[r.runType]}</td>
                  <td className="num">{formatKm(r.distanceKm, locale)}</td>
                  <td className="num">{formatDuration(r.durationSec)}</td>
                  <td className="num">{formatPace(paceSecPerKm(r.durationSec, r.distanceKm))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <form action={leaveGroup}>
        <input type="hidden" name="groupId" value={group.id} />
        <button className="btn danger">{t.groups.leave}</button>
      </form>
    </Shell>
  );
}
