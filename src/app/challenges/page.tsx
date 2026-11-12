import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { evaluate } from "@/lib/social/contests";
import { finalizeDue, memberData } from "@/lib/social/groups";
import { addWeeks } from "@/lib/social/weeks";
import { currentWeek } from "@/lib/social/groups";
import { deleteContest } from "../groups/actions";
import { ConfirmButton } from "../groups/client";
import { ContestCard, Hidden } from "../groups/[id]/ui";
import { Shell } from "../components";
import { Icon } from "../icons";

export const metadata = { title: "My challenges" };

export default async function PersonalChallenges() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const db = await getDb();
  const contests = await db
    .select()
    .from(schema.contests)
    .where(and(isNull(schema.contests.groupId), eq(schema.contests.createdBy, user.id)))
    .orderBy(desc(schema.contests.createdAt))
    .limit(30);
  const [me] = await memberData([user], "all", addWeeks(currentWeek(), -30));
  await finalizeDue(contests, async () => [me]);
  const entries = contests.length ? await db.select().from(schema.contestEntries).where(eq(schema.contestEntries.userId, user.id)) : [];
  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const names = new Map([[user.id, user.name]]);
  return (
    <Shell t={t} locale={locale} active="/dashboard">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{t.social.personalTitle}</h1>
        <Link href="/challenges/new" className="btn signal"><Icon name="plus" size={18} /> {t.social.newChallenge}</Link>
      </div>
      <p className="muted">{t.social.personalHint}</p>
      {contests.length ? (
        contests.map((c) => (
          <ContestCard
            key={c.id}
            t={t}
            locale={locale}
            c={c}
            outcome={c.status === "active" ? evaluate(c, [me]) : null}
            entries={entries.filter((e) => e.contestId === c.id)}
            s={{ names, me: user.id }}
            dateFmt={dateFmt}
            showKm={() => true}
            footer={
              <form action={deleteContest} className="right">
                <Hidden v={{ contestId: c.id }} />
                <ConfirmButton message={`${t.social.delete}?`} className="linkish">{t.social.delete}</ConfirmButton>
              </form>
            }
          />
        ))
      ) : (
        <p className="panel muted">{t.social.noChallenges}</p>
      )}
      <p className="small muted">{t.social.guard} {t.social.providerNote}</p>
    </Shell>
  );
}
