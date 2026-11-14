"use client";

import { useContext, useState, type ReactNode } from "react";
import { BoardCtx, Trend } from "@/app/charts";
import { formatPace } from "@/lib/pace";
import { paceRange } from "@/lib/social/charts";

/**
 * Follow one runner (and pick a view) across the charts without a server round trip:
 * the charts read both from this board.
 */
export function ChartBoard({ me, mode: initialMode = "", children }: { me: string; mode?: string; children: ReactNode }) {
  const [focus, setFocus] = useState(me);
  const [mode, setMode] = useState(initialMode);
  return (
    <BoardCtx.Provider value={{ focus, me, mode, setFocus, setMode }}>
      <div className="chart-board">{children}</div>
    </BoardCtx.Provider>
  );
}

export function ModeSwitch({ modes, label }: { modes: { id: string; label: string }[]; label: string }) {
  const c = useContext(BoardCtx);
  return (
    <div className="seg mini-seg" role="group" aria-label={label}>
      {modes.map((m) => (
        <button key={m.id} type="button" className={`chip${m.id === c?.mode ? " on" : ""}`} aria-pressed={m.id === c?.mode} onClick={() => c?.setMode(m.id)}>{m.label}</button>
      ))}
    </div>
  );
}

/** Legend entry for the followed runner (only while following someone else). */
export function FocusName({ names }: { names: Record<string, string> }) {
  const c = useContext(BoardCtx);
  if (!c || c.focus === c.me) return null;
  return <li><span className="key line focus" />{names[c.focus]}</li>;
}

/** Tap a name to follow that runner; tap again (or your own name) to go back to yourself. */
export function PeopleChips({ people, label }: { people: { id: string; label: string }[]; label: string }) {
  const c = useContext(BoardCtx);
  return (
    <div className="people-chips" role="group" aria-label={label}>
      {people.map((p) => {
        const on = p.id === c?.focus;
        return (
          <button key={p.id} type="button" className={`chip${on ? " on" : ""}${p.id === c?.me ? " me" : ""}`} aria-pressed={on} onClick={() => c?.setFocus(on ? c.me : p.id)}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export interface FocusText { title: string; titleYou: string; pace: string; paceHint: string; longest: string; longestHint: string; noData: string; min: string }

/**
 * The followed runner's own trend (pace and longest run), drawn from a few numbers per runner,
 * so following someone needs no server round trip. Never a comparison between runners.
 */
export function FocusPanel({ trends, names, xLabels, when, text }: { trends: Record<string, { pace: (number | null)[]; longest: (number | null)[] }>; names: Record<string, string>; xLabels: string[]; when: string[]; text: FocusText }) {
  const c = useContext(BoardCtx);
  const id = c?.focus ?? "";
  const t = trends[id];
  const title = id === c?.me ? text.titleYou : text.title.replace("{name}", names[id] ?? "");
  const hasPace = !!t && t.pace.filter((v) => v != null).length >= 2;
  const hasLong = !!t && t.longest.filter((v) => v != null).length >= 2;
  const range = hasPace ? paceRange(t.pace) ?? undefined : undefined;
  return (
    <section className={`panel chart-panel${id !== c?.me ? " other" : ""}`}>
      <h3 aria-live="polite">{title}</h3>
      {!hasPace && !hasLong ? <p className="muted small">{text.noData}</p> : null}
      <div className="trend-pair">
        {hasPace ? (
          <div>
            <h4 className="chart-h">{text.pace} <span className="muted">/km</span></h4>
            <Trend key={`p${id}`} values={t.pace} xLabels={xLabels} hint={text.paceHint} tips={t.pace.map((v, i) => (v == null ? when[i] : `${when[i]}: ${formatPace(v)} /km`))} label={`${title}: ${text.pace}`} fmtY={formatPace} invert range={range} />
          </div>
        ) : null}
        {hasLong ? (
          <div>
            <h4 className="chart-h">{text.longest} <span className="muted">{text.min}</span></h4>
            <Trend key={`l${id}`} values={t.longest} xLabels={xLabels} hint={text.longestHint} tips={t.longest.map((v, i) => (v == null ? when[i] : `${when[i]}: ${v} ${text.min}`))} label={`${title}: ${text.longest}`} fmtY={(v) => String(Math.round(v))} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
