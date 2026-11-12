import "server-only";
import { and, asc, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Group, RunWeek } from "@/db/schema";
import { contestEnd, evaluate, badgeFor } from "./contests";
import type { MemberData } from "./scoring";
import { ensureStats } from "./store";
import { groupEligible, weekKey } from "./weeks";

/** Hands a group to its longest-standing other member, or deletes it if nobody else is in it. */
export async function handOverOrDelete(groupId: string, leavingUserId: string) {
  const db = await getDb();
  const [next] = await db
    .select()
    .from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), ne(schema.groupMembers.userId, leavingUserId)))
    .orderBy(asc(schema.groupMembers.joinedAt))
    .limit(1);
  if (!next) {
    await db.delete(schema.groups).where(eq(schema.groups.id, groupId));
    return;
  }
  await db.update(schema.groups).set({ ownerId: next.userId }).where(eq(schema.groups.id, groupId));
  await db
    .update(schema.groupMembers)
    .set({ role: "owner" })
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, next.userId)));
}

export async function handOverOwnedGroups(userId: string) {
  const db = await getDb();
  const owned = await db.select({ id: schema.groups.id }).from(schema.groups).where(eq(schema.groups.ownerId, userId));
  for (const g of owned) await handOverOrDelete(g.id, userId);
}

/** The group and the caller's membership, or null if the caller is not a member (no IDOR). */
export async function membership(groupId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ group: schema.groups, me: schema.groupMembers })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function groupMembers(groupId: string) {
  const db = await getDb();
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      runsPerWeek: schema.users.runsPerWeek,
      statsVersion: schema.users.statsVersion,
      role: schema.groupMembers.role,
      joinedAt: schema.groupMembers.joinedAt,
      shareDistance: schema.groupMembers.shareDistance,
      sharePace: schema.groupMembers.sharePace,
      raceRegistered: schema.groupMembers.raceRegistered,
    })
    .from(schema.groupMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.groupMembers.userId))
    .where(eq(schema.groupMembers.groupId, groupId))
    .orderBy(asc(schema.groupMembers.joinedAt));
}
export type Member = Awaited<ReturnType<typeof groupMembers>>[number];

/** Weekly totals and plan settings for members. Goals are only used to compute targets, never shown. */
export async function memberData(
  users: { id: string; runsPerWeek: number; statsVersion: number }[],
  variant: "all" | "device",
  fromWeek: string,
): Promise<MemberData[]> {
  if (!users.length) return [];
  await ensureStats(users);
  const db = await getDb();
  const ids = users.map((u) => u.id);
  const [weeks, goals] = await Promise.all([
    db
      .select()
      .from(schema.runWeeks)
      .where(and(inArray(schema.runWeeks.userId, ids), eq(schema.runWeeks.variant, variant), gte(schema.runWeeks.week, fromWeek))),
    db
      .select({ userId: schema.goals.userId, raceDate: schema.goals.raceDate })
      .from(schema.goals)
      .where(and(inArray(schema.goals.userId, ids), eq(schema.goals.active, true))),
  ]);
  const byUser = new Map<string, RunWeek[]>();
  for (const w of weeks) byUser.set(w.userId, [...(byUser.get(w.userId) ?? []), w]);
  const race = new Map(goals.map((g) => [g.userId, g.raceDate]));
  return users.map((u) => ({
    userId: u.id,
    runsPerWeek: u.runsPerWeek,
    raceDate: race.get(u.id) ?? null,
    weeks: new Map((byUser.get(u.id) ?? []).map((w) => [w.week, w])),
  }));
}

