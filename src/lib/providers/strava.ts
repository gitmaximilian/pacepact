import type { NormalizedRun } from "../import/types";
import { getJson, type OAuthProvider } from "./types";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export function mapStravaActivity(a: any): NormalizedRun | null {
  const type = a.sport_type ?? a.type;
  if (!RUN_TYPES.has(type)) return null;
  return {
    startedAt: new Date(a.start_date),
    distanceKm: Number(a.distance ?? 0) / 1000,
    durationSec: Number(a.moving_time ?? a.elapsed_time ?? 0),
    avgHr: a.average_heartrate ?? null,
    maxHr: a.max_heartrate ?? null,
    notes: a.name ?? null,
    externalId: String(a.id),
  };
}

export const strava: OAuthProvider = {
  kind: "oauth2",
  id: "strava",
  name: "Strava",
  env: "STRAVA",
  website: "https://www.strava.com/settings/api",
  authorizeUrl: "https://www.strava.com/oauth/authorize",
  tokenUrl: "https://www.strava.com/oauth/token",
  scopes: ["read", "activity:read_all"],
  scopeSeparator: ",",
  tokenAuth: "body",
  extraAuthParams: { approval_prompt: "auto" },
  parseToken: (json) => ({
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at ? new Date(json.expires_at * 1000) : null,
    externalUserId: json.athlete?.id != null ? String(json.athlete.id) : null,
  }),
  async fetchRuns(tokens, since) {
    const out: NormalizedRun[] = [];
    for (let page = 1; page <= 3; page++) {
      const { runs, more } = await fetchStravaPage(tokens.accessToken, since, page);
      out.push(...runs);
      if (!more) break;
    }
    return out;
  },
};

/**
 * One page (up to 100 activities) since `since`, oldest first. Used page by page for the
 * history import so each request stays small enough for the Workers free plan.
 */
export async function fetchStravaPage(accessToken: string, since: Date, page: number, perPage = 100) {
  const after = Math.floor(since.getTime() / 1000);
  const list = await getJson(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=${perPage}&page=${page}`, accessToken);
  const items = Array.isArray(list) ? list : [];
  return { runs: items.map(mapStravaActivity).filter((r): r is NormalizedRun => !!r), activities: items.length, more: items.length === perPage };
}

/** Revokes Pacepact's access at Strava (used when the runner disconnects). */
export async function deauthorizeStrava(accessToken: string) {
  await fetch("https://www.strava.com/oauth/deauthorize", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: accessToken }),
    cache: "no-store",
  }).catch(() => null);
}

export async function fetchStravaActivity(accessToken: string, id: string) {
  return mapStravaActivity(await getJson(`https://www.strava.com/api/v3/activities/${encodeURIComponent(id)}`, accessToken));
}
