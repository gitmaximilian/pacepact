"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { CHALLENGE_KINDS, CHALLENGE_METRICS, REACTIONS, TARGET_TYPES, type ChallengeKind, type ChallengeMetric } from "@/db/schema";
import { rateLimit, requireUser } from "@/lib/auth";
import { inviteCode } from "@/lib/crypto";
import { activeGoal } from "@/lib/queries";
import { longRunTarget, template, validContest } from "@/lib/social/contests";
import { currentWeek, groupMembers, handOverOrDelete, memberData, membership, targetVisible } from "@/lib/social/groups";
import { joinByCode } from "@/lib/social/join";
import { addWeeks } from "@/lib/social/weeks";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (groupId: string, tab?: string) => `/groups/${groupId}${tab ? `?tab=${tab}` : ""}`;

async function asMember(fd: FormData) {
  const user = await requireUser();
  const m = await membership(str(fd, "groupId"), user.id);
  if (!m) redirect("/groups");
  return { user, ...m };
}

async function asOwner(fd: FormData) {
  const m = await asMember(fd);
  if (m.group.ownerId !== m.user.id) redirect(back(m.group.id, "crew"));
  return m;
}

async function freshCode(): Promise<string> {
  const db = await getDb();
  for (let i = 0; i < 6; i++) {
    const code = inviteCode();
    const [taken] = await db.select({ id: schema.groups.id }).from(schema.groups).where(eq(schema.groups.inviteCode, code)).limit(1);
    if (!taken) return code;
  }
  throw new Error("Could not create an invite code");
}

/* ------------------------------- Groups ---------------------------------- */

export async function createGroup(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name").slice(0, 60);
  if (!name) redirect("/groups?error=name");
  if (!(await rateLimit(`group:${user.id}`, 10, 24 * 3600_000))) redirect("/groups?error=rate");
  const goal = await activeGoal(user.id);
  const db = await getDb();
  const [group] = await db
    .insert(schema.groups)
    .values({ name, ownerId: user.id, inviteCode: await freshCode(), raceName: goal?.raceName ?? null, raceDate: goal?.raceDate ?? null })
    .returning();
  await db.insert(schema.groupMembers).values({ groupId: group.id, userId: user.id, role: "owner" });
  redirect(`/groups/${group.id}?new=1`);
}

export async function joinGroup(fd: FormData) {
  const user = await requireUser();
  const groupId = await joinByCode(user.id, str(fd, "code"));
  redirect(groupId ? `/groups/${groupId}?joined=1` : "/groups?error=code");
}

export async function leaveGroup(fd: FormData) {
  const { user, group } = await asMember(fd);
  const db = await getDb();
  if (group.ownerId === user.id) await handOverOrDelete(group.id, user.id);
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, group.id), eq(schema.groupMembers.userId, user.id)));
  redirect("/groups?left=1");
}

export async function removeMember(fd: FormData) {
  const { user, group } = await asOwner(fd);
  const target = str(fd, "userId");
  if (target === user.id) redirect(back(group.id, "crew"));
  const db = await getDb();
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, group.id), eq(schema.groupMembers.userId, target)));
  revalidatePath(back(group.id));
}

export async function rotateInviteCode(fd: FormData) {
  const { group } = await asOwner(fd);
  const db = await getDb();
  await db.update(schema.groups).set({ inviteCode: await freshCode() }).where(eq(schema.groups.id, group.id));
  revalidatePath(back(group.id));
}

export async function deleteGroup(fd: FormData) {
  const { group } = await asOwner(fd);
  if (str(fd, "confirm") !== group.name) redirect(`${back(group.id, "crew")}&error=confirm`);
  const db = await getDb();
  await db.delete(schema.groups).where(eq(schema.groups.id, group.id));
  redirect("/groups?deleted=1");
}

export async function saveGroupSettings(fd: FormData) {
  const { group } = await asOwner(fd);
  const raceDate = str(fd, "raceDate");
  const name = str(fd, "name").slice(0, 60) || group.name;
  const db = await getDb();
  await db
    .update(schema.groups)
    .set({
      name,
      onlyImported: fd.get("onlyImported") === "on",
      raceName: str(fd, "raceName").slice(0, 80) || null,
      raceDate: /^\d{4}-\d{2}-\d{2}$/.test(raceDate) ? raceDate : null,
    })
    .where(eq(schema.groups.id, group.id));
  revalidatePath(back(group.id));
}

