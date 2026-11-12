import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Connection } from "@/db/schema";
import { decrypt, encrypt } from "../crypto";
import { storeRuns } from "../runs-store";
import { clientCredentials, getOAuthProvider, redirectUri } from "./registry";
import { defaultParseToken, type OAuthProvider, type TokenSet } from "./types";

const INITIAL_DAYS = 120;

async function tokenRequest(p: OAuthProvider, params: Record<string, string>): Promise<TokenSet> {
  const creds = clientCredentials(p);
  if (!creds) throw new Error(`${p.name} is not configured`);
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  if (p.tokenAuth === "basic") {
    headers.Authorization = `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString("base64")}`;
  } else {
    body.set("client_id", creds.id);
    body.set("client_secret", creds.secret);
  }
  const res = await fetch(p.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
  if (!res.ok) throw new Error(`${p.name} token endpoint answered ${res.status}`);
  return (p.parseToken ?? defaultParseToken)(await res.json());
}

export function exchangeCode(p: OAuthProvider, code: string, codeVerifier?: string) {
  const params: Record<string, string> = { grant_type: "authorization_code", code, redirect_uri: redirectUri(p) };
  if (codeVerifier) params.code_verifier = codeVerifier;
  return tokenRequest(p, params);
}

/** Saves (or replaces) a connection and imports recent runs. */
export async function saveConnection(userId: string, p: OAuthProvider, tokens: TokenSet) {
  const db = await getDb();
  const values = {
    userId,
    provider: p.id,
    externalUserId: tokens.externalUserId ?? null,
    accessTokenEnc: encrypt(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    expiresAt: tokens.expiresAt ?? null,
    lastError: null,
  };
  await db
    .insert(schema.connections)
    .values(values)
    .onConflictDoUpdate({ target: [schema.connections.userId, schema.connections.provider], set: values });
}

async function freshTokens(conn: Connection, p: OAuthProvider): Promise<TokenSet> {
  const current: TokenSet = {
    accessToken: decrypt(conn.accessTokenEnc),
    refreshToken: conn.refreshTokenEnc ? decrypt(conn.refreshTokenEnc) : null,
    expiresAt: conn.expiresAt,
    externalUserId: conn.externalUserId,
  };
  const expiresSoon = current.expiresAt && current.expiresAt.getTime() < Date.now() + 5 * 60_000;
  if (!expiresSoon || !current.refreshToken) return current;
  const next = await tokenRequest(p, { grant_type: "refresh_token", refresh_token: current.refreshToken });
  const merged = { ...next, refreshToken: next.refreshToken ?? current.refreshToken, externalUserId: current.externalUserId };
  const db = await getDb();
  await db
    .update(schema.connections)
    .set({
      accessTokenEnc: encrypt(merged.accessToken),
      refreshTokenEnc: merged.refreshToken ? encrypt(merged.refreshToken) : null,
      expiresAt: merged.expiresAt ?? null,
    })
    .where(eq(schema.connections.id, conn.id));
  return merged;
}

/** Pulls new runs for one connection. Returns how many were added. */
export async function syncConnection(userId: string, providerId: string): Promise<number> {
  const p = getOAuthProvider(providerId);
  if (!p) throw new Error("Unknown provider");
  const db = await getDb();
  const [conn] = await db
    .select()
    .from(schema.connections)
    .where(and(eq(schema.connections.userId, userId), eq(schema.connections.provider, providerId)))
    .limit(1);
  if (!conn) throw new Error("Not connected");
  try {
    const tokens = await freshTokens(conn, p);
    const since = conn.lastSyncAt
      ? new Date(conn.lastSyncAt.getTime() - 2 * 86400_000)
      : new Date(Date.now() - INITIAL_DAYS * 86400_000);
    const runs = await p.fetchRuns(tokens, since);
    const { inserted } = await storeRuns(userId, p.id, runs);
    await db
      .update(schema.connections)
      .set({ lastSyncAt: new Date(), lastError: null })
      .where(eq(schema.connections.id, conn.id));
    return inserted;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(schema.connections).set({ lastError: msg.slice(0, 300) }).where(eq(schema.connections.id, conn.id));
    throw err;
  }
}

export { freshTokens };
