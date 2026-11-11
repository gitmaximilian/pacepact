import { createHash } from "node:crypto";
import { randomToken } from "./crypto";

export const STATE_COOKIE = "pp_oauth";

export interface OAuthState {
  provider: string;
  state: string;
  verifier?: string;
}

export function newState(provider: string, pkce: boolean): OAuthState {
  return { provider, state: randomToken(24), verifier: pkce ? randomToken(48) : undefined };
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function encodeState(s: OAuthState): string {
  return Buffer.from(JSON.stringify(s)).toString("base64url");
}

export function decodeState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof v?.provider === "string" && typeof v?.state === "string" ? v : null;
  } catch {
    return null;
  }
}
