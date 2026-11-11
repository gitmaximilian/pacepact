import type { RunType } from "@/db/schema";
import { parseDuration } from "../pace";
import { ImportError, type NormalizedRun } from "./types";

/** Minimal RFC 4180 parser supporting quotes and `,` or `;` separators. */
export function parseCsvRows(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Header aliases in English and German, including the old team spreadsheet. */
const ALIASES: Record<string, string[]> = {
  date: ["date", "datum", "day", "tag", "startedat", "start"],
  name: ["name", "person", "runner"],
  type: ["type", "run", "runtype", "einheit"],
  distance: ["distance", "distancekm", "distanz", "km", "kilometer"],
  duration: ["duration", "time", "dauer", "zeit"],
  minutes: ["minutes", "minuten", "min"],
  seconds: ["seconds", "sekunden", "sek", "sec"],
  avgHr: ["avghr", "averageheartrate", "puls", "opuls", "durchschnittspuls", "hr"],
  effort: ["effort", "anstrengung", "rpe"],
  walk: ["walkbreaks", "walk", "gehpause", "gehpausen"],
  notes: ["notes", "notizen", "notiz", "comment"],
};

function toNumber(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: string): Date | null {
  const s = v.trim();
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] ?? 12), Number(dmy[5] ?? 0)));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toType(v: string | undefined): RunType {
  const s = norm(v ?? "");
  if (s === "run1" || s === "1") return "run1";
  if (s === "run2" || s === "2") return "run2";
  if (s === "run3" || s === "3" || s.includes("long")) return "run3";
  if (s.includes("test")) return "test";
  return "other";
}

export interface CsvOptions {
  /** When the CSV has a "Name" column (team sheet), keep only rows for this person. */
  onlyName?: string;
}

export function parseCsv(text: string, opts: CsvOptions = {}): NormalizedRun[] {
  const rows = parseCsvRows(text.replace(/^﻿/, ""));
  if (rows.length < 2) throw new ImportError("CSV needs a header row and at least one run");
  const header = rows[0].map(norm);
  const col = (key: string) => header.findIndex((h) => ALIASES[key].includes(h));
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)])) as Record<string, number>;
  if (idx.date < 0 || idx.distance < 0 || (idx.duration < 0 && idx.minutes < 0)) {
    throw new ImportError("CSV needs columns for date, distance and duration (or minutes)");
  }
  const get = (r: string[], k: string) => (idx[k] >= 0 ? r[idx[k]] : undefined);
  const out: NormalizedRun[] = [];
  for (const r of rows.slice(1)) {
    if (opts.onlyName && idx.name >= 0) {
      if (norm(get(r, "name") ?? "") !== norm(opts.onlyName)) continue;
    }
    const date = toDate(get(r, "date") ?? "");
    const km = toNumber(get(r, "distance"));
    let sec: number | null = null;
    const dur = get(r, "duration");
    if (dur && dur.trim()) sec = parseDuration(dur);
    if (sec == null && idx.minutes >= 0) {
      const m = toNumber(get(r, "minutes"));
      const s = toNumber(get(r, "seconds")) ?? 0;
      if (m != null) sec = m * 60 + s;
    }
    if (!date || km == null || !sec) continue;
    const walk = norm(get(r, "walk") ?? "");
    out.push({
      startedAt: date,
      distanceKm: km,
      durationSec: sec,
      avgHr: toNumber(get(r, "avgHr")),
      effort: toNumber(get(r, "effort")),
      walkBreaks: ["ja", "yes", "true", "1", "x"].includes(walk),
      runType: toType(get(r, "type")),
      notes: get(r, "notes")?.trim() || null,
      externalId: `csv:${date.toISOString()}:${km}:${sec}`,
    });
  }
  if (!out.length) throw new ImportError("No valid rows found in CSV");
  return out;
}
