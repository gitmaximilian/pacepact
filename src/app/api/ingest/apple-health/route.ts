import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { rateLimit } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { parseHaeBody } from "@/lib/import/apple-health";
import { parseShortcutRun } from "@/lib/import/shortcut";
import { formatDuration, formatKm } from "@/lib/pace";
import { storeRuns } from "@/lib/runs-store";
import { APPLE_HEALTH } from "@/lib/social/sources";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Apple Health sync. Two senders, both with header Authorization: Bearer <token>:
 * - the free Pacepact Apple Shortcut (automation "Apple Watch workout ends"): one run as
 *   { start, end?, duration?, distance?, type?, avgHr? }, see src/lib/import/shortcut.ts;
 * - the iOS app "Health Auto Export" (REST automation, JSON, data type Workouts).
 * Only runs are kept; everything else in the body is ignored and not stored.
 * The response carries a short `message` the Shortcut can show as a notification.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  if (!(await rateLimit(`apple:${sha256(token)}`, 300, 60 * 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const db = await getDb();
  const [row] = await db.select().from(schema.apiTokens).where(eq(schema.apiTokens.tokenHash, sha256(token))).limit(1);
  if (!row) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) {
    return NextResponse.json({ error: "Too large: turn off route data and workout metrics in the automation" }, { status: 413 });
  }
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Expected JSON (export format JSON)" }, { status: 400 });
  }
  const isHae = !!(body as { data?: unknown } | null)?.data;
  const single = isHae ? null : parseShortcutRun(body);
  const runs = isHae ? parseHaeBody(body) : single ? [single] : [];
  const { inserted, skipped } = runs.length ? await storeRuns(row.userId, APPLE_HEALTH, runs) : { inserted: 0, skipped: 0 };
  await db.update(schema.apiTokens).set({ lastUsedAt: new Date() }).where(eq(schema.apiTokens.id, row.id));
  const [u] = await db.select({ locale: schema.users.locale }).from(schema.users).where(eq(schema.users.id, row.userId)).limit(1);
  const de = u?.locale === "de";
  const message = !isHae && !single
    ? de ? "Pacepact: Kein Lauf erkannt. Prüf Start, Dauer und Distanz im Kurzbefehl." : "Pacepact: no run found. Check start, duration and distance in the shortcut."
    : single
      ? inserted
        ? `Pacepact: ${de ? "Lauf gespeichert" : "Run saved"} · ${formatKm(single.distanceKm, de ? "de" : "en", 2)} km · ${formatDuration(single.durationSec)}`
        : de ? "Pacepact: Lauf war schon da." : "Pacepact: run was already there."
      : `Pacepact: ${inserted} ${de ? "neue Läufe" : "new runs"}`;
  return NextResponse.json({ runs: runs.length, inserted, skipped, message }, { status: !isHae && !single ? 422 : 200 });
}
