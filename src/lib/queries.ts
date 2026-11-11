import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function userRuns(userId: string) {
  const db = await getDb();
  return db.select().from(schema.runs).where(eq(schema.runs.userId, userId)).orderBy(desc(schema.runs.startedAt));
}

export async function activeGoal(userId: string) {
  const db = await getDb();
  const [goal] = await db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.userId, userId), eq(schema.goals.active, true)))
    .orderBy(desc(schema.goals.createdAt))
    .limit(1);
  return goal ?? null;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(sp: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = sp[key];
  return typeof v === "string" ? v : null;
}
