import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contest, Reaction } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { formatKm, formatPace, paceSecPerKm } from "@/lib/pace";
import { appUrl } from "@/lib/app-url";
import { param, type SearchParams } from "@/lib/queries";
import { contestEnd, evaluate } from "@/lib/social/contests";
import { currentWeek, feedMilestones, feedRuns, finalizeDue, groupMembers, memberData, membership, milestoneId } from "@/lib/social/groups";
import { crewStats, fourWeeks, sortStats, STAT_KEYS, STAT_PERIODS, statWeeks, topMilestones, weekLanes, weekSummary, type StatKey, type StatPeriod } from "@/lib/social/overview";
import { sourceKind } from "@/lib/social/sources";
import { addWeeks, weekKey, weekRange } from "@/lib/social/weeks";
import { LEGAL } from "@/lib/legal";
import {Flash, Seg} from "@/app/components";
import { Icon } from "@/app/icons";
import {
  deleteContest, deleteGroup, dismissReports, deleteComment, leaveGroup, removeMember, rotateInviteCode, saveGroupSettings, saveSharing,
} from "@/app/(app)/groups/actions";
import { ConfirmButton, ShareInvite } from "@/app/(app)/groups/client";
import { CrewSwitch, RememberCrew } from "@/app/(app)/groups/[id]/switch";
import { Avatar, ContestCard, contestTitle, Hidden, Interactions, STICKER, stickerOf, type Social } from "@/app/(app)/groups/[id]/ui";

export const metadata = { title: "Crew" };

