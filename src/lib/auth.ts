import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { INACTIVE_ACCOUNT_DAYS } from "./legal";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/db";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "pp_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const db = await getDb();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt });
  await cleanup(true);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

let lastCleanup = 0;

/** Deletes expired sessions and accounts unused for two years. Runs at most hourly unless forced. */
export async function cleanup(force = false) {
  if (!force && Date.now() - lastCleanup < 3600_000) return;
  lastCleanup = Date.now();
  const db = await getDb();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  await db
    .delete(schema.users)
    .where(lt(schema.users.lastActiveAt, new Date(Date.now() - INACTIVE_ACCOUNT_DAYS * 86400_000)));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Cached per request. */
export const currentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await cleanup();
  const db = await getDb();
  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user ?? null;
  if (user && user.lastActiveAt.getTime() < Date.now() - 86400_000) {
    await db.update(schema.users).set({ lastActiveAt: new Date() }).where(eq(schema.users.id, user.id));
  }
  return user;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}

/** Simple in-memory limiter for sign-in attempts (per process). */
const attempts = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max = 8, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}
