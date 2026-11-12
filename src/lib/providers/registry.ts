import { strava } from "./strava";
import type { OAuthProvider } from "./types";

/** Connected services. Strava only: Apple Health comes in through the personal sync endpoint. */
export const PROVIDERS: OAuthProvider[] = [strava];

export function getOAuthProvider(id: string): OAuthProvider | null {
  return PROVIDERS.find((x) => x.id === id) ?? null;
}

export function clientCredentials(p: OAuthProvider) {
  const id = process.env[`${p.env}_CLIENT_ID`];
  const secret = process.env[`${p.env}_CLIENT_SECRET`];
  return id && secret ? { id, secret } : null;
}

export function isConfigured(p: OAuthProvider): boolean {
  return !!clientCredentials(p) && (p.requiredEnv ?? []).every((k) => !!process.env[k]);
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function redirectUri(p: OAuthProvider): string {
  return `${appUrl()}/api/connections/${p.id}/callback`;
}
