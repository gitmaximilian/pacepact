"use client";

/**
 * Small SVG charts. No chart library: plain paths on a fixed viewBox that scales to the column
 * width. Colors come from CSS variables, so dark mode just works. The server sends only numbers
 * and labels; a tap is mapped to its column (or square) from the pointer position, and the value
 * is shown in a line above the chart.
 */
import { createContext, useContext, useState, type PointerEvent } from "react";
import { CELL_STATES, cellFill, niceMax as nice } from "@/lib/social/charts";

/** Which runner is followed (and which view is shown) across the charts of one board. */
export const BoardCtx = createContext<{ focus: string; me: string; mode: string; setFocus: (id: string) => void; setMode: (m: string) => void } | null>(null);

const W = 340;
const LEFT = 30; // y labels
const RIGHT = 6;
const TOP = 8;
const BOTTOM = 18; // x labels
const INNER = W - LEFT - RIGHT;

const f1 = (n: number) => Math.round(n * 10) / 10;
const short = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

/** Points spread edge to edge (lines) or centered in equal slots (bars). */
function xOf(n: number, slots: boolean) {
  if (slots) return (i: number) => f1(LEFT + (INNER / Math.max(1, n)) * (i + 0.5));
  return (i: number) => f1(n > 1 ? LEFT + (i * INNER) / (n - 1) : LEFT + INNER / 2);
}

/** Up to four x labels (first, last and evenly in between), so they never collide. */
function xTicks(n: number): number[] {
  if (n <= 1) return [0];
  const k = Math.min(n, 4);
  return [...new Set(Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1))))];
}

/** SVG user coordinates of a pointer event. */
function svgPoint(e: PointerEvent<SVGSVGElement>): { x: number; y: number } | null {
  const m = e.currentTarget.getScreenCTM();
  return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null;
}

/** Column under the pointer: a tap (or hover with a mouse) selects it. */
function useColumn(n: number, slots: boolean) {
  const [i, setI] = useState<number | null>(null);
  const pick = (e: PointerEvent<SVGSVGElement>): number | null => {
    const p = svgPoint(e);
    if (!p || !n) return null;
    const k = slots ? Math.floor((p.x - LEFT) / (INNER / n)) : n > 1 ? Math.round(((p.x - LEFT) * (n - 1)) / INNER) : 0;
    const j = Math.max(0, Math.min(n - 1, k));
    setI(j);
    return j;
  };
  return { i, pick };
}

const handlers = (pick: (e: PointerEvent<SVGSVGElement>) => unknown) => ({
  onPointerDown: pick,
  onPointerMove: (e: PointerEvent<SVGSVGElement>) => { if (e.pointerType === "mouse") pick(e); },
});

function Readout({ text }: { text: string }) {
  return <p className="readout small" aria-live="polite">{text}</p>;
}

function Axes({ h, ticks, y, fmtY, xLabels, x }: { h: number; ticks: number[]; y: (v: number) => number; fmtY: (v: number) => string; xLabels: string[]; x: (i: number) => number }) {
  const n = xLabels.length;
  return (
    <>
      <g className="grid">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} />
            <text x={LEFT - 5} y={y(v) + 3.5} textAnchor="end">{fmtY(v)}</text>
          </g>
        ))}
      </g>
      <g className="xlabels">
        {xTicks(n).map((i) => (
          <text key={i} x={x(i)} y={h - 4} textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}>{xLabels[i]}</text>
        ))}
      </g>
    </>
  );
}

const ticksOf = (lo: number, hi: number, step: number) => {
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(v);
  return out;
};

/** A highlight band behind the selected column. */
function Band({ i, n, slots, h }: { i: number | null; n: number; slots: boolean; h: number }) {
  if (i == null) return null;
  const w = slots ? INNER / Math.max(1, n) : n > 1 ? INNER / (n - 1) : INNER;
  const x = slots ? LEFT + w * i : Math.max(LEFT, xOf(n, false)(i) - w / 2);
  return <rect className="band" x={f1(x)} y={0} width={f1(Math.min(w, W - RIGHT - x))} height={h - BOTTOM} />;
}

