import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentUser, rateLimit } from "@/lib/auth";
import { sameOrigin } from "@/lib/passkeys";
import { storeRuns } from "@/lib/runs-store";
import { APPLE_HEALTH } from "@/lib/social/sources";

const Run = z.object({
  start: z.string().datetime({ offset: true }),
  durationSec: z.number().positive().max(48 * 3600),
  distanceKm: z.number().min(0).max(400),
  avgHr: z.number().int().min(25).max(250).nullable(),
  maxHr: z.number().int().min(25).max(250).nullable(),
});
const Body = z.object({ runs: z.array(Run).max(200) });

/**
 * Receives runs that the browser extracted from an Apple Health export (export.zip).
 * The export itself never leaves the phone; only these run summaries are sent.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!(await rateLimit(`import:${user.id}`, 400, 3600_000))) return NextResponse.json({ error: "rate" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "input" }, { status: 400 });
  const runs = parsed.data.runs.map((r) => ({
    startedAt: new Date(r.start),
    durationSec: r.durationSec,
    distanceKm: r.distanceKm,
    avgHr: r.avgHr,
    maxHr: r.maxHr,
    walkKnown: false,
    externalId: `ah:${r.start.slice(0, 16)}`,
  }));
  const { inserted, skipped } = await storeRuns(user.id, APPLE_HEALTH, runs);
  return NextResponse.json({ inserted, skipped });
}
