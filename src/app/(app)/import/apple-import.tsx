"use client";

import { Unzip, UnzipInflate } from "fflate";
import Link from "next/link";
import { useRef, useState } from "react";
import { AppleExportScanner, type AppleRun } from "@/lib/import/apple-export";

export interface ImportLabels {
  choose: string;
  reading: string;
  found: string;
  none: string;
  noXml: string;
  from: string;
  all: string;
  upload: string;
  uploading: string;
  done: string;
  failed: string;
  again: string;
  toRuns: string;
}

type Phase =
  | { k: "idle" }
  | { k: "reading"; pct: number }
  | { k: "found"; runs: AppleRun[] }
  | { k: "uploading"; done: number; total: number }
  | { k: "done"; inserted: number; skipped: number }
  | { k: "error"; msg: string };

const isExportXml = (name: string) => /(^|\/)export\.xml$/i.test(name);

/**
 * Reads an Apple Health export in the browser: unzips export.zip as a stream, scans
 * export.xml for running workouts and uploads only those, in small batches.
 */
async function readExport(file: File, onProgress: (pct: number) => void): Promise<AppleRun[] | null> {
  const scanner = new AppleExportScanner();
  const decoder = new TextDecoder();
  let foundXml = false;
  const reader = file.stream().getReader();
  let read = 0;
  let lastPct = -1;
  const report = () => {
    const pct = Math.floor((read / Math.max(1, file.size)) * 100);
    if (pct !== lastPct) onProgress((lastPct = pct));
  };

  if (/\.xml$/i.test(file.name)) {
    foundXml = true;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      read += value.length;
      scanner.push(decoder.decode(value, { stream: true }));
      report();
    }
    scanner.push(decoder.decode());
    return scanner.runs;
  }

  let failure: Error | null = null;
  const unzip = new Unzip((entry) => {
    if (!isExportXml(entry.name)) return;
    foundXml = true;
    entry.ondata = (err, chunk, final) => {
      if (err) {
        failure = err;
        return;
      }
      scanner.push(decoder.decode(chunk, { stream: !final }));
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      unzip.push(new Uint8Array(0), true);
      break;
    }
    read += value.length;
    unzip.push(value);
    if (failure) throw failure;
    report();
    // Let the page breathe between chunks on slow phones.
    await new Promise((r) => setTimeout(r, 0));
  }
  return foundXml ? scanner.runs : null;
}

export function AppleImport({ labels: l, locale }: { labels: ImportLabels; locale: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [since, setSince] = useState("");
  const fmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium" });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPhase({ k: "reading", pct: 0 });
    try {
      const runs = await readExport(file, (pct) => setPhase({ k: "reading", pct }));
      if (!runs) return setPhase({ k: "error", msg: l.noXml });
      runs.sort((a, b) => a.start.localeCompare(b.start));
      setPhase(runs.length ? { k: "found", runs } : { k: "error", msg: l.none });
    } catch (err) {
      setPhase({ k: "error", msg: `${l.failed} ${err instanceof Error ? err.message : ""}` });
    }
  }

  async function upload(runs: AppleRun[]) {
    const chosen = since ? runs.filter((r) => r.start >= since) : runs;
    let inserted = 0;
    let skipped = 0;
    for (let i = 0; i < chosen.length; i += 100) {
      setPhase({ k: "uploading", done: i, total: chosen.length });
      const res = await fetch("/api/import/apple-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runs: chosen.slice(i, i + 100) }),
      });
      if (!res.ok) return setPhase({ k: "error", msg: `${l.failed} ${res.status}` });
      const j = (await res.json()) as { inserted: number; skipped: number };
      inserted += j.inserted;
      skipped += j.skipped;
    }
    setPhase({ k: "done", inserted, skipped });
  }

  const pick = (
    <>
      <input ref={input} type="file" accept=".zip,.xml,application/zip,text/xml" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" className="btn signal" onClick={() => input.current?.click()}>{l.choose}</button>
    </>
  );

  switch (phase.k) {
    case "idle":
      return <div className="row">{pick}</div>;
    case "reading":
      return (
        <div className="stack" style={{ gap: 8 }} role="status">
          <span>{l.reading.replace("{p}", String(phase.pct))}</span>
          <div className="progress"><span style={{ width: `${phase.pct}%` }} /></div>
        </div>
      );
    case "found": {
      const first = phase.runs[0].start;
      const last = phase.runs[phase.runs.length - 1].start;
      return (
        <div className="stack" style={{ gap: 10 }}>
          <p className="flash ok" role="status">
            {l.found.replace("{n}", String(phase.runs.length)).replace("{a}", fmt.format(new Date(first))).replace("{b}", fmt.format(new Date(last)))}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <label htmlFor="since" className="small">{l.from}</label>
            <input id="since" type="date" value={since} min={first.slice(0, 10)} max={last.slice(0, 10)} onChange={(e) => setSince(e.target.value)} style={{ width: "auto" }} />
            {since ? <button type="button" className="linkish" onClick={() => setSince("")}>{l.all}</button> : null}
          </div>
          <div><button type="button" className="btn signal" onClick={() => upload(phase.runs)}>{l.upload}</button></div>
        </div>
      );
    }
    case "uploading":
      return (
        <div className="stack" style={{ gap: 8 }} role="status">
          <span>{l.uploading.replace("{d}", String(phase.done)).replace("{n}", String(phase.total))}</span>
          <div className="progress"><span style={{ width: `${(phase.done / Math.max(1, phase.total)) * 100}%` }} /></div>
        </div>
      );
    case "done":
      return (
        <div className="stack" style={{ gap: 10 }}>
          <p className="flash ok" role="status">{l.done.replace("{n}", String(phase.inserted)).replace("{s}", String(phase.skipped))}</p>
          <div className="row"><Link className="btn" href="/runs">{l.toRuns}</Link>{pick}</div>
        </div>
      );
    case "error":
      return (
        <div className="stack" style={{ gap: 10 }}>
          <p className="flash err" role="alert">{phase.msg}</p>
          <div className="row">{pick}</div>
        </div>
      );
  }
}