/** Bars with a dashed reference line (crew minutes against the plans). */
export function BarsWithLine({ bars, line, xLabels, tips, label, hint, h = 150 }: { bars: number[]; line: number[]; xLabels: string[]; tips: string[]; label: string; hint: string; h?: number }) {
  const n = bars.length;
  const { i, pick } = useColumn(n, true);
  const { max, step } = nice(Math.max(1, ...bars, ...line));
  const slot = INNER / Math.max(1, n);
  const x = xOf(n, true);
  const y = (v: number) => f1(TOP + (1 - v / max) * (h - TOP - BOTTOM));
  const base = h - BOTTOM;
  const bw = Math.max(2, Math.min(22, slot - 2));
  const r = Math.min(4, bw / 2);
  // One path for all bars (rounded tops), one for the plan as a step line.
  const barsD = bars
    .map((v, k) => {
      const top = y(v);
      const hh = base - top;
      if (hh < 0.5) return "";
      const rr = f1(Math.min(r, hh));
      const x0 = f1(x(k) - bw / 2);
      return `M${x0},${base}V${f1(top + rr)}q0,${-rr} ${rr},${-rr}h${f1(bw - 2 * rr)}q${rr},0 ${rr},${rr}V${base}Z`;
    })
    .join("");
  const ref = line.map((v, k) => `${k ? "L" : "M"}${f1(LEFT + slot * k)},${y(v)}h${f1(slot)}`).join("");
  return (
    <div className="chart-tips">
      <Readout text={i == null ? hint : tips[i]} />
      <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} {...handlers(pick)}>
        <Band i={i} n={n} slots h={h} />
        <Axes h={h} ticks={ticksOf(0, max, step)} y={y} fmtY={short} xLabels={xLabels} x={x} />
        <path className="bars" d={barsD} />
        <path className="ref" d={ref} />
      </svg>
    </div>
  );
}

function pathOf(vals: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let open = false;
  vals.forEach((v, i) => {
    if (v == null) { open = false; return; }
    d += `${open ? "L" : "M"}${x(i)},${y(v)}`;
    open = true;
  });
  return d;
}

export interface Series { id: string; name: string; values: (number | null)[] }

/** Markers for line charts, once per page: round for the viewer, square for the followed runner. */
export function ChartDefs() {
  return (
    <svg width="0" height="0" className="chart-defs" aria-hidden="true">
      <defs>
        <marker id="mk-me" viewBox="-5 -5 10 10" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse"><circle r="4" /></marker>
        <marker id="mk-focus" viewBox="-5 -5 10 10" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse"><rect x="-4" y="-4" width="8" height="8" /></marker>
      </defs>
    </svg>
  );
}

/**
 * Many lines, one highlighted. All runners are drawn muted; the viewer's own line is solid with
 * round markers, the followed runner's (marked by `ChartBoard`) dashed with square markers.
 * A tap shows the date and the values of the highlighted lines.
 */
export function Lines({ views, me, xLabels, when, labels, hint, unit, h = 170 }: { views: Record<string, Series[]>; me: string; xLabels: string[]; when: string[]; labels: Record<string, string>; hint: string; unit: string; h?: number }) {
  const n = xLabels.length;
  const board = useContext(BoardCtx);
  const focus = board?.focus ?? me;
  // Several views of the same runners (per week, added up); the board picks one.
  const view = board?.mode && views[board.mode] ? board.mode : Object.keys(views)[0];
  const series = views[view];
  const label = labels[view];
  const { i, pick } = useColumn(n, false);
  const { max, step } = nice(Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const x = xOf(n, false);
  const y = (v: number) => f1(TOP + (1 - v / max) * (h - TOP - BOTTOM));
  // The followed runner above the others, the viewer on top.
  const rank = (id: string) => (id === me ? 2 : id === focus ? 1 : 0);
  const ordered = [...series].sort((a, b) => rank(a.id) - rank(b.id));
  let text = hint;
  if (i != null) {
    const lit = series.filter((s) => s.id === me || s.id === focus).sort((a, b) => rank(b.id) - rank(a.id));
    text = [when[i], ...lit.map((s) => (s.values[i] == null ? null : `${s.name}: ${s.values[i]} ${unit}`)).filter(Boolean)].join(" · ");
  }
  return (
    <div className="chart-tips">
      <Readout text={text} />
      <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} {...handlers(pick)}>
        <Band i={i} n={n} slots={false} h={h} />
        <Axes h={h} ticks={ticksOf(0, max, step)} y={y} fmtY={short} xLabels={xLabels} x={x} />
        {ordered.map((s) => (
          <path key={s.id} className={`line${s.id === me ? " me" : s.id === focus ? " focus" : ""}`} d={pathOf(s.values, x, y)} />
        ))}
      </svg>
    </div>
  );
}

/** One runner's own trend as a line with dots. `invert` puts lower values on top (pace: up is faster). */
export function Trend({ values, xLabels, tips, label, hint, fmtY, invert, range, h = 120 }: { values: (number | null)[]; xLabels: string[]; tips: string[]; label: string; hint: string; fmtY: (v: number) => string; invert?: boolean; range?: { lo: number; hi: number }; h?: number }) {
  const n = xLabels.length;
  const { i, pick } = useColumn(n, false);
  const lo = range?.lo ?? 0;
  const top = range?.hi ?? nice(Math.max(1, ...values.map((v) => v ?? 0))).max;
  const step = range ? Math.max(15, Math.ceil((top - lo) / 3 / 15) * 15) : nice(top).step;
  const x = xOf(n, false);
  const span = top - lo || 1;
  const y = (v: number) => f1(TOP + (invert ? (v - lo) / span : 1 - (v - lo) / span) * (h - TOP - BOTTOM));
  return (
    <div className="chart-tips">
      <Readout text={i == null ? hint : tips[i]} />
      <svg className="chart trend" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} {...handlers(pick)}>
        <Band i={i} n={n} slots={false} h={h} />
        <Axes h={h} ticks={ticksOf(lo, top, step)} y={y} fmtY={fmtY} xLabels={xLabels} x={x} />
        <g className="line-one">
          <path d={pathOf(values, x, y)} />
          {values.map((v, k) => (v == null ? null : <circle key={k} cx={x(k)} cy={y(v)} r="3.5" />))}
        </g>
      </svg>
    </div>
  );
}

