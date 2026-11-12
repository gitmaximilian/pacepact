"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { importStravaHistory } from "../actions";

export interface HistoryLabels {
  title: string;
  hint: string;
  from: string;
  options: { months3: string; months12: string; all: string };
  start: string;
  working: string;
  done: string;
  failed: string;
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

/** Imports past Strava runs page by page, so every request stays small. */
export function StravaHistory({ labels: l }: { labels: HistoryLabels }) {
  const router = useRouter();
  const [range, setRange] = useState("12");
  const [state, setState] = useState<{ busy: boolean; page: number; runs: number; inserted: number; msg: string | null }>({ busy: false, page: 0, runs: 0, inserted: 0, msg: null });
  async function run() {
    const since = range === "all" ? "2000-01-01" : monthsAgo(Number(range));
    let runs = 0;
    let inserted = 0;
    for (let page = 1; page <= 200; page++) {
      setState({ busy: true, page, runs, inserted, msg: null });
      const r = await importStravaHistory(since, page);
      if (!r.ok) return setState({ busy: false, page, runs, inserted, msg: `${l.failed} ${r.error ?? ""}` });
      runs += r.runs;
      inserted += r.inserted;
      if (!r.more) break;
    }
    setState({ busy: false, page: 0, runs, inserted, msg: l.done.replace("{n}", String(inserted)).replace("{m}", String(runs)) });
    router.refresh();
  }
  return (
    <div className="stack history" style={{ gap: 8 }}>
      <strong>{l.title}</strong>
      <span className="small muted">{l.hint}</span>
      <div className="row" style={{ gap: 8 }}>
        <label className="small" htmlFor="strava-range">{l.from}</label>
        <select id="strava-range" className="compact" value={range} onChange={(e) => setRange(e.target.value)} disabled={state.busy}>
          <option value="3">{l.options.months3}</option>
          <option value="12">{l.options.months12}</option>
          <option value="all">{l.options.all}</option>
        </select>
        <button type="button" className="btn small" onClick={run} disabled={state.busy}>{l.start}</button>
      </div>
      {state.busy ? <p className="small" role="status">{l.working.replace("{p}", String(state.page)).replace("{n}", String(state.runs))}</p> : null}
      {state.msg ? <p className="small" role="status">{state.msg}</p> : null}
    </div>
  );
}
