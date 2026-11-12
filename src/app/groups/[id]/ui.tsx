import Link from "next/link";
import type { ReactNode } from "react";
import { REACTIONS, type Contest, type Reaction, type TargetType } from "@/db/schema";
import { fmt, type Dictionary } from "@/lib/i18n";
import { contestEnd, template, type Outcome } from "@/lib/social/contests";
import { addComment, deleteComment, reportComment, respondContest, toggleReaction } from "../actions";

export const EMOJI: Record<Reaction, string> = { clap: "👏", fire: "🔥", strong: "💪", party: "🎉" };
export const STICKER: Record<string, string> = { team: "🤝", gold: "🥇", finisher: "🏁", duel: "⚔️", draw: "🤜🤛", personal: "⭐" };

const HUES = [214, 4, 152, 38, 268, 190, 330, 96];
export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, ["--hue" as string]: HUES[h % HUES.length] }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Hidden({ v }: { v: Record<string, string> }) {
  return <>{Object.entries(v).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}</>;
}

export interface Social {
  reactions: Map<string, { emoji: Reaction; userId: string }[]>;
  comments: Map<string, { id: string; userId: string; body: string; createdAt: Date; reports: number }[]>;
  names: Map<string, string>;
  me: string;
  isOwner: boolean;
  reportedByMe: Set<string>;
}