const NAME_W = 64;

/** Grid cell as sent to the client: [state index in CELL_STATES, runs, of, met]. Small on the wire. */
export type PackedCell = [number, number, number, number];

/**
 * Consistency grid: one row per runner, one square per week (or month). The fill shows how much
 * was done. Each row is a few paths (outlines and fills), not one element per square.
 */
export function Grid({ rows, me, xLabels, when, label, hint, kind, tpl }: { kind: "week" | "month"; rows: { id: string; name: string; cells: PackedCell[] }[]; me: string; xLabels: string[]; when: string[]; label: string; hint: string; tpl: string }) {
  const [sel, setSel] = useState<[number, number] | null>(null);
  const focus = useContext(BoardCtx)?.focus ?? me;
  const n = xLabels.length;
  const pitch = Math.min(18, (W - NAME_W - 2) / Math.max(1, n));
  const size = f1(Math.max(4, pitch - 2));
  const rowH = Math.max(size + 4, 14);
  const h = rows.length * rowH + BOTTOM + 2;
  const cx = (i: number) => f1(NAME_W + i * pitch);
  const y0 = (j: number) => f1(j * rowH + (rowH - size) / 2);
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const p = svgPoint(e);
    if (!p) return;
    const i = Math.floor((p.x - NAME_W) / pitch);
    const j = Math.floor(p.y / rowH);
    if (i < 0 || i >= n || j < 0 || j >= rows.length || CELL_STATES[rows[j].cells[i][0]] === "pre") return;
    setSel([j, i]);
  };
  let text = hint;
  if (sel) {
    const r = rows[sel[0]];
    const [, runs, of, met] = r.cells[sel[1]];
    text = `${r.name} · ${when[sel[1]]}: ${tpl.replace("{n}", String(kind === "week" ? runs : met)).replace("{of}", String(of))}`;
  }
  const sq = (x: number, y: number, w: number, hh: number) => `M${x},${y}h${w}v${hh}h${f1(-w)}Z`;
  return (
    <div className="chart-tips">
      <Readout text={text} />
      <svg className="chart grid-chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={label} {...handlers(pick)}>
        {rows.map((r, j) => {
          let box = "", fill = "", open = "";
          r.cells.forEach(([st, runs, of, met], i) => {
            const state = CELL_STATES[st];
            if (state === "pre") return;
            const fh = f1(size * cellFill({ state, runs, of, met }, kind));
            if (fh < size) {
              if (state === "open") open += sq(cx(i), y0(j), size, size);
              else box += sq(cx(i), y0(j), size, size);
            }
            if (fh > 0) fill += sq(cx(i), f1(y0(j) + size - fh), size, fh);
          });
          return (
            <g key={r.id} className={r.id === me ? "me" : r.id === focus ? "focus" : undefined}>
              <text className="name" x={NAME_W - 6} y={f1(y0(j) + size / 2 + 4)} textAnchor="end">{r.name}</text>
              {box ? <path className="box" d={box} /> : null}
              {open ? <path className="box open" d={open} /> : null}
              {fill ? <path className="fill" d={fill} /> : null}
            </g>
          );
        })}
        {sel ? <rect className="sel" x={cx(sel[1])} y={y0(sel[0])} width={size} height={size} /> : null}
        <g className="xlabels">
          {xTicks(n).map((i) => <text key={i} x={f1(cx(i) + size / 2)} y={h - 4} textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}>{xLabels[i]}</text>)}
        </g>
      </svg>
    </div>
  );
}

/** A tiny trend next to a big number. Decorative: the number says it. */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const w = 96, h = 28, p = 3;
  // Trailing gaps (a running week not judged yet) are left out, inner ones count as zero.
  let end = values.length;
  while (end > 1 && values[end - 1] == null) end--;
  const vs = values.slice(0, end).map((v) => v ?? 0);
  const max = Math.max(1, ...vs);
  const x = (i: number) => f1(vs.length > 1 ? p + (i * (w - 2 * p)) / (vs.length - 1) : w / 2);
  const y = (v: number) => f1(h - p - (v / max) * (h - 2 * p));
  const d = vs.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const li = vs.length - 1;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path className="area" d={`${d}L${x(li)},${h - p}L${x(0)},${h - p}Z`} />
      <path d={d} />
      {li >= 0 ? <circle cx={x(li)} cy={y(vs[li])} r="2.6" /> : null}
    </svg>
  );
}
