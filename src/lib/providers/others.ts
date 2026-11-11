import type { NormalizedRun } from "../import/types";
import { getJson, type OAuthProvider, type PartnerProvider } from "./types";

/* ---------------------------------- Fitbit --------------------------------- */

export function mapFitbitActivity(a: any): NormalizedRun | null {
  const name = String(a.activityName ?? "").toLowerCase();
  if (!/run|lauf|treadmill/.test(name)) return null;
  const unit = String(a.distanceUnit ?? "Kilometer").toLowerCase();
  const dist = Number(a.distance ?? 0);
  return {
    startedAt: new Date(a.startTime),
    distanceKm: unit.startsWith("mile") ? dist * 1.609344 : dist,
    durationSec: Number(a.activeDuration ?? a.duration ?? 0) / 1000,
    avgHr: a.averageHeartRate ?? null,
    externalId: String(a.logId),
  };
}

export const fitbit: OAuthProvider = {
  kind: "oauth2",
  id: "fitbit",
  name: "Fitbit / Google",
  env: "FITBIT",
  website: "https://dev.fitbit.com/apps",
  authorizeUrl: "https://www.fitbit.com/oauth2/authorize",
  tokenUrl: "https://api.fitbit.com/oauth2/token",
  scopes: ["activity", "heartrate", "profile"],
  tokenAuth: "basic",
  pkce: true,
  async fetchRuns(tokens, since) {
    const afterDate = since.toISOString().slice(0, 10);
    const out: NormalizedRun[] = [];
    let url: string | null =
      `https://api.fitbit.com/1/user/-/activities/list.json?afterDate=${afterDate}&sort=asc&limit=100&offset=0`;
    for (let i = 0; url && i < 10; i++) {
      const json: any = await getJson(url, tokens.accessToken, { "Accept-Language": "en_GB" });
      for (const a of json.activities ?? []) {
        const r = mapFitbitActivity(a);
        if (r) out.push(r);
      }
      url = json.pagination?.next || null;
    }
    return out;
  },
};

/* ---------------------------------- Polar ---------------------------------- */

/** ISO 8601 duration such as "PT1H2M3.5S" to seconds. */
export function isoDurationToSec(d: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/.exec(d ?? "");
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

export function mapPolarExercise(e: any): NormalizedRun | null {
  const sport = String(e.sport ?? e["detailed-sport-info"] ?? "").toUpperCase();
  if (!sport.includes("RUNNING")) return null;
  return {
    startedAt: new Date(e["start_time"] ?? e["start-time"]),
    distanceKm: Number(e.distance ?? 0) / 1000,
    durationSec: isoDurationToSec(e.duration),
    avgHr: e.heart_rate?.average ?? e["heart-rate"]?.average ?? null,
    maxHr: e.heart_rate?.maximum ?? e["heart-rate"]?.maximum ?? null,
    externalId: String(e.id),
  };
}

export const polar: OAuthProvider = {
  kind: "oauth2",
  id: "polar",
  name: "Polar",
  env: "POLAR",
  website: "https://admin.polaraccesslink.com",
  authorizeUrl: "https://flow.polar.com/oauth2/authorization",
  tokenUrl: "https://polarremote.com/v2/oauth2/token",
  scopes: ["accesslink.read_all"],
  tokenAuth: "basic",
  parseToken: (json) => ({
    accessToken: json.access_token,
    refreshToken: null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    externalUserId: json.x_user_id != null ? String(json.x_user_id) : null,
  }),
  async afterConnect(tokens) {
    // AccessLink requires registering the user once; 409 means already registered.
    const res = await fetch("https://www.polaraccesslink.com/v3/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ "member-id": `pacepact-${tokens.externalUserId}` }),
    });
    if (!res.ok && res.status !== 409) throw new Error(`Polar registration failed (${res.status})`);
  },
  async fetchRuns(tokens, since) {
    // Lists the exercises of the last 30 days.
    const list = await getJson("https://www.polaraccesslink.com/v3/exercises", tokens.accessToken);
    return (Array.isArray(list) ? list : [])
      .map(mapPolarExercise)
      .filter((r): r is NormalizedRun => !!r && r.startedAt >= since);
  },
};

