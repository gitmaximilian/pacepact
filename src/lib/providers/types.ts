import type { NormalizedRun } from "../import/types";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  externalUserId?: string | null;
}

export interface OAuthProvider {
  kind: "oauth2";
  id: string;
  name: string;
  /** Environment variable prefix, e.g. STRAVA → STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET. */
  env: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeSeparator?: string;
  /** How the client authenticates at the token endpoint. */
  tokenAuth: "body" | "basic";
  pkce?: boolean;
  extraAuthParams?: Record<string, string>;
  /** Extra env vars that must be set besides client id and secret. */
  requiredEnv?: string[];
  /** Turns the raw token response into a TokenSet. */
  parseToken?: (json: any) => TokenSet;
  /** Called once after the first token exchange (e.g. Polar user registration). */
  afterConnect?: (tokens: TokenSet) => Promise<void>;
  /** Fetches running activities since `since`. */
  fetchRuns: (tokens: TokenSet, since: Date) => Promise<NormalizedRun[]>;
  website: string;
}

/** Services whose API requires a partner agreement before credentials are issued. */
export interface PartnerProvider {
  kind: "partner";
  id: string;
  name: string;
  website: string;
}

export type Provider = OAuthProvider | PartnerProvider;

export function defaultParseToken(json: any): TokenSet {
  if (!json?.access_token) throw new Error("Token response has no access_token");
  return {
    accessToken: String(json.access_token),
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    expiresAt:
      typeof json.expires_at === "number"
        ? new Date(json.expires_at * 1000)
        : typeof json.expires_in === "number"
          ? new Date(Date.now() + json.expires_in * 1000)
          : null,
    externalUserId: json.user_id != null ? String(json.user_id) : null,
  };
}

export async function getJson(url: string, token: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}
