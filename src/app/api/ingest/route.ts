import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { RUN_TYPES } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/auth";
import { storeRuns } from "@/lib/runs-store";

const RunInput = z.object({
  startedAt: z.coerce.date(),
  distanceKm: z.coerce.number().min(0).max(400),
  durationSec: z.coerce.number().positive().max(48 * 3600),
  avgHr: z.coerce.number().int().min(25).max(250).optional().nullable(),
  maxHr: z.coerce.number().int().min(25).max(250).optional().nullable(),
  effort: z.coerce.number().int().min(1).max(10).optional().nullable(),
  walkBreaks: z.boolean().optional(),
  runType: z.enum(RUN_TYPES).optional(),
  notes: z.string().max(1000).optional().nullable(),
  externalId: z.string().max(200).optional().nullable(),
  source: z.string().regex(/^[a-z0-9_-]{2,30}$/).optional(),
});
const Body = z.union([RunInput, z.array(RunInput).max(500)]);

/**
 * Personal ingest endpoint for Apple Shortcuts (Apple Health), Android
 * automations (Health Connect), Zapier, Make and similar tools.
 * Auth: `Authorization: Bearer <personal API token>`.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  if (!rateLimit(`ingest:${sha256(token)}`, 120, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const db = await getDb();
  const [row] = await db.select().from(schema.apiTokens).where(eq(schema.apiTokens.tokenHash, sha256(token))).limit(1);
  if (!row) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  const list = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  const bySource = new Map<string, typeof list>();
  for (const r of list) {
    const s = r.source ?? "api";
    bySource.set(s, [...(bySource.get(s) ?? []), r]);
  }
  let inserted = 0;
  let skipped = 0;
  for (const [source, rs] of bySource) {
    const res = await storeRuns(
      row.userId,
      source,
      rs.map((r) => ({ ...r, externalId: r.externalId ?? `${source}:${r.startedAt.toISOString()}` })),
    );
    inserted += res.inserted;
    skipped += res.skipped;
  }
  await db.update(schema.apiTokens).set({ lastUsedAt: new Date() }).where(eq(schema.apiTokens.id, row.id));
  return NextResponse.json({ inserted, skipped });
}