/* ---------------------------------- Wahoo ---------------------------------- */

// Wahoo workout_type_id values for running variants.
const WAHOO_RUNNING = new Set([1, 3, 4, 5]);

export function mapWahooWorkout(w: any): NormalizedRun | null {
  if (!WAHOO_RUNNING.has(Number(w.workout_type_id))) return null;
  const s = w.workout_summary ?? {};
  return {
    startedAt: new Date(w.starts),
    distanceKm: Number(s.distance_accum ?? 0) / 1000,
    durationSec: Number(s.duration_active_accum ?? s.duration_total_accum ?? (w.minutes ?? 0) * 60),
    avgHr: s.heart_rate_avg != null ? Number(s.heart_rate_avg) : null,
    notes: w.name ?? null,
    externalId: String(w.id),
  };
}

export const wahoo: OAuthProvider = {
  kind: "oauth2",
  id: "wahoo",
  name: "Wahoo",
  env: "WAHOO",
  website: "https://developers.wahooligan.com",
  authorizeUrl: "https://api.wahooligan.com/oauth/authorize",
  tokenUrl: "https://api.wahooligan.com/oauth/token",
  scopes: ["user_read", "workouts_read", "offline_data"],
  scopeSeparator: " ",
  tokenAuth: "body",
  async fetchRuns(tokens, since) {
    const out: NormalizedRun[] = [];
    for (let page = 1; page <= 10; page++) {
      const json: any = await getJson(`https://api.wahooligan.com/v1/workouts?page=${page}&per_page=50`, tokens.accessToken);
      const list: any[] = json.workouts ?? [];
      for (const w of list) {
        const r = mapWahooWorkout(w);
        if (r && r.startedAt >= since) out.push(r);
      }
      const oldest = list.at(-1);
      if (list.length < 50 || (oldest && new Date(oldest.starts) < since)) break;
    }
    return out;
  },
};

/* ---------------------------------- Suunto --------------------------------- */

// Suunto activity IDs for running variants (running, treadmill, trail running).
const SUUNTO_RUNNING = new Set([3, 22, 82]);

export function mapSuuntoWorkout(w: any): NormalizedRun | null {
  if (!SUUNTO_RUNNING.has(Number(w.activityId))) return null;
  return {
    startedAt: new Date(Number(w.startTime)),
    distanceKm: Number(w.totalDistance ?? 0) / 1000,
    durationSec: Number(w.totalTime ?? 0),
    avgHr: w.hrdata?.workoutAvgHR ?? w.hrdata?.avg ?? null,
    maxHr: w.hrdata?.workoutMaxHR ?? w.hrdata?.max ?? null,
    externalId: String(w.workoutKey ?? w.workoutId),
  };
}

export const suunto: OAuthProvider = {
  kind: "oauth2",
  id: "suunto",
  name: "Suunto",
  env: "SUUNTO",
  website: "https://apizone.suunto.com",
  authorizeUrl: "https://cloudapi-oauth.suunto.com/oauth/authorize",
  tokenUrl: "https://cloudapi-oauth.suunto.com/oauth/token",
  scopes: ["workout"],
  tokenAuth: "basic",
  requiredEnv: ["SUUNTO_SUBSCRIPTION_KEY"],
  parseToken: (json) => ({
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    externalUserId: json.user ?? null,
  }),
  async fetchRuns(tokens, since) {
    const json: any = await getJson(`https://cloudapi.suunto.com/v2/workouts?since=${since.getTime()}&limit=200`, tokens.accessToken, {
      "Ocp-Apim-Subscription-Key": process.env.SUUNTO_SUBSCRIPTION_KEY ?? "",
    });
    return (json.payload ?? []).map(mapSuuntoWorkout).filter((r: NormalizedRun | null): r is NormalizedRun => !!r);
  },
};

/* ------------------------------ Partner-only ------------------------------- */

export const garmin: PartnerProvider = {
  kind: "partner",
  id: "garmin",
  name: "Garmin Connect",
  website: "https://developer.garmin.com/gc-developer-program/",
};

export const coros: PartnerProvider = {
  kind: "partner",
  id: "coros",
  name: "COROS",
  website: "https://coros.com",
};
