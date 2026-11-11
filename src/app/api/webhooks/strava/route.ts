import { and, eq } from "drizzle-orm";
import { after, NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { storeRuns } from "@/lib/runs-store";
import { getOAuthProvider } from "@/lib/providers/registry";
import { fetchStravaActivity } from "@/lib/providers/strava";
import { freshTokens } from "@/lib/providers/sync";

/** Strava push subscription validation. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (!expected || q.get("hub.mode") !== "subscribe" || q.get("hub.verify_token") !== expected) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.json({ "hub.challenge": q.get("hub.challenge") });
}

/** New or deleted activities. Strava expects a 200 within two seconds. */
export async function POST(req: NextRequest) {
  const event = await req.json().catch(() => null);
  if (!event || event.owner_id == null) return NextResponse.json({ ok: true });
  const expectedSub = process.env.STRAVA_SUBSCRIPTION_ID;
  if (expectedSub && String(event.subscription_id) !== expectedSub) return NextResponse.json({ ok: true });

  const db = await getDb();
  // The athlete revoked access at Strava: delete the stored tokens.
  if (event.object_type === "athlete" && String(event.updates?.authorized) === "false") {
    await db
      .delete(schema.connections)
      .where(and(eq(schema.connections.provider, "strava"), eq(schema.connections.externalUserId, String(event.owner_id))));
    return NextResponse.json({ ok: true });
  }
  if (event.object_type !== "activity") return NextResponse.json({ ok: true });

  const [conn] = await db
    .select()
    .from(schema.connections)
    .where(and(eq(schema.connections.provider, "strava"), eq(schema.connections.externalUserId, String(event.owner_id))))
    .limit(1);
  if (!conn) return NextResponse.json({ ok: true });

  const activityId = String(event.object_id);
  if (event.aspect_type === "delete") {
    await db
      .delete(schema.runs)
      .where(and(eq(schema.runs.userId, conn.userId), eq(schema.runs.source, "strava"), eq(schema.runs.externalId, activityId)));
    return NextResponse.json({ ok: true });
  }
  if (event.aspect_type === "create") {
    // Fetch the activity directly; the event itself carries no activity data.
    // The fetched data is untrusted input and goes through the same sanitizer as every import.
    after(async () => {
      try {
        const p = getOAuthProvider("strava")!;
        const tokens = await freshTokens(conn, p);
        const run = await fetchStravaActivity(tokens.accessToken, activityId);
        if (run) await storeRuns(conn.userId, "strava", [run]);
      } catch (err) {
        console.error("Strava webhook import failed", err);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