/** Finishes challenges whose last day has passed: stores score, rank and sticker per participant. */
export async function finalizeDue(contests: (typeof schema.contests.$inferSelect)[], data: (ids: string[]) => Promise<MemberData[]>) {
  const today = new Date().toISOString().slice(0, 10);
  const db = await getDb();
  for (const c of contests) {
    if (c.status !== "active" || contestEnd(c) >= today) continue;
    const entries = await db
      .select()
      .from(schema.contestEntries)
      .where(and(eq(schema.contestEntries.contestId, c.id), eq(schema.contestEntries.status, "accepted")));
    const md = await data(entries.map((e) => e.userId));
    const outcome = evaluate(c, md);
    for (const s of outcome.standings) {
      await db
        .update(schema.contestEntries)
        .set({ score: s.score, rank: s.rank, badge: badgeFor(c, outcome, s) })
        .where(and(eq(schema.contestEntries.contestId, c.id), eq(schema.contestEntries.userId, s.userId)));
    }
    await db.update(schema.contests).set({ status: "done" }).where(eq(schema.contests.id, c.id));
    c.status = "done";
  }
}

export const FEED_DAYS = 21;

/**
 * Recent runs of members for the feed: nothing implausible, and only runs since the member
 * joined this group. Never notes or heart rate.
 */
export async function feedRuns(members: Member[]) {
  if (!members.length) return [];
  const db = await getDb();
  const since = new Date(Date.now() - FEED_DAYS * 86400_000);
  const rows = await db
    .select({
      id: schema.runs.id,
      userId: schema.runs.userId,
      startedAt: schema.runs.startedAt,
      distanceKm: schema.runs.distanceKm,
      durationSec: schema.runs.durationSec,
      runType: schema.runs.runType,
      source: schema.runs.source,
      walkBreaks: schema.runs.walkBreaks,
    })
    .from(schema.runs)
    .where(
      and(
        inArray(schema.runs.userId, members.map((m) => m.id)),
        gte(schema.runs.startedAt, since),
      ),
    )
    .orderBy(desc(schema.runs.startedAt))
    .limit(60);
  const joined = new Map(members.map((m) => [m.id, m.joinedAt.getTime()]));
  return rows.filter((r) => groupEligible(r) && r.startedAt.getTime() >= (joined.get(r.userId) ?? Infinity) - 86400_000);
}

export async function feedMilestones(members: Member[]) {
  if (!members.length) return [];
  const db = await getDb();
  const since = new Date(Date.now() - FEED_DAYS * 86400_000);
  const rows = await db
    .select()
    .from(schema.milestones)
    .where(and(inArray(schema.milestones.userId, members.map((m) => m.id)), gte(schema.milestones.achievedAt, since)));
  const joined = new Map(members.map((m) => [m.id, m.joinedAt.getTime()]));
  return rows.filter((r) => r.achievedAt.getTime() >= (joined.get(r.userId) ?? Infinity) - 86400_000);
}

export function milestoneId(m: { userId: string; kind: string; value: number }) {
  return `${m.userId}:${m.kind}:${m.value}`;
}

/**
 * Checks that a reaction or comment target is visible in this group, so nobody can attach
 * content to runs or challenges of other groups (IDOR).
 */
export async function targetVisible(group: Group, type: string, id: string): Promise<boolean> {
  const db = await getDb();
  const isMember = async (userId: string) =>
    !!(
      await db
        .select({ u: schema.groupMembers.userId, joinedAt: schema.groupMembers.joinedAt })
        .from(schema.groupMembers)
        .where(and(eq(schema.groupMembers.groupId, group.id), eq(schema.groupMembers.userId, userId)))
        .limit(1)
    )[0];
  if (type === "run") {
    const [r] = await db.select().from(schema.runs).where(eq(schema.runs.id, id)).limit(1);
    return !!r && groupEligible(r) && (await isMember(r.userId));
  }
  if (type === "contest") {
    const [c] = await db.select({ g: schema.contests.groupId }).from(schema.contests).where(eq(schema.contests.id, id)).limit(1);
    return c?.g === group.id;
  }
  if (type === "milestone") {
    const [userId] = id.split(":");
    return !!userId && (await isMember(userId));
  }
  return false;
}

export const currentWeek = () => weekKey(new Date());