/** Kudos bar and comments under a feed item. */
export function Interactions({ t, groupId, type, id, s, timeFmt }: { t: Dictionary; groupId: string; type: TargetType; id: string; s: Social; timeFmt: Intl.DateTimeFormat }) {
  const rs = s.reactions.get(id) ?? [];
  const cs = s.comments.get(id) ?? [];
  const base = { groupId, targetType: type, targetId: id };
  return (
    <div className="interact">
      <div className="kudos">
        {REACTIONS.map((e) => {
          const who = rs.filter((r) => r.emoji === e);
          const mine = who.some((r) => r.userId === s.me);
          return (
            <form key={e} action={toggleReaction}>
              <Hidden v={{ ...base, emoji: e }} />
              <button className={`kudo${mine ? " on" : ""}`} aria-pressed={mine} title={`${t.social.reactions[e]}${who.length ? `: ${who.map((r) => s.names.get(r.userId) ?? "?").join(", ")}` : ""}`}>
                <span aria-hidden="true">{EMOJI[e]}</span>
                {who.length ? <span className="n">{who.length}</span> : <span className="sr-only">{t.social.reactions[e]}</span>}
              </button>
            </form>
          );
        })}
      </div>
      {cs.length ? (
        <ul className="comments">
          {cs.map((c) => (
            <li key={c.id}>
              <b>{s.names.get(c.userId) ?? "–"}</b> {c.body}
              <span className="meta">
                {timeFmt.format(c.createdAt)}
                {c.userId === s.me || s.isOwner ? (
                  <form action={deleteComment}><Hidden v={{ groupId, commentId: c.id }} /><button className="linkish">{t.social.delete}</button></form>
                ) : s.reportedByMe.has(c.id) ? (
                  <span>{t.social.reported}</span>
                ) : (
                  <form action={reportComment}><Hidden v={{ groupId, commentId: c.id }} /><button className="linkish">{t.social.report}</button></form>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <details className="comment-box">
        <summary>{t.social.comment}</summary>
        <form action={addComment} className="row" style={{ gap: 8 }}>
          <Hidden v={base} />
          <input name="body" maxLength={280} required placeholder={t.social.commentPh} aria-label={t.social.comment} style={{ flex: 1, minWidth: 0 }} />
          <button className="btn small">{t.social.send}</button>
        </form>
      </details>
    </div>
  );
}

export function contestTitle(t: Dictionary, c: Pick<Contest, "template" | "title" | "kind" | "metric" | "target">): string {
  if (c.title) return c.title;
  const tpl = c.template ? (t.social.templates as Record<string, string[]>)[c.template] : null;
  if (tpl) return c.template === "longRun10" ? `${tpl[0]} (${c.target} min)` : tpl[0];
  return `${t.social.kinds[c.kind]}: ${c.target} ${t.social.metrics[c.metric]}`;
}

export function stickerOf(c: Pick<Contest, "template">): string {
  return (c.template && template(c.template)?.sticker) || "🏃";
}

const fmtNum = (n: number, locale: string) => new Intl.NumberFormat(locale === "de" ? "de-AT" : "en-GB", { maximumFractionDigits: 1 }).format(n);

/** A challenge card: progress lanes per participant, invitation buttons, recap when done. */
export function ContestCard({
  t,
  locale,
  c,
  outcome,
  entries,
  s,
  dateFmt,
  showKm,
  footer,
}: {
  t: Dictionary;
  locale: string;
  c: Contest;
  outcome: Outcome | null;
  entries: { userId: string; status: string; score: number | null; rank: number | null; badge: string | null }[];
  s: Pick<Social, "names" | "me">;
  dateFmt: Intl.DateTimeFormat;
  showKm: (userId: string) => boolean;
  footer?: ReactNode;
}) {
  const end = contestEnd(c);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = c.startWeek > today;
  const mine = entries.find((e) => e.userId === s.me);
  const unit = t.social.metrics[c.metric];
  const done = c.status === "done";
  const accepted = entries.filter((e) => e.status === "accepted");
  const rows = done
    ? [...accepted].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((e) => ({ userId: e.userId, score: e.score ?? 0, progress: Math.min(1, (e.score ?? 0) / c.target), badge: e.badge }))
    : (outcome?.standings ?? []).map((x) => ({ userId: x.userId, score: x.score, progress: c.kind === "coop" ? 0 : x.progress, badge: null as string | null }));
  const total = done ? accepted.reduce((a, e) => a + (e.score ?? 0), 0) : (outcome?.total ?? 0);
  const value = (userId: string, v: number) => (c.metric === "km" && !showKm(userId) ? "·" : fmtNum(v, locale));
  return (
    <article className={`contest${done ? " done" : ""}`}>
      <header>
        <span className="sticker" aria-hidden="true">{stickerOf(c)}</span>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{t.social.kinds[c.kind]} · {upcoming ? fmt(t.social.starts, { date: dateFmt.format(new Date(c.startWeek)) }) : fmt(t.social.ends, { date: dateFmt.format(new Date(end)) })}</span>
          <h3>{contestTitle(t, c)}</h3>
        </div>
      </header>
      {c.kind === "coop" ? (
        <div className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="num big">{fmtNum(total, locale)}<span className="unit"> / {fmtNum(c.target, locale)} {unit}</span></span>
            {done ? <span className="pill done">{total >= c.target ? `${STICKER.team} ${t.social.badges.team}` : t.social.noSticker}</span> : null}
          </div>
          <div className="progress"><span style={{ width: `${Math.min(100, (total / c.target) * 100)}%` }} /></div>
        </div>
      ) : null}
      <ol className="mini-lanes">
        {rows.map((r, i) => (
          <li key={r.userId} className={r.userId === s.me ? "me" : undefined}>
            <span className="lane-n">{c.kind === "coop" ? i + 1 : (done ? (entries.find((e) => e.userId === r.userId)?.rank ?? i + 1) : i + 1)}</span>
            <span className="who">{s.names.get(r.userId) ?? "–"}</span>
            {c.kind !== "coop" ? <span className="bar"><span style={{ width: `${r.progress * 100}%` }} /></span> : <span />}
            <span className="val">{value(r.userId, r.score)}{c.kind !== "coop" ? <span className="unit"> / {fmtNum(c.target, locale)}</span> : null}</span>
            {r.badge ? <span className="badge" title={(t.social.badges as Record<string, string>)[r.badge]}>{STICKER[r.badge]}</span> : null}
          </li>
        ))}
      </ol>
      {entries.some((e) => e.status !== "accepted") ? (
        <p className="small muted">
          {entries.filter((e) => e.status === "invited").map((e) => s.names.get(e.userId)).filter(Boolean).join(", ")}
          {entries.some((e) => e.status === "invited") ? ` · ${t.social.pending}` : ""}
          {entries.some((e) => e.status === "declined") ? `  ${entries.filter((e) => e.status === "declined").map((e) => s.names.get(e.userId)).join(", ")} · ${t.social.declined}` : ""}
        </p>
      ) : null}
      {!done && mine && mine.status !== "accepted" ? (
        <div className="row invite-row">
          <strong>{t.social.invited}</strong>
          <form action={respondContest}><Hidden v={{ contestId: c.id, answer: "accept" }} /><button className="btn signal small">{t.social.accept}</button></form>
          {mine.status === "invited" ? (
            <form action={respondContest}><Hidden v={{ contestId: c.id, answer: "decline" }} /><button className="btn ghost small">{t.social.decline}</button></form>
          ) : null}
        </div>
      ) : null}
      {footer}
    </article>
  );
}

export function Chips<T extends string>({ items, current, href, label }: { items: readonly T[]; current: T; href: (v: T) => string; label: (v: T) => string }) {
  return (
    <div className="chips" role="tablist">
      {items.map((v) => (
        <Link key={v} href={href(v)} role="tab" aria-selected={v === current} className={`chip${v === current ? " on" : ""}`} scroll={false}>
          {label(v)}
        </Link>
      ))}
    </div>
  );
}
