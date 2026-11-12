import Link from "next/link";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { param, type SearchParams } from "@/lib/queries";
import { redirect } from "next/navigation";
import { homeCrew } from "@/lib/social/groups";
import { createGroup, joinGroup } from "./actions";
import { Flash, Shell } from "../components";
import { Icon } from "../icons";

export const metadata = { title: "Crews" };

export default async function GroupsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const error = param(sp, "error");
  const message = error || param(sp, "left") || param(sp, "deleted");
  if (!param(sp, "all") && !message) {
    const home = await homeCrew(user.id);
    if (home) redirect(`/groups/${home}`);
  }
  const db = await getDb();
  const mine = await db
    .select({ id: schema.groups.id, name: schema.groups.name, role: schema.groupMembers.role, raceName: schema.groups.raceName })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(eq(schema.groupMembers.userId, user.id));
  const counts = mine.length
    ? await db
        .select({ g: schema.groupMembers.groupId, n: sql<number>`count(*)` })
        .from(schema.groupMembers)
        .where(inArray(schema.groupMembers.groupId, mine.map((g) => g.id)))
        .groupBy(schema.groupMembers.groupId)
    : [];
  const n = new Map(counts.map((c) => [c.g, c.n]));
  return (
    <Shell t={t} locale={locale} active="/groups">
      <h1>{t.social.crews}</h1>
      <Flash
        ok={param(sp, "left") ? t.social.left : param(sp, "deleted") ? t.social.deleted : null}
        err={error === "code" ? t.groups.errCode : error === "name" ? t.groups.errName : error === "rate" ? t.social.errRate : null}
      />
      {mine.length ? (
        <div className="grid">
          {mine.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="panel crew-card">
              <span className="eyebrow">{(n.get(g.id) ?? 1) === 1 ? t.social.runnersOne : fmt(t.social.runners, { n: n.get(g.id) ?? 1 })}{g.role === "owner" ? ` · ${t.groups.owner}` : ""}</span>
              <h2>{g.name}</h2>
              {g.raceName ? <span className="small muted"><Icon name="flag" size={14} /> {g.raceName}</span> : null}
            </Link>
          ))}
        </div>
      ) : (
        <p className="panel muted">{t.groups.none}</p>
      )}
      <div className="grid">
        <form action={joinGroup} className="panel form">
          <h3>{t.groups.join}</h3>
          <div className="field"><label htmlFor="code">{t.groups.code}</label><input id="code" name="code" maxLength={8} autoCapitalize="characters" autoComplete="off" required /></div>
          <div><button className="btn signal">{t.groups.joinButton}</button></div>
        </form>
        <form action={createGroup} className="panel form">
          <h3>{t.groups.create}</h3>
          <div className="field"><label htmlFor="name">{t.groups.name}</label><input id="name" name="name" maxLength={60} required /></div>
          <div><button className="btn">{t.groups.createButton}</button></div>
          <p className="small muted"><Link href="/rules">{t.social.rulesLink}</Link></p>
        </form>
      </div>
    </Shell>
  );
}