const TABS = ["overview", "stats", "challenges", "crew"] as const;
type Tab = (typeof TABS)[number];
const DAY = 86400_000;

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const { t, locale } = await getT();
  const s_ = t.social;
  const m = await membership(id, user.id);
  if (!m) notFound();
  const { group, me } = m;
  const isOwner = group.ownerId === user.id;
  const tabParam = param(sp, "tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "overview";
  const db = await getDb();
  const lc = locale === "de" ? "de-AT" : "en-GB";
  const dateFmt = new Intl.DateTimeFormat(lc, { day: "numeric", month: "short", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat(lc, { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Vienna" });

  const [members, myCrews] = await Promise.all([
    groupMembers(id),
    db
      .select({ id: schema.groups.id, name: schema.groups.name })
      .from(schema.groupMembers)
      .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
      .where(eq(schema.groupMembers.userId, user.id))
      .orderBy(schema.groupMembers.joinedAt),
  ]);
  const names = new Map(members.map((x) => [x.id, x.name]));
  const memberIds = members.map((x) => x.id);
  const cw = currentWeek();
  const prepStart = weekKey(group.createdAt);
  const statPeriod: StatPeriod = (STAT_PERIODS as readonly string[]).includes(param(sp, "p") ?? "") ? (param(sp, "p") as StatPeriod) : "month";
  const statKey: StatKey = (STAT_KEYS as readonly string[]).includes(param(sp, "s") ?? "") ? (param(sp, "s") as StatKey) : "runs";
  // Statistics may need older weeks; everything else reads at most half a year.
  const fromWeek = tab === "stats" && statPeriod === "all" ? "2000-01-03" : [prepStart, addWeeks(cw, tab === "stats" ? -51 : -26)].sort()[0];
  const data = await memberData(members, group.onlyImported ? "device" : "all", fromWeek);
  const dataOf = new Map(data.map((d) => [d.userId, d]));
  const shareDistance = new Map(members.map((x) => [x.id, x.shareDistance]));

  // Challenges of this crew (plus finished personal ones of members, for the feed).
  const contests = await db.select().from(schema.contests).where(eq(schema.contests.groupId, id)).orderBy(desc(schema.contests.createdAt)).limit(40);
  await finalizeDue(contests, async (ids) => data.filter((d) => ids.includes(d.userId)));
  const entries = contests.length
    ? await db.select().from(schema.contestEntries).where(inArray(schema.contestEntries.contestId, contests.map((c) => c.id)))
    : [];
  const entriesOf = (c: Contest) => entries.filter((e) => e.contestId === c.id && memberIds.includes(e.userId));
  const outcomeOf = (c: Contest) =>
    c.status === "active" ? evaluate(c, entriesOf(c).filter((e) => e.status === "accepted").map((e) => dataOf.get(e.userId)!).filter(Boolean)) : null;
  const today = new Date().toISOString().slice(0, 10);
  const myInvites = contests.filter((c) => c.status === "active" && entriesOf(c).some((e) => e.userId === user.id && e.status === "invited"));

  // Feed, kudos and comments (overview only, to keep the page light).
  let feed: { at: Date; key: string; node: React.ReactNode }[] = [];
  let since: { runs: number; kudos: number; comments: number } | null = null;
  let social: Social | null = null;
  let reported: { id: string; body: string; userId: string; reports: number }[] = [];
  if (tab === "overview") {
    const [runs, allMs, personal] = await Promise.all([
      feedRuns(members),
      feedMilestones(members),
      db
        .select({ c: schema.contests, e: schema.contestEntries })
        .from(schema.contests)
        .innerJoin(schema.contestEntries, eq(schema.contestEntries.contestId, schema.contests.id))
        .where(and(isNull(schema.contests.groupId), eq(schema.contests.status, "done"), inArray(schema.contests.createdBy, memberIds)))
        .limit(40),
    ]);
    const ms = topMilestones(allMs);
    const recentDone = contests.filter((c) => c.status === "done" && contestEnd(c) >= new Date(Date.now() - 21 * DAY).toISOString().slice(0, 10));
    const personalDone = personal.filter(({ c, e }) => e.badge && e.userId === c.createdBy && contestEnd(c) >= new Date(Date.now() - 21 * DAY).toISOString().slice(0, 10));
    const targetIds = [...runs.map((r) => r.id), ...ms.map(milestoneId), ...recentDone.map((c) => c.id), ...personalDone.map(({ c }) => c.id)];
    const [reacts, comms, myReports] = targetIds.length
      ? await Promise.all([
          db.select().from(schema.reactions).where(and(eq(schema.reactions.groupId, id), inArray(schema.reactions.targetId, targetIds))),
          db.select().from(schema.comments).where(and(eq(schema.comments.groupId, id), inArray(schema.comments.targetId, targetIds))).orderBy(schema.comments.createdAt),
          db.select({ c: schema.reports.commentId }).from(schema.reports).where(eq(schema.reports.reporterId, user.id)),
        ])
      : [[], [], []];
    social = {
      reactions: new Map(),
      comments: new Map(),
      names,
      me: user.id,
      isOwner,
      reportedByMe: new Set(myReports.map((r) => r.c)),
    };
    for (const r of reacts) social.reactions.set(r.targetId, [...(social.reactions.get(r.targetId) ?? []), { emoji: r.emoji as Reaction, userId: r.userId }]);
    for (const c of comms) social.comments.set(c.targetId, [...(social.comments.get(c.targetId) ?? []), { ...c, reports: 0 }]);

    const last = me.lastSeenAt?.getTime() ?? me.joinedAt.getTime();
    const mineIds = new Set([...runs.filter((r) => r.userId === user.id).map((r) => r.id), ...ms.filter((x) => x.userId === user.id).map(milestoneId)]);
    since = {
      runs: runs.filter((r) => r.userId !== user.id && r.startedAt.getTime() > last).length,
      kudos: reacts.filter((r) => mineIds.has(r.targetId) && r.userId !== user.id && r.createdAt.getTime() > last).length,
      comments: comms.filter((c) => mineIds.has(c.targetId) && c.userId !== user.id && c.createdAt.getTime() > last).length,
    };

    const S = social;
    feed = [
      ...runs.map((r) => {
        const showKm = r.userId === user.id || shareDistance.get(r.userId);
        const showPace = r.userId === user.id || members.find((x) => x.id === r.userId)?.sharePace;
        const showHr = (r.userId === user.id || members.find((x) => x.id === r.userId)?.shareHr) && r.avgHr != null;
        const kind = sourceKind(r.source);
        return {
          at: r.startedAt,
          key: r.id,
          node: (
            <>
              <div className="who-line">
                <Avatar id={r.userId} name={names.get(r.userId) ?? "?"} />
                <div style={{ minWidth: 0 }}>
                  <b>{names.get(r.userId)}</b> <span className="muted small">· {timeFmt.format(r.startedAt)}</span>
                  <div className="run-line">
                    {r.runType !== "other" ? <span className="lane-chip">{t.runTypes[r.runType]}</span> : null}
                    <span className="num">{Math.round(r.durationSec / 60)} {s_.minutes}</span>
                    {showKm && r.distanceKm > 0 ? <span className="num">{formatKm(r.distanceKm, locale, 1)} km</span> : null}
                    {showPace && r.distanceKm > 0 ? <span className="num">{formatPace(paceSecPerKm(r.durationSec, r.distanceKm))} /km</span> : null}
                    {showHr ? <span className="num hr" title={s_.avgHrTitle}><span aria-hidden="true">❤️</span> {r.avgHr}<small> bpm</small></span> : null}
                    {r.walkBreaks ? <span className="small muted">{s_.walk}</span> : null}
                    <span className={`src ${kind}`} title={kind === "device" ? s_.deviceTitle : s_.manualTitle}>{kind === "device" ? "⌚ Apple Health" : `✍️ ${s_.manual}`}</span>
                  </div>
                </div>
              </div>
              <Interactions t={t} groupId={id} type="run" id={r.id} s={S} timeFmt={timeFmt} />
            </>
          ),
        };
      }),
      ...ms.map((x) => ({
        at: x.achievedAt,
        key: milestoneId(x),
        node: (
          <>
            <div className="who-line milestone">
              <span className="sticker sm" aria-hidden="true">{x.kind === "continuous" ? "🫁" : x.kind === "distance" ? "📏" : "⏱️"}</span>
              <div><b>{names.get(x.userId)}</b> {fmt(x.kind === "continuous" ? s_.msContinuous : x.kind === "distance" ? s_.msDistance : s_.msTest, { v: x.value })}</div>
            </div>
            <Interactions t={t} groupId={id} type="milestone" id={milestoneId(x)} s={S} timeFmt={timeFmt} />
          </>
        ),
      })),
      ...[...recentDone, ...personalDone.map(({ c }) => c)].map((c) => {
        const es = c.groupId ? entriesOf(c) : personal.filter((p) => p.c.id === c.id).map((p) => p.e);
        const winners = es.filter((e) => e.badge).map((e) => `${STICKER[e.badge!] ?? ""} ${names.get(e.userId) ?? ""}`).join(", ");
        return {
          at: new Date(`${contestEnd(c)}T20:00:00Z`),
          key: c.id,
          node: (
            <>
              <div className="who-line milestone">
                <span className="sticker sm" aria-hidden="true">{stickerOf(c)}</span>
                <div>
                  <b>{fmt(s_.contestDone, { title: contestTitle(t, c) })}</b>
                  <div className="small">{winners || s_.noSticker}</div>
                </div>
              </div>
              <Interactions t={t} groupId={id} type="contest" id={c.id} s={S} timeFmt={timeFmt} />
            </>
          ),
        };
      }),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 30);

    if (!me.lastSeenAt || Date.now() - me.lastSeenAt.getTime() > 10 * 60_000) {
      await db
        .update(schema.groupMembers)
        .set({ lastSeenAt: new Date() })
        .where(and(eq(schema.groupMembers.groupId, id), eq(schema.groupMembers.userId, user.id)));
    }
  }
  if (tab === "crew" && isOwner) {
    const rows = await db
      .select({ id: schema.comments.id, body: schema.comments.body, userId: schema.comments.userId, r: schema.reports.reporterId })
      .from(schema.reports)
      .innerJoin(schema.comments, eq(schema.comments.id, schema.reports.commentId))
      .where(eq(schema.comments.groupId, id));
    const byId = new Map<string, { id: string; body: string; userId: string; reports: number }>();
    for (const r of rows) byId.set(r.id, { ...r, reports: (byId.get(r.id)?.reports ?? 0) + 1 });
    reported = [...byId.values()];
  }

  const inviteUrl = `${appUrl()}/join/${group.inviteCode}`;
  const daysToRace = group.raceDate ? Math.ceil((new Date(`${group.raceDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY) : null;
  const tabHref = (v: Tab) => `/groups/${id}${v === "overview" ? "" : `?tab=${v}`}`;
  const flash =
    param(sp, "joined") ? s_.joined : param(sp, "new") ? s_.created : null;
  const saved = !!param(sp, "saved");

  // This week's lanes
  const memberOf = new Map(members.map((x) => [x.id, x]));
  const rawLanes = weekLanes(data, cw);
  const lanes = rawLanes.map((l) => ({ m: memberOf.get(l.userId)!, c: l.c }));
  const summary = weekSummary(rawLanes, user.id);
  const wt = dataOf.get(user.id) ? lanes.find((l) => l.m.id === user.id)?.c.target : lanes[0]?.c.target;
  const table = tab === "overview" ? fourWeeks(data, cw, weekRange(fromWeek, cw)) : [];
  const myActive = contests.filter((c) => c.status === "active" && !myInvites.includes(c) && entriesOf(c).some((e) => e.userId === user.id && e.status === "accepted"));

  const countdown =
    group.raceDate && daysToRace != null && daysToRace >= 0
      ? daysToRace === 0
        ? fmt(s_.raceDay, { race: group.raceName ?? "" })
        : `${daysToRace} ${fmt(daysToRace === 1 ? s_.countdownOne : s_.countdown, { race: group.raceName ?? "" })}`
      : null;
  const logHref = `/runs/new?back=${encodeURIComponent(`/groups/${id}`)}`;

  return (
    <>
      <RememberCrew id={id} />
      <header className="crew-head">
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">
            {countdown ? <span className="nowrap"><Icon name="flag" size={13} /> {countdown}</span> : members.length === 1 ? s_.runnersOne : fmt(s_.runners, { n: members.length })}
          </span>
          <CrewSwitch current={{ id, name: group.name }} crews={myCrews} labels={{ switch: s_.switchCrew, more: s_.newOrJoin }} />
        </div>
        <ShareInvite url={inviteUrl} text={fmt(s_.inviteText, { name: group.name })} labels={{ share: s_.invite, copy: s_.copy, copied: s_.copied }} compact />
      </header>

      <Flash ok={flash} />

      <nav className="tabs" aria-label={s_.eyebrow}>
        {TABS.map((v) => (
          <Link key={v} href={tabHref(v)} aria-current={tab === v ? "page" : undefined} scroll={false}>
            {s_.tabs[v]}
            {v === "challenges" && myInvites.length ? <span className="dot">{myInvites.length}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <>
          <section className="panel week-board">
            <div className="week-head">
              <div>
                <span className="big-num num">{summary.ran}<span className="of">/{summary.total}</span></span>
                <span className="big-label">{s_.ranThisWeek}</span>
              </div>
              {wt?.raceWeek ? <span className="pill">{s_.raceWeek}</span> : wt?.taper ? <span className="pill">{s_.taper}</span> : wt?.lighter ? <span className="pill">{s_.lighter}</span> : null}
            </div>
            {summary.me ? (
              <p className={`you-line${summary.me.met ? " done" : ""}`} role={saved ? "status" : undefined}>
                {saved ? <><span className="saved-tag">✓ {s_.runSaved}</span>{" "}</> : null}
                <b>{s_.youLabel}:</b>{" "}
                {summary.me.met
                  ? s_.youDone
                  : summary.me.target - summary.me.runs === 1
                    ? s_.youToGoOne
                    : fmt(s_.youToGo, { n: summary.me.target - summary.me.runs })}
                {" · "}
                {fmt(s_.youPlace, { n: summary.me.place })}
              </p>
            ) : null}
            <ol className="lanes">
              {lanes.map(({ m: x, c }, i) => (
                <li key={x.id} className={`${c.met ? "met" : ""}${x.id === user.id ? " me" : ""}`}>
                  <span className="lane-n">{i + 1}</span>
                  <span className="who"><Avatar id={x.id} name={x.name} size={28} /> <span className="name">{x.id === user.id ? <>{s_.youLabel}<span className="sr-only"> ({x.name})</span></> : x.name}</span></span>
                  <span className="dots" role="img" aria-label={fmt(s_.runsOf, { n: c.runs, of: c.target.runs })}>
                    {Array.from({ length: c.target.runs }, (_, k) => <span key={k} className={k < c.runs ? "on" : ""} />)}
                  </span>
                  <span className="mins num">{Math.round(c.sec / 60)}<small> {s_.minutes}</small></span>
                  {c.met ? <span className="check" title={s_.weekDone} aria-label={s_.weekDone}>✓</span> : <span className="check off" />}
                </li>
              ))}
            </ol>
            {summary.me && !summary.me.met ? <Link href={logHref} className="btn signal block">{s_.logRun}</Link> : null}
          </section>

          {since && (since.runs || since.kudos || since.comments || myInvites.length) ? (
            <p className="since">
              <b>{s_.since}:</b>{" "}
              {[
                since.runs ? (since.runs === 1 ? s_.sinceRunsOne : fmt(s_.sinceRuns, { n: since.runs })) : null,
                since.kudos ? fmt(s_.sinceKudos, { n: since.kudos }) : null,
                since.comments ? (since.comments === 1 ? s_.sinceCommentsOne : fmt(s_.sinceComments, { n: since.comments })) : null,
                myInvites.length ? (myInvites.length === 1 ? s_.sinceInvitesOne : fmt(s_.sinceInvites, { n: myInvites.length })) : null,
              ].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          {myInvites.map((c) => (
            <ContestCard key={c.id} t={t} locale={locale} c={c} outcome={outcomeOf(c)} entries={entriesOf(c)} s={{ names, me: user.id }} dateFmt={dateFmt} showKm={(u) => !!shareDistance.get(u) || u === user.id} />
          ))}

          {members.length > 1 ? (
            <section className="panel">
              <h2 className="h-small">{s_.fourWeeksTitle}</h2>
              <table className="compare">
                <thead>
                  <tr><th scope="col"><span className="sr-only">#</span></th><th scope="col">{s_.runnerCol}</th><th scope="col" className="r">{s_.streakCol}</th><th scope="col" className="r">{s_.minutesCol}</th></tr>
                </thead>
                <tbody>
                  {table.map((r) => (
                    <tr key={r.userId} className={r.userId === user.id ? "me" : undefined}>
                      <td className="rank num">{r.rank}</td>
                      <td className="who">{r.userId === user.id ? s_.youLabel : names.get(r.userId)}</td>
                      <td className="r num">{r.streak}<small> {s_.wk}</small></td>
                      <td className="r num">{r.minutes}<small> {s_.minutes}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted">{s_.fourWeeksHint}{group.onlyImported ? ` ${s_.onlyImportedNote}` : ""}</p>
            </section>
          ) : null}

          {myActive.slice(0, 1).map((c) => (
            <ContestCard key={c.id} t={t} locale={locale} c={c} outcome={outcomeOf(c)} entries={entriesOf(c)} s={{ names, me: user.id }} dateFmt={dateFmt} showKm={(u) => !!shareDistance.get(u) || u === user.id} />
          ))}

          <section className="stack" style={{ gap: 12 }}>
            <h2 className="h-small">{s_.feedTitle}</h2>
            {feed.length ? (
              <ul className="feed">{feed.map((f) => <li key={f.key} className="panel">{f.node}</li>)}</ul>
            ) : (
              <p className="panel muted">{s_.feedEmpty}</p>
            )}
          </section>
        </>
      ) : null}

      {tab === "stats" ? <StatsTab /> : null}
      {tab === "challenges" ? <ChallengesTab /> : null}
      {tab === "crew" ? <CrewTab /> : null}
    </>
  );

  function StatsTab() {
    const first = data.flatMap((d) => [...d.weeks.keys()].filter((w) => (d.weeks.get(w)?.runs ?? 0) > 0)).sort()[0] ?? cw;
    // Longer periods start no earlier than the crew itself: nobody's older history is shown to a crew.
    const weeks = statWeeks(statPeriod, cw, [first, prepStart].sort().reverse()[0]).filter((w) => statPeriod === "week" || statPeriod === "month" || w >= prepStart);
    // Streaks look back from the crew's first logged week (an open-ended range would be cut off).
    const rows = sortStats(crewStats(data, weeks, cw, weekRange([first, fromWeek].sort().reverse()[0], cw), (u) => u === user.id || !!shareDistance.get(u)), statKey);
    const short = (n: string) => { const [a, b] = n.trim().split(/\s+/); return b ? `${a} ${b[0]}.` : a; };
    const href = (p: StatPeriod, k: StatKey) => `/groups/${id}?tab=stats&p=${p}&s=${k}`;
    const fmtKm = (v: number) => v.toLocaleString(lc, { maximumFractionDigits: 1 });
    const cell = (r: (typeof rows)[number], k: StatKey) => {
      const v = r[k];
      if (v == null) return <span className="muted">–</span>;
      return k === "km" ? fmtKm(v) : v;
    };
    return (
      <section className="stack" style={{ gap: 14 }}>
        <div className="seg" role="tablist" aria-label={s_.statPeriod}>
          {STAT_PERIODS.map((p) => (
            <Link key={p} href={href(p, statKey)} role="tab" aria-selected={p === statPeriod} className={`chip${p === statPeriod ? " on" : ""}`} scroll={false} replace>
              {s_.statPeriods[p]}
            </Link>
          ))}
        </div>
        <div className="table-wrap stats-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th scope="col" className="who">{s_.runnerCol}</th>
                {STAT_KEYS.map((k) => (
                  <th key={k} scope="col" className="r" aria-sort={k === statKey ? "descending" : undefined}>
                    <Link href={href(statPeriod, k)} scroll={false} replace className={k === statKey ? "on" : undefined}>
                      {s_.statCols[k]}<span className="unit-h">{s_.statUnits[k]}</span>{k === statKey ? <span aria-hidden="true"> ↓</span> : null}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className={r.userId === user.id ? "me" : undefined}>
                  <td className="who">{r.userId === user.id ? s_.youLabel : short(names.get(r.userId) ?? "–")}</td>
                  {STAT_KEYS.map((k) => <td key={k} className={`r num${k === statKey ? " on" : ""}`}>{cell(r, k)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">{s_.statsHint}{group.onlyImported ? ` ${s_.onlyImportedNote}` : ""}</p>
      </section>
    );
  }

  function ChallengesTab() {
    const active = contests.filter((c) => c.status === "active");
    const done = contests.filter((c) => c.status === "done");
    const del = (c: Contest) =>
      c.createdBy === user.id || isOwner ? (
        <form action={deleteContest} className="right">
          <Hidden v={{ contestId: c.id }} />
          <ConfirmButton message={`${s_.delete}?`} className="linkish">{s_.delete}</ConfirmButton>
        </form>
      ) : null;
    return (
      <section className="stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>{s_.active}</h2>
          <Link href={`/groups/${id}/new`} className="btn signal"><Icon name="plus" size={18} /> {s_.newChallenge}</Link>
        </div>
        {active.length ? (
          active.map((c) => (
            <ContestCard key={c.id} t={t} locale={locale} c={c} outcome={outcomeOf(c)} entries={entriesOf(c)} s={{ names, me: user.id }} dateFmt={dateFmt} showKm={(u) => !!shareDistance.get(u) || u === user.id} footer={del(c)} />
          ))
        ) : (
          <p className="panel muted">{s_.noChallenges}</p>
        )}
        {done.length ? (
          <>
            <h2>{s_.finished} · {s_.recap}</h2>
            {done.map((c) => (
              <ContestCard key={c.id} t={t} locale={locale} c={c} outcome={null} entries={entriesOf(c)} s={{ names, me: user.id }} dateFmt={dateFmt} showKm={(u) => !!shareDistance.get(u) || u === user.id} footer={del(c)} />
            ))}
          </>
        ) : null}
        <p className="small muted">{s_.guard}</p>
      </section>
    );
  }

  function CrewTab() {
    const err = param(sp, "error") === "confirm" ? s_.errConfirm : null;
    return (
      <section className="stack" style={{ gap: 16 }}>
        <Flash err={err} />
        <div className="panel">
          <h3>{s_.inviteTitle}</h3>
          <div className="row">
            <span className="invite">{group.inviteCode}</span>
            <ShareInvite url={inviteUrl} text={fmt(s_.inviteText, { name: group.name })} labels={{ share: s_.share, copy: s_.copy, copied: s_.copied }} />
          </div>
          <p className="small muted">{s_.inviteHint}</p>
          {isOwner ? (
            <form action={rotateInviteCode} className="row">
              <Hidden v={{ groupId: id }} />
              <ConfirmButton message={s_.rotateHint} className="btn ghost small">{s_.rotate}</ConfirmButton>
            </form>
          ) : null}
        </div>

        <div className="panel">
          <h3>{s_.membersTitle}</h3>
          <ul className="members">
            {members.map((x) => (
              <li key={x.id}>
                <Avatar id={x.id} name={x.name} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{x.name}</b> {x.role === "owner" ? <span className="pill">{t.groups.owner}</span> : null}
                  <div className="small muted">
                    {fmt(s_.joinedOn, { date: dateFmt.format(x.joinedAt) })}
                    {group.raceName && x.raceRegistered != null ? ` · ${group.raceName}: ${x.raceRegistered ? `✅ ${s_.raceReg}` : s_.raceNotReg}` : ""}
                  </div>
                </div>
                {isOwner && x.id !== user.id ? (
                  <form action={removeMember}>
                    <Hidden v={{ groupId: id, userId: x.id }} />
                    <ConfirmButton message={s_.removeConfirm} className="btn danger small">{s_.remove}</ConfirmButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <form action={saveSharing} className="panel form">
          <Hidden v={{ groupId: id }} />
          <h3>{s_.sharingTitle}</h3>
          <p className="small muted">{s_.sharingHint}</p>
          <label className="check"><input type="checkbox" name="shareDistance" defaultChecked={me.shareDistance} /> {s_.shareDistance}</label>
          <label className="check"><input type="checkbox" name="sharePace" defaultChecked={me.sharePace} /> {s_.sharePace}</label>
          {user.hrConsentAt ? (
            <label className="check" style={{ alignItems: "flex-start" }}>
              <input type="checkbox" name="shareHr" defaultChecked={me.shareHr} />
              <span>{s_.shareHr} <span className="small muted">{s_.shareHrHint}</span></span>
            </label>
          ) : null}
          {group.raceName ? (
            <Seg name="raceRegistered" label={`${s_.raceRegQ} (${group.raceName})`} value={me.raceRegistered == null ? "" : me.raceRegistered ? "yes" : "no"} options={[{ value: "yes", label: s_.yes }, { value: "no", label: s_.notYet }, { value: "", label: s_.raceRegUnset }]} />
          ) : null}
          <div><button className="btn">{s_.save}</button></div>
        </form>

        {isOwner ? (
          <details className="panel admin" open={reported.length > 0 || !!err}>
            <summary><strong>{s_.adminMore}</strong>{reported.length ? <span className="dot">{reported.length}</span> : null}</summary>
            <form action={saveGroupSettings} className="form">
              <Hidden v={{ groupId: id }} />
              <h3>{s_.settingsTitle}</h3>
              <div className="fields">
                <div className="field"><label htmlFor="gname">{s_.groupName}</label><input id="gname" name="name" defaultValue={group.name} maxLength={60} required /></div>
                <div className="field"><label htmlFor="raceName">{s_.raceName}</label><input id="raceName" name="raceName" defaultValue={group.raceName ?? ""} maxLength={80} /></div>
                <div className="field"><label htmlFor="raceDate">{s_.raceDate}</label><input id="raceDate" name="raceDate" type="date" defaultValue={group.raceDate ?? ""} /></div>
              </div>
              <label className="check"><input type="checkbox" name="onlyImported" defaultChecked={group.onlyImported} /> {s_.onlyImported}</label>
              <div><button className="btn">{s_.save}</button></div>
            </form>
            <div className="stack" style={{ gap: 10 }}>
              <h3>{s_.reportsTitle}</h3>
              {reported.length ? (
                <ul className="members">
                  {reported.map((r) => (
                    <li key={r.id}>
                      <div style={{ flex: 1, minWidth: 0 }}><b>{names.get(r.userId) ?? "–"}</b> {r.body} <span className="pill">{r.reports}×</span></div>
                      <form action={dismissReports}><Hidden v={{ groupId: id, commentId: r.id }} /><button className="btn ghost small">{s_.keep}</button></form>
                      <form action={deleteComment}><Hidden v={{ groupId: id, commentId: r.id }} /><button className="btn danger small">{s_.delete}</button></form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">{s_.noReports}</p>
              )}
            </div>
            <form action={deleteGroup} className="form danger-zone">
              <Hidden v={{ groupId: id }} />
              <h3>{s_.deleteTitle}</h3>
              <p className="small muted">{s_.deleteHint}</p>
              <input name="confirm" placeholder={group.name} aria-label={s_.groupName} autoComplete="off" />
              <div><button className="btn danger">{s_.deleteBtn}</button></div>
            </form>
          </details>
        ) : null}

        <form action={leaveGroup}>
          <Hidden v={{ groupId: id }} />
          <ConfirmButton message={s_.leaveConfirm} className="btn danger">{s_.leave}</ConfirmButton>
        </form>
        <p className="small muted"><Link href="/rules">{s_.rulesLink}</Link> · {fmt(s_.rulesContact, { email: LEGAL.email })}</p>
      </section>
    );
  }
}
