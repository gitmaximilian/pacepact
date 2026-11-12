import type { ChallengeKind } from "@/db/schema";
import type { Dictionary } from "@/lib/i18n";
import { METRICS_BY_KIND, TEMPLATES } from "@/lib/social/contests";
import { createContest } from "../groups/actions";
import { Hidden } from "../groups/[id]/ui";

/** Template grid (one tap) plus a custom form. Used for crew and personal challenges. */
export function NewContest({ t, groupId, opponents }: { t: Dictionary; groupId: string | null; opponents: { id: string; name: string }[] }) {
  const s = t.social;
  const kinds: ChallengeKind[] = groupId ? ["coop", "compete", "duel"] : ["personal"];
  const templates = TEMPLATES.filter((tp) => kinds.includes(tp.kind) && (tp.kind !== "duel" || opponents.length));
  const tx = s.templates as Record<string, string[]>;
  const startSelect = (
    <select name="start" aria-label={s.startLabel} className="compact">
      <option value="this">{s.startThis}</option>
      <option value="next">{s.startNext}</option>
    </select>
  );
  return (
    <>
      <h2>{s.pickTemplate}</h2>
      <div className="templates">
        {templates.map((tp) => (
          <form key={tp.id} action={createContest} className="template">
            <Hidden v={{ template: tp.id, groupId: groupId ?? "" }} />
            <span className="sticker" aria-hidden="true">{tp.sticker}</span>
            <div className="stack" style={{ gap: 4, minWidth: 0 }}>
              <span className="eyebrow">{s.kinds[tp.kind]} · {tp.weeks} {s.weeksLabel}</span>
              <h3>{tx[tp.id][0]}</h3>
              <p className="small muted">{tx[tp.id][1]}</p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {tp.kind === "duel" ? (
                <select name="opponent" aria-label={s.opponent} className="compact" required>
                  {opponents.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : null}
              {startSelect}
              <button className="btn signal small">{s.create}</button>
            </div>
          </form>
        ))}
      </div>

      <details className="panel">
        <summary><strong>{s.custom}</strong></summary>
        <form action={createContest} className="form" style={{ marginTop: 12 }}>
          <Hidden v={{ groupId: groupId ?? "" }} />
          <div className="fields">
            <div className="field">
              <label htmlFor="kind">{s.kindLabel}</label>
              <select id="kind" name="kind">{kinds.map((k) => <option key={k} value={k}>{s.kinds[k]}</option>)}</select>
            </div>
            <div className="field">
              <label htmlFor="metric">{s.metricLabel}</label>
              <select id="metric" name="metric">
                {[...new Set(kinds.flatMap((k) => METRICS_BY_KIND[k]))].filter((mt) => mt !== "longRun").map((mt) => <option key={mt} value={mt}>{s.metrics[mt]}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="target">{s.targetLabel}</label><input id="target" name="target" inputMode="decimal" required /></div>
            <div className="field"><label htmlFor="weeks">{s.weeksLabel}</label><input id="weeks" name="weeks" type="number" min={1} max={12} defaultValue={4} required /></div>
            <div className="field"><label htmlFor="start">{s.startLabel}</label>{startSelect}</div>
            {groupId && opponents.length ? (
              <div className="field">
                <label htmlFor="opponent">{s.opponent} ({s.kinds.duel})</label>
                <select id="opponent" name="opponent">{opponents.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </div>
            ) : null}
            <div className="field"><label htmlFor="title">{s.titleLabel}</label><input id="title" name="title" maxLength={60} /></div>
          </div>
          <div><button className="btn">{s.create}</button></div>
        </form>
      </details>
      <p className="small muted">{s.guard} {s.testNote}</p>
    </>
  );
}

export function contestError(t: Dictionary, e: string | null): string | null {
  if (!e) return null;
  return e === "baseline" ? t.social.errBaseline : e === "opponent" ? t.social.errOpponent : e === "rate" ? t.social.errRate : t.social.errInput;
}
