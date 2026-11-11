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
    const after = Math.floor(since.getTime() / 1000);
    for (let page = 1; page <= 10; page++) {
      const list = await getJson(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,
        tokens.accessToken,
      );
      if (!Array.isArray(list) || list.length === 0) break;
      for (const a of list) {
        const r = mapStravaActivity(a);
        if (r) out.push(r);
      }
      if (list.length < 100) break;
    }
    return out;
  },
};

export async function fetchStravaActivity(accessToken: string, id: string) {
  return mapStravaActivity(await getJson(`https://www.strava.com/api/v3/activities/${encodeURIComponent(id)}`, accessToken));
}
