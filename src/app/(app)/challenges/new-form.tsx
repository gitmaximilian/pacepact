import type { ChallengeKind } from "@/db/schema";
import type { Dictionary } from "@/lib/i18n";
import { METRICS_BY_KIND, TEMPLATES } from "@/lib/social/contests";
import { createContest } from "@/app/(app)/groups/actions";
import { Hidden } from "@/app/(app)/groups/[id]/ui";
import { Seg } from "@/app/components";

const PRIMARY = ["teamMinutes", "planStreak", "duelMinutes"];

/** Template cards (one tap, starting this week) plus a custom form. Used for crew and personal challenges. */
export function NewContest({ t, groupId, opponents }: { t: Dictionary; groupId: string | null; opponents: { id: string; name: string }[] }) {
  const s = t.social;
  const kinds: ChallengeKind[] = groupId ? ["coop", "compete", "duel"] : ["personal"];
  const templates = TEMPLATES.filter((tp) => kinds.includes(tp.kind) && (tp.kind !== "duel" || opponents.length));
  const tx = s.templates as Record<string, string[]>;
  // Crews see three clear picks first; the rest is one tap away.
  const primary = groupId ? templates.filter((tp) => PRIMARY.includes(tp.id)) : templates;
  const others = groupId ? templates.filter((tp) => !PRIMARY.includes(tp.id)) : [];
  const people = opponents.map((o) => ({ value: o.id, label: o.name }));
  const card = (tp: (typeof templates)[number]) => (
    <form key={tp.id} action={createContest} className="template">
      <Hidden v={{ template: tp.id, groupId: groupId ?? "" }} />
      <span className="sticker" aria-hidden="true">{tp.sticker}</span>
      <div className="stack" style={{ gap: 4, minWidth: 0 }}>
        <span className="eyebrow">{s.kinds[tp.kind]} · {tp.weeks} {s.weeksLabel}</span>
        <h3>{tx[tp.id][0]}</h3>
        <p className="small muted">{tx[tp.id][1]}</p>
      </div>
      <div className="stack" style={{ gap: 10, gridColumn: "1 / -1" }}>
        {tp.kind === "duel" ? <Seg name="opponent" label={s.opponent} options={people} /> : null}
        <button className="btn signal small" style={{ alignSelf: "flex-end" }}>{s.create}</button>
      </div>
    </form>
  );
  const metrics = [...new Set(kinds.flatMap((k) => METRICS_BY_KIND[k]))].filter((mt) => mt !== "longRun");
  return (
    <>
      <div className="templates">{primary.map(card)}</div>
      {others.length ? (
        <details className="panel">
          <summary><strong>{s.moreTemplates}</strong></summary>
          <div className="templates" style={{ marginTop: 12 }}>{others.map(card)}</div>
        </details>
      ) : null}

      <details className="panel">
        <summary><strong>{s.custom}</strong></summary>
        <form action={createContest} className="form" style={{ marginTop: 12 }}>
          <Hidden v={{ groupId: groupId ?? "" }} />
          {kinds.length > 1 ? <Seg name="kind" label={s.kindLabel} options={kinds.map((k) => ({ value: k, label: s.kinds[k] }))} /> : <Hidden v={{ kind: kinds[0] }} />}
          <Seg name="metric" label={s.metricLabel} options={metrics.map((mt) => ({ value: mt, label: s.metrics[mt] }))} />
          <div className="fields two">
            <div className="field"><label htmlFor="target">{s.targetLabel}</label><input id="target" name="target" inputMode="decimal" required /></div>
            <div className="field"><label htmlFor="weeks">{s.weeksLabel}</label><input id="weeks" name="weeks" type="number" inputMode="numeric" min={1} max={12} defaultValue={4} required /></div>
          </div>
          <Seg name="start" label={s.startLabel} options={[{ value: "this", label: s.startThis }, { value: "next", label: s.startNext }]} />
          {groupId && people.length ? <Seg name="opponent" label={`${s.opponent} (${s.kinds.duel})`} options={people} /> : null}
          <div className="field"><label htmlFor="title">{s.titleLabel}</label><input id="title" name="title" maxLength={60} /></div>
          <div><button className="btn">{s.create}</button></div>
        </form>
      </details>
      <p className="small muted">{s.guard}</p>
    </>
  );
}

export function contestError(t: Dictionary, e: string | null): string | null {
  if (!e) return null;
  return e === "baseline" ? t.social.errBaseline : e === "opponent" ? t.social.errOpponent : e === "rate" ? t.social.errRate : t.social.errInput;
}