/** Each member decides what this group sees about them. */
export async function saveSharing(fd: FormData) {
  const { user, group } = await asMember(fd);
  const reg = str(fd, "raceRegistered");
  const db = await getDb();
  await db
    .update(schema.groupMembers)
    .set({
      shareDistance: fd.get("shareDistance") === "on",
      sharePace: fd.get("sharePace") === "on",
      raceRegistered: reg === "yes" ? true : reg === "no" ? false : null,
    })
    .where(and(eq(schema.groupMembers.groupId, group.id), eq(schema.groupMembers.userId, user.id)));
  revalidatePath(back(group.id));
}

/* ----------------------------- Challenges -------------------------------- */

/**
 * Creates a challenge from a template (or custom values). Group challenges invite every other
 * member; a duel invites one opponent. Nobody takes part without accepting.
 */
export async function createContest(fd: FormData) {
  const user = await requireUser();
  const groupId = str(fd, "groupId");
  const m = groupId ? await membership(groupId, user.id) : null;
  if (groupId && !m) redirect("/groups");
  const home = groupId ? back(groupId, "challenges") : "/challenges";
  const fail = (e: string) => redirect(`${groupId ? `/groups/${groupId}/new` : "/challenges/new"}?error=${e}`);

  const tpl = template(str(fd, "template"));
  const kind = (tpl?.kind ?? str(fd, "kind")) as ChallengeKind;
  const metric = (tpl?.metric ?? str(fd, "metric")) as ChallengeMetric;
  if (!CHALLENGE_KINDS.includes(kind) || !CHALLENGE_METRICS.includes(metric)) fail("input");
  if ((kind === "personal") !== !groupId) fail("input");
  const weeks = Number(str(fd, "weeks") || tpl?.weeks);
  let target = Number((str(fd, "target") || String(tpl?.target ?? "")).replace(",", "."));
  const startWeek = str(fd, "start") === "next" ? addWeeks(currentWeek(), 1) : currentWeek();
  if (!(await rateLimit(`contest:${user.id}`, 30, 24 * 3600_000))) fail("rate");

  if (metric === "longRun") {
    const [me] = await memberData([user], "all", addWeeks(startWeek, -4));
    const t = longRunTarget(me, startWeek);
    if (!t) fail("baseline");
    target = t!;
  }
  if (!validContest({ kind, metric, target, weeks })) fail("input");

  let opponent: string | null = null;
  const db = await getDb();
  if (kind === "duel") {
    opponent = str(fd, "opponent");
    const [o] = await db
      .select({ u: schema.groupMembers.userId })
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, opponent), ne(schema.groupMembers.userId, user.id)))
      .limit(1);
    if (!o) fail("opponent");
  }

  const [contest] = await db
    .insert(schema.contests)
    .values({
      groupId: groupId || null,
      createdBy: user.id,
      kind,
      metric,
      target,
      startWeek,
      weeks,
      template: tpl?.id ?? null,
      title: str(fd, "title").slice(0, 60) || null,
    })
    .returning();
  const entries: (typeof schema.contestEntries.$inferInsert)[] = [{ contestId: contest.id, userId: user.id, status: "accepted" }];
  if (kind === "duel") entries.push({ contestId: contest.id, userId: opponent!, status: "invited" });
  if (kind === "coop" || kind === "compete") {
    for (const mem of await groupMembers(groupId)) {
      if (mem.id !== user.id) entries.push({ contestId: contest.id, userId: mem.id, status: "invited" });
    }
  }
  for (let i = 0; i < entries.length; i += 30) await db.insert(schema.contestEntries).values(entries.slice(i, i + 30));
  redirect(home);
}

async function contestFor(fd: FormData, userId: string) {
  const db = await getDb();
  const [c] = await db.select().from(schema.contests).where(eq(schema.contests.id, str(fd, "contestId"))).limit(1);
  if (!c) return null;
  if (c.groupId && !(await membership(c.groupId, userId))) return null;
  if (!c.groupId && c.createdBy !== userId) return null;
  return c;
}

export async function respondContest(fd: FormData) {
  const user = await requireUser();
  const c = await contestFor(fd, user.id);
  if (!c || c.status !== "active") redirect("/groups");
  const answer = str(fd, "answer") === "accept" ? "accepted" : "declined";
  const db = await getDb();
  await db
    .update(schema.contestEntries)
    .set({ status: answer })
    .where(and(eq(schema.contestEntries.contestId, c.id), eq(schema.contestEntries.userId, user.id)));
  revalidatePath(c.groupId ? back(c.groupId) : "/challenges");
}

