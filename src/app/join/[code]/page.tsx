import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { currentUser, rateLimit } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { MAX_MEMBERS, normalizeCode } from "@/lib/social/join";
import { joinGroup } from "@/app/(app)/groups/actions";
import { LangSwitch, LegalFooter, Logo } from "../../components";
import { Icon } from "../../icons";

export const metadata = { title: "Join a crew", robots: { index: false } };

/** Invite link target: shows the crew and joins with one tap (or after sign-up). */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  const { t, locale } = await getT();
  const user = await currentUser();
  const ip = (await headers()).get("cf-connecting-ip") ?? "local";
  const allowed = await rateLimit(`joinpage:${user?.id ?? ip}`, 60, 3600_000);
  const db = await getDb();
  const [group] = allowed && code.length === 6 ? await db.select().from(schema.groups).where(eq(schema.groups.inviteCode, code)).limit(1) : [];
  const [count] = group
    ? await db.select({ n: sql<number>`count(*)` }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, group.id))
    : [{ n: 0 }];
  if (group && user) {
    const [already] = await db
      .select({ u: schema.groupMembers.userId })
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, group.id), eq(schema.groupMembers.userId, user.id)))
      .limit(1);
    if (already) redirect(`/groups/${group.id}`);
  }
  const full = (count?.n ?? 0) >= MAX_MEMBERS;
  return (
    <>
      <div className="track gutter" style={{ paddingBlock: 18 }}>
        <div className="wrap row" style={{ justifyContent: "space-between" }}>
          <Link href="/" className="brand"><Logo size={30} /> Pacepact</Link>
          <LangSwitch locale={locale} back={`/join/${code}`} />
        </div>
      </div>
      <main className="gutter">
        <div className="auth panel join-card">
          {group && !full ? (
            <>
              <span className="eyebrow">{t.social.eyebrow} · {fmt(t.social.joinSub, { n: count.n })}</span>
              <h1>{group.name}</h1>
              {group.raceName ? <p className="muted"><Icon name="flag" size={16} /> {fmt(t.social.joinRace, { race: group.raceName })}</p> : null}
              <p className="small muted">{t.landing.f2d}</p>
              {user ? (
                <form action={joinGroup}>
                  <input type="hidden" name="code" value={code} />
                  <button className="btn signal" style={{ width: "100%" }}>{t.social.joinCta}</button>
                </form>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  <Link className="btn signal" href={`/signup?join=${code}`}>{t.social.signupCta}</Link>
                  <Link className="btn ghost" href={`/signin?next=${encodeURIComponent(`/join/${code}`)}`}>{t.social.signinCta}</Link>
                </div>
              )}
              <p className="small"><Link href="/rules">{t.social.rulesLink}</Link> · <Link href="/privacy">{t.legal.privacy}</Link></p>
            </>
          ) : (
            <>
              <h2>{t.social.eyebrow}</h2>
              <p>{full ? t.social.joinFull : t.social.joinInvalid}</p>
              <Link className="btn" href={user ? "/groups" : "/"}>{t.common.back}</Link>
            </>
          )}
        </div>
      </main>
      <LegalFooter t={t} />
    </>
  );
}
