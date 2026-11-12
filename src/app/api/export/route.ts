import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { currentUser } from "@/lib/auth";

/** Everything stored about the signed-in user (Art. 15 and 20 GDPR). Secrets are never included. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = await getDb();
  const [goals, runs, memberships, keys] = await Promise.all([
    db.select().from(schema.goals).where(eq(schema.goals.userId, user.id)),
    db.select().from(schema.runs).where(eq(schema.runs.userId, user.id)),
    db
      .select({ group: schema.groups.name, role: schema.groupMembers.role, joinedAt: schema.groupMembers.joinedAt })
      .from(schema.groupMembers)
      .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
      .where(eq(schema.groupMembers.userId, user.id)),
    db
      .select({ id: schema.passkeys.id, createdAt: schema.passkeys.createdAt, lastUsedAt: schema.passkeys.lastUsedAt })
      .from(schema.passkeys)
      .where(eq(schema.passkeys.userId, user.id)),
  ]);
  const account = user;
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), account, goals, runs, groups: memberships, passkeys: keys },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pacepact-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