export async function deleteContest(fd: FormData) {
  const user = await requireUser();
  const c = await contestFor(fd, user.id);
  if (!c) redirect("/groups");
  const owner = c.groupId ? (await membership(c.groupId, user.id))?.group.ownerId === user.id : false;
  if (c.createdBy !== user.id && !owner) redirect(c.groupId ? back(c.groupId, "challenges") : "/challenges");
  const db = await getDb();
  await db.delete(schema.contests).where(eq(schema.contests.id, c.id));
  await db.delete(schema.comments).where(eq(schema.comments.targetId, c.id));
  await db.delete(schema.reactions).where(eq(schema.reactions.targetId, c.id));
  redirect(c.groupId ? back(c.groupId, "challenges") : "/challenges");
}

/* ---------------------- Kudos, comments, reports ------------------------- */

export async function toggleReaction(fd: FormData) {
  const { user, group } = await asMember(fd);
  const type = str(fd, "targetType");
  const id = str(fd, "targetId");
  const emoji = str(fd, "emoji");
  if (!(TARGET_TYPES as readonly string[]).includes(type) || !(REACTIONS as readonly string[]).includes(emoji)) return;
  if (!(await rateLimit(`react:${user.id}`, 300, 3600_000)) || !(await targetVisible(group, type, id))) return;
  const db = await getDb();
  const key = and(
    eq(schema.reactions.groupId, group.id),
    eq(schema.reactions.targetType, type as (typeof TARGET_TYPES)[number]),
    eq(schema.reactions.targetId, id),
    eq(schema.reactions.userId, user.id),
    eq(schema.reactions.emoji, emoji as (typeof REACTIONS)[number]),
  );
  const removed = await db.delete(schema.reactions).where(key).returning();
  if (!removed.length) {
    await db.insert(schema.reactions).values({
      groupId: group.id,
      targetType: type as (typeof TARGET_TYPES)[number],
      targetId: id,
      userId: user.id,
      emoji: emoji as (typeof REACTIONS)[number],
    });
  }
  revalidatePath(back(group.id));
}

const COMMENT_MAX = 280;

export async function addComment(fd: FormData) {
  const { user, group } = await asMember(fd);
  const type = str(fd, "targetType");
  const id = str(fd, "targetId");
  const body = str(fd, "body").replace(/\s+/g, " ").slice(0, COMMENT_MAX);
  if (!body || !(TARGET_TYPES as readonly string[]).includes(type)) return;
  if (!(await rateLimit(`comment:${user.id}`, 40, 3600_000)) || !(await targetVisible(group, type, id))) return;
  const db = await getDb();
  await db.insert(schema.comments).values({ groupId: group.id, targetType: type as (typeof TARGET_TYPES)[number], targetId: id, userId: user.id, body });
  revalidatePath(back(group.id));
}

/** Authors delete their own comments; the group admin can remove any comment in the group. */
export async function deleteComment(fd: FormData) {
  const { user, group } = await asMember(fd);
  const db = await getDb();
  const [c] = await db
    .select()
    .from(schema.comments)
    .where(and(eq(schema.comments.id, str(fd, "commentId")), eq(schema.comments.groupId, group.id)))
    .limit(1);
  if (c && (c.userId === user.id || group.ownerId === user.id)) await db.delete(schema.comments).where(eq(schema.comments.id, c.id));
  revalidatePath(back(group.id));
}

export async function reportComment(fd: FormData) {
  const { user, group } = await asMember(fd);
  const db = await getDb();
  const [c] = await db
    .select({ id: schema.comments.id })
    .from(schema.comments)
    .where(and(eq(schema.comments.id, str(fd, "commentId")), eq(schema.comments.groupId, group.id)))
    .limit(1);
  if (c) await db.insert(schema.reports).values({ commentId: c.id, reporterId: user.id }).onConflictDoNothing();
  revalidatePath(back(group.id));
}

export async function dismissReports(fd: FormData) {
  const { group } = await asOwner(fd);
  const db = await getDb();
  const [c] = await db
    .select({ id: schema.comments.id })
    .from(schema.comments)
    .where(and(eq(schema.comments.id, str(fd, "commentId")), eq(schema.comments.groupId, group.id)))
    .limit(1);
  if (c) await db.delete(schema.reports).where(eq(schema.reports.commentId, c.id));
  revalidatePath(back(group.id));
}
