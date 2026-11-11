import { coros, fitbit, garmin, polar, suunto, wahoo } from "./others";
import { strava } from "./strava";
import type { OAuthProvider, Provider } from "./types";

export const PROVIDERS: Provider[] = [strava, garmin, polar, fitbit, wahoo, suunto, coros];

export function getOAuthProvider(id: string): OAuthProvider | null {
  const p = PROVIDERS.find((x) => x.id === id);
  return p && p.kind === "oauth2" ? p : null;
}

export function clientCredentials(p: OAuthProvider) {
  const id = process.env[`${p.env}_CLIENT_ID`];
  const secret = process.env[`${p.env}_CLIENT_SECRET`];
  return id && secret ? { id, secret } : null;
}

export function isConfigured(p: Provider): boolean {
  if (p.kind !== "oauth2") return false;
  return !!clientCredentials(p) && (p.requiredEnv ?? []).every((k) => !!process.env[k]);
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function redirectUri(p: OAuthProvider): string {
  return `${appUrl()}/api/connections/${p.id}/callback`;
}
