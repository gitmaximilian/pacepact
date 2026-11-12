import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { rateLimit } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { parseHaeBody } from "@/lib/import/apple-health";
import { storeRuns } from "@/lib/runs-store";
import { APPLE_HEALTH } from "@/lib/social/sources";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Apple Health sync: receives workouts from the iOS app "Health Auto Export"
 * (REST API automation, JSON, data type Workouts, header Authorization: Bearer <token>).
 * Only runs are kept; everything else in the body is ignored and not stored.
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
  const runs = parseHaeBody(body);
  const { inserted, skipped } = runs.length ? await storeRuns(row.userId, APPLE_HEALTH, runs) : { inserted: 0, skipped: 0 };
  await db.update(schema.apiTokens).set({ lastUsedAt: new Date() }).where(eq(schema.apiTokens.id, row.id));
  return NextResponse.json({ runs: runs.length, inserted, skipped });
}
