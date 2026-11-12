import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contest, Reaction } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { formatKm, formatPace, paceSecPerKm } from "@/lib/pace";
import { appUrl } from "@/lib/providers/registry";
import { param, type SearchParams } from "@/lib/queries";
import { contestEnd, evaluate } from "@/lib/social/contests";
import { currentWeek, feedMilestones, feedRuns, finalizeDue, groupMembers, memberData, membership, milestoneId } from "@/lib/social/groups";
import { BOARDS, PERIODS, board, countedWeek, type Board, type Period } from "@/lib/social/scoring";
import { sourceKind } from "@/lib/social/sources";
import { addWeeks, weekKey, weekRange } from "@/lib/social/weeks";
import { LEGAL } from "@/lib/legal";
import { Flash, Shell } from "../../components";
import { Icon } from "../../icons";
import {
  deleteContest, deleteGroup, dismissReports, deleteComment, leaveGroup, removeMember, rotateInviteCode, saveGroupSettings, saveSharing,
} from "../actions";
import { ConfirmButton, ShareInvite } from "../client";
import { Avatar, Chips, ContestCard, contestTitle, Hidden, Interactions, STICKER, stickerOf, type Social } from "./ui";

export const metadata = { title: "Crew" };

const TABS = ["overview", "board", "challenges", "crew"] as const;
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

  const members = await groupMembers(id);
  const names = new Map(members.map((x) => [x.id, x.name]));
  const memberIds = members.map((x) => x.id);
  const cw = currentWeek();
  const prepStart = weekKey(group.createdAt);
  const fromWeek = [prepStart, addWeeks(cw, -26)].sort()[0];
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
    const [runs, ms, personal] = await Promise.all([
      feedRuns(members),
      feedMilestones(members),
      db
        .select({ c: schema.contests, e: schema.contestEntries })
        .from(schema.contests)
        .innerJoin(schema.contestEntries, eq(schema.contestEntries.contestId, schema.contests.id))
        .where(and(isNull(schema.contests.groupId), eq(schema.contests.status, "done"), inArray(schema.contests.createdBy, memberIds)))
        .limit(40),
    ]);
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
                    <span className="lane-chip">{t.runTypes[r.runType]}</span>
                    <span className="num">{Math.round(r.durationSec / 60)} {s_.minutes}</span>
                    {showKm && r.distanceKm > 0 ? <span className="num">{formatKm(r.distanceKm, locale, 1)} km</span> : null}
                    {showPace && r.distanceKm > 0 ? <span className="num">{formatPace(paceSecPerKm(r.durationSec, r.distanceKm))} /km</span> : null}
                    {r.walkBreaks ? <span className="small muted">{s_.walk}</span> : null}
                    <span className={`src ${kind}`} title={kind === "device" ? s_.deviceTitle : s_.manualTitle}>{kind === "device" ? `⌚ ${r.source === "apple-health" ? "Apple Health" : s_.device}` : `✍️ ${s_.manual}`}</span>
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

  // This week's lanes
  const lanes = members.map((x) => {
    const d = dataOf.get(x.id)!;
    const c = countedWeek(d, cw, d.weeks.get(cw));
    return { m: x, c, raw: d.weeks.get(cw) };
  });
  lanes.sort((a, b) => Number(b.c.met) - Number(a.c.met) || b.c.runs - a.c.runs || b.c.sec - a.c.sec);
  const wt = lanes[0]?.c.target;

  return (
    <Shell t={t} locale={locale} active="/groups">
      <section className="crew-hero track">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow light">{s_.eyebrow} · {fmt(s_.runners, { n: members.length })}</span>
            <h1>{group.name}</h1>
          </div>
          <div className="avatars" aria-hidden="true">
            {members.slice(0, 6).map((x) => <Avatar key={x.id} id={x.id} name={x.name} size={34} />)}
            {members.length > 6 ? <span className="avatar more">+{members.length - 6}</span> : null}
          </div>
        </div>
        {group.raceDate && daysToRace != null && daysToRace >= 0 ? (
          <div className="countdown">
            <Icon name="flag" size={18} />
            {daysToRace === 0 ? fmt(s_.raceDay, { race: group.raceName ?? "" }) : <><span className="num">{daysToRace}</span> {fmt(daysToRace === 1 ? s_.countdownOne : s_.countdown, { race: group.raceName ?? "" })}</>}
          </div>
        ) : null}
        <div className="row">
          <ShareInvite url={inviteUrl} text={fmt(s_.inviteText, { name: group.name })} labels={{ share: s_.invite, copy: s_.copy, copied: s_.copied }} />
          <Link href={`/runs/new?back=${encodeURIComponent(`/groups/${id}`)}`} className="btn ghost-light">{s_.logRun}</Link>
        </div>
      </section>

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
          {since && (since.runs || since.kudos || since.comments || myInvites.length) ? (
            <p className="since">
              <b>{s_.since}:</b>{" "}
              {[
                since.runs ? fmt(s_.sinceRuns, { n: since.runs }) : null,
                since.kudos ? fmt(s_.sinceKudos, { n: since.kudos }) : null,
                since.comments ? fmt(s_.sinceComments, { n: since.comments }) : null,
                myInvites.length ? fmt(s_.sinceInvites, { n: myInvites.length }) : null,
              ].filter(Boolean).join(" · ")}
            </p>
          ) : null}

          {myInvites.map((c) => (
            <ContestCard key={c.id} t={t} locale={locale} c={c} outcome={outcomeOf(c)} entries={entriesOf(c)} s={{ names, me: user.id }} dateFmt={dateFmt} showKm={(u) => !!shareDistance.get(u) || u === user.id} />
          ))}

          <section className="panel week-board">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{s_.weekTitle}</h2>
              {wt?.raceWeek ? <span className="pill">{s_.raceWeek}</span> : wt?.taper ? <span className="pill">{s_.taper}</span> : wt?.lighter ? <span className="pill">{s_.lighter}</span> : null}
            </div>
            <ol className="lanes">
              {lanes.map(({ m: x, c }, i) => (
                <li key={x.id} className={`${c.met ? "met" : ""}${x.id === user.id ? " me" : ""}`}>
                  <span className="lane-n">{i + 1}</span>
                  <span className="who"><Avatar id={x.id} name={x.name} size={28} /> <span className="name">{x.name}</span></span>
                  <span className="dots" aria-label={`${c.runs}/${c.target.runs}`}>
                    {Array.from({ length: c.target.runs }, (_, k) => <span key={k} className={k < c.runs ? "on" : ""} />)}
                  </span>
                  <span className="mins num">{Math.round(c.sec / 60)}<small> {s_.minutes}</small></span>
                  {c.met ? <span className="check" title={s_.weekDone}>✓</span> : <span className="check off" />}
                </li>
              ))}
            </ol>
            <p className="small muted">{s_.weekHint}</p>
          </section>

          {contests.filter((c) => c.status === "active" && !myInvites.includes(c) && entriesOf(c).some((e) => e.userId === user.id && e.status === "accepted")).slice(0, 3).map((c) => (
            <ContestCard key={c.id} t={t} locale={locale} c={c} outcome={outcomeOf(c)} entries={entriesOf(c)} s={{ names, me: user.id }} dateFmt={dateFmt} showKm={(u) => !!shareDistance.get(u) || u === user.id} />
          ))}

          <section className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>{s_.feedTitle}</h2>
              <Link href="/rules" className="small">{s_.rulesLink}</Link>
            </div>
            {feed.length ? (
              <ul className="feed">{feed.map((f) => <li key={f.key} className="panel">{f.node}</li>)}</ul>
            ) : (
              <p className="panel muted">{s_.feedEmpty}</p>
            )}
            <p className="small muted">{s_.feedHint} {s_.providerNote}</p>
          </section>
        </>
      ) : null}

      {tab === "board" ? <BoardTab /> : null}
      {tab === "challenges" ? <ChallengesTab /> : null}
      {tab === "crew" ? <CrewTab /> : null}
    </Shell>
  );

  function BoardTab() {
    const b = (BOARDS as readonly string[]).includes(param(sp, "b") ?? "") ? (param(sp, "b") as Board) : "consistency";
    const p = (PERIODS as readonly string[]).includes(param(sp, "p") ?? "") ? (param(sp, "p") as Period) : "month";
    const period = p === "week" ? [cw] : p === "month" ? weekRange(addWeeks(cw, -3), cw) : weekRange(prepStart, cw);
    const rows = board(b, data, period, cw, weekRange(fromWeek, cw));
    const href = (nb: Board, np: Period) => `/groups/${id}?tab=board&b=${nb}&p=${np}`;
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.value ?? 0)));
    const unit = s_.units[b];
    return (
      <section className="stack" style={{ gap: 14 }}>
        <Chips items={BOARDS} current={b} href={(v) => href(v, p)} label={(v) => s_.boards[v]} />
        {b !== "endurance" && b !== "easyPace" ? <Chips items={PERIODS} current={p} href={(v) => href(b, v)} label={(v) => s_.periods[v]} /> : null}
        <p className="small muted">{s_.boardHints[b]}</p>
        <ol className="lanes board">
          {rows.map((r) => {
            const x = members.find((mm) => mm.id === r.userId)!;
            const v = r.value;
            const shown = v == null ? s_.noData : b === "endurance" ? `${v > 0 ? "+" : ""}${v}` : b === "easyPace" ? `${v > 0 ? "+" : ""}${v.toLocaleString(lc)}` : v.toLocaleString(lc);
            return (
              <li key={r.userId} className={`${r.done ? "met" : ""}${r.userId === user.id ? " me" : ""}`}>
                <span className="lane-n">{r.rank ?? "–"}</span>
                <span className="who"><Avatar id={x.id} name={x.name} size={28} /> <span className="name">{x.name}</span></span>
                <span className="bar"><span style={{ width: `${v == null ? 0 : Math.max(4, (Math.abs(v) / max) * 100)}%` }} /></span>
                <span className="val num">{shown}{v != null ? <small> {unit}</small> : null}</span>
                {r.done ? <span className="check" title={s_.onPlan}>✓</span> : <span className="check off" />}
              </li>
            );
          })}
        </ol>
        <p className="small muted">{s_.boardFair} {group.onlyImported ? s_.onlyImportedNote : ""} {s_.providerNote}</p>
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
        <p className="small muted">{s_.guard} {s_.providerNote}</p>
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
              <span className="small muted">{s_.rotateHint}</span>
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
          {group.raceName ? (
            <div className="field">
              <label htmlFor="raceRegistered">{s_.raceRegQ} ({group.raceName})</label>
              <select id="raceRegistered" name="raceRegistered" defaultValue={me.raceRegistered == null ? "" : me.raceRegistered ? "yes" : "no"}>
                <option value="">{s_.raceRegUnset}</option>
                <option value="yes">{s_.yes}</option>
                <option value="no">{s_.notYet}</option>
              </select>
            </div>
          ) : null}
          <div><button className="btn">{s_.save}</button></div>
        </form>

        {isOwner ? (
          <>
            <form action={saveGroupSettings} className="panel form">
              <Hidden v={{ groupId: id }} />
              <h3>{s_.adminTitle} · {s_.settingsTitle}</h3>
              <div className="fields">
                <div className="field"><label htmlFor="gname">{s_.groupName}</label><input id="gname" name="name" defaultValue={group.name} maxLength={60} required /></div>
                <div className="field"><label htmlFor="raceName">{s_.raceName}</label><input id="raceName" name="raceName" defaultValue={group.raceName ?? ""} maxLength={80} /></div>
                <div className="field"><label htmlFor="raceDate">{s_.raceDate}</label><input id="raceDate" name="raceDate" type="date" defaultValue={group.raceDate ?? ""} /></div>
              </div>
              <label className="check"><input type="checkbox" name="onlyImported" defaultChecked={group.onlyImported} /> {s_.onlyImported}</label>
              <div><button className="btn">{s_.save}</button></div>
            </form>
            <div className="panel">
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
          </>
        ) : null}

        <form action={leaveGroup}>
          <Hidden v={{ groupId: id }} />
          <ConfirmButton message={s_.leaveConfirm} className="btn danger">{s_.leave}</ConfirmButton>
        </form>

        {isOwner ? (
          <form action={deleteGroup} className="panel form danger-zone">
            <Hidden v={{ groupId: id }} />
            <h3>{s_.deleteTitle}</h3>
            <p className="small muted">{s_.deleteHint}</p>
            <input name="confirm" placeholder={group.name} aria-label={s_.groupName} autoComplete="off" />
            <div><button className="btn danger">{s_.deleteBtn}</button></div>
          </form>
        ) : null}
        <p className="small muted">{fmt(s_.rulesContact, { email: LEGAL.email })}</p>
      </section>
    );
  }
}
