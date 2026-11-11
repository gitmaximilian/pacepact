import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { param, type SearchParams } from "@/lib/queries";
import { createGroup, joinGroup } from "../actions";
import { Flash, Shell } from "../components";

export const metadata = { title: "Groups" };

export default async function GroupsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const error = param(await searchParams, "error");
  const db = await getDb();
  const mine = await db
    .select({ id: schema.groups.id, name: schema.groups.name, role: schema.groupMembers.role })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(eq(schema.groupMembers.userId, user.id));
  return (
    <Shell t={t} locale={locale} active="/groups">
      <h1>{t.groups.title}</h1>
      <Flash err={error === "code" ? t.groups.errCode : error === "name" ? t.groups.errName : null} />
      {mine.length ? (
        <div className="grid">
          {mine.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="panel" style={{ textDecoration: "none" }}>
              <h3>{g.name}</h3>
              <span className="small muted">{g.role === "owner" ? t.groups.owner : t.groups.member}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="panel muted">{t.groups.none}</p>
      )}
      <div className="grid">
        <form action={joinGroup} className="panel form">
          <h3>{t.groups.join}</h3>
          <div className="field"><label htmlFor="code">{t.groups.code}</label><input id="code" name="code" maxLength={8} autoCapitalize="characters" required /></div>
          <div><button className="btn signal">{t.groups.joinButton}</button></div>
        </form>
        <form action={createGroup} className="panel form">
          <h3>{t.groups.create}</h3>
          <div className="field"><label htmlFor="name">{t.groups.name}</label><input id="name" name="name" maxLength={60} required /></div>
          <div><button className="btn">{t.groups.createButton}</button></div>
        </form>
      </div>
    </Shell>
  );
}
