import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { rateLimit } from "../auth";

export const MAX_MEMBERS = 50;

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/** Joins a group by invite code. Returns the group ID, or null for an unknown code, a full group or too many attempts. */
export async function joinByCode(userId: string, raw: string): Promise<string | null> {
  const code = normalizeCode(raw);
  if (code.length !== 6) return null;
  if (!(await rateLimit(`join:${userId}`, 20))) return null;
  const db = await getDb();
  const [group] = await db.select({ id: schema.groups.id }).from(schema.groups).where(eq(schema.groups.inviteCode, code)).limit(1);
  if (!group) return null;
  const members = await db.select({ u: schema.groupMembers.userId }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, group.id));
  if (members.some((m) => m.u === userId)) return group.id;
  if (members.length >= MAX_MEMBERS) return null;
  await db.insert(schema.groupMembers).values({ groupId: group.id, userId }).onConflictDoNothing();
  return group.id;
}
