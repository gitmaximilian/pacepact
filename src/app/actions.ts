"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { EXPERIENCE, RUN_TYPES } from "@/db/schema";
import { destroySession, rateLimit, requireUser } from "@/lib/auth";
import { inviteCode, randomToken, sha256 } from "@/lib/crypto";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { ImportError, parseActivityFile } from "@/lib/import";
import { HALF_MARATHON_KM, MARATHON_KM, parseDuration } from "@/lib/pace";
import { isPlausibleRun, safeLocalPath } from "@/lib/plausibility";
import { getOAuthProvider } from "@/lib/providers/registry";
import { syncConnection } from "@/lib/providers/sync";
import { storeRuns } from "@/lib/runs-store";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* --------------------------------- Auth ---------------------------------- */

export async function signOut() {
  await destroySession();
  redirect("/");
}

/** Removes a passkey. The last passkey cannot be removed (the account would be unreachable). */
export async function deletePasskey(fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  const all = await db.select({ id: schema.passkeys.id }).from(schema.passkeys).where(eq(schema.passkeys.userId, user.id));
  if (all.length > 1) {
    await db.delete(schema.passkeys).where(and(eq(schema.passkeys.id, str(fd, "id")), eq(schema.passkeys.userId, user.id)));
  }
  redirect("/settings");
}

/* -------------------------------- Locale --------------------------------- */

export async function setLocale(fd: FormData) {
  const locale = str(fd, "locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  const { currentUser } = await import("@/lib/auth");
  const user = await currentUser();
  if (user) {
    const db = await getDb();
    await db.update(schema.users).set({ locale }).where(eq(schema.users.id, user.id));
  }
  redirect(safeLocalPath(str(fd, "back")));
}

/* ------------------------- Heart-rate consent ---------------------------- */

/** Grants or withdraws consent (Art. 9 Abs. 2 lit. a, Art. 7 Abs. 3 DSGVO). Withdrawal deletes stored heart rates. */
export async function setHrConsent(fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  if (str(fd, "consent") === "grant") {
    // Consent must be an explicit, separate act (Art. 9 Abs. 2 lit. a DSGVO).
    if (fd.get("confirm") !== "on") redirect("/settings");
    await db.update(schema.users).set({ hrConsentAt: new Date() }).where(eq(schema.users.id, user.id));
    redirect("/settings?hr=granted");
  }
  await db.update(schema.users).set({ hrConsentAt: null }).where(eq(schema.users.id, user.id));
  await db.update(schema.runs).set({ avgHr: null, maxHr: null }).where(eq(schema.runs.userId, user.id));
  redirect("/settings?hr=withdrawn");
}

/* ------------------------------- Welcome --------------------------------- */

const GOAL_KM: Record<string, number> = { half: HALF_MARATHON_KM, marathon: MARATHON_KM, tenK: 10, fiveK: 5, fitness: 5 };

/** Saves the welcome flow: goal, starting point, runs per week and strength training. */
export async function completeOnboarding(fd: FormData) {
  const user = await requireUser();
  const goal = str(fd, "goal");
  const experience = str(fd, "experience");
  const runsPerWeek = Number(str(fd, "runsPerWeek"));
  const raceDate = str(fd, "raceDate");
  const target = str(fd, "target");
  const targetSeconds = target && goal !== "fitness" ? parseDuration(target) : null;
  const today = new Date().toISOString().slice(0, 10);
  if (
    !(goal in GOAL_KM) ||
    !(EXPERIENCE as readonly string[]).includes(experience) ||
    ![2, 3, 4].includes(runsPerWeek) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raceDate) ||
    raceDate <= today ||
    (target && goal !== "fitness" && !targetSeconds)
  ) {
    redirect("/welcome?error=input");
  }
  const db = await getDb();
  await db
    .update(schema.users)
    .set({
      onboardedAt: new Date(),
      experience: experience as (typeof EXPERIENCE)[number],
      runsPerWeek,
      strength: str(fd, "strength") === "yes",
    })
    .where(eq(schema.users.id, user.id));
  await db.update(schema.goals).set({ active: false }).where(eq(schema.goals.userId, user.id));
  await db.insert(schema.goals).values({
    userId: user.id,
    raceName: str(fd, "raceName").slice(0, 120) || "Pacepact",
    raceDate,
    distanceKm: GOAL_KM[goal],
    targetSeconds,
    active: true,
  });
  redirect("/dashboard?welcome=1");
}

export async function skipOnboarding() {
  const user = await requireUser();
  const db = await getDb();
  await db.update(schema.users).set({ onboardedAt: new Date() }).where(eq(schema.users.id, user.id));
  redirect("/dashboard");
}

/* --------------------------------- Goal ---------------------------------- */

export async function saveGoal(fd: FormData) {
  const user = await requireUser();
  const raceName = str(fd, "raceName").slice(0, 120) || "Race";
  const raceDate = str(fd, "raceDate");
  const preset = str(fd, "distance");
  const distanceKm = preset === "custom" ? Number(str(fd, "customKm").replace(",", ".")) : Number(preset);
  const target = str(fd, "target");
  const targetSeconds = target ? parseDuration(target) : null;
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raceDate) || raceDate < today) redirect("/goal?error=date");
  if (!(distanceKm > 0 && distanceKm <= 400) || (target && !targetSeconds)) redirect("/goal?error=input");
  const db = await getDb();
  await db.update(schema.goals).set({ active: false }).where(eq(schema.goals.userId, user.id));
  await db.insert(schema.goals).values({ userId: user.id, raceName, raceDate, distanceKm, targetSeconds, active: true });
  redirect("/dashboard?saved=goal");
}

/* --------------------------------- Runs ---------------------------------- */

export async function addRun(fd: FormData) {
  const user = await requireUser();
  const date = str(fd, "date");
  const time = str(fd, "time") || "12:00";
  const startedAt = new Date(`${date}T${time}:00`);
  const distanceKm = Number(str(fd, "distanceKm").replace(",", "."));
  const durationSec = parseDuration(str(fd, "duration"));
  const runType = str(fd, "runType");
  const intOrNull = (k: string) => {
    const v = str(fd, k);
    return v ? Math.round(Number(v)) : null;
  };
  if (Number.isNaN(startedAt.getTime()) || !(distanceKm >= 0) || !durationSec || !(RUN_TYPES as readonly string[]).includes(runType)) {
    redirect("/runs/new?error=input");
  }
  if (!isPlausibleRun({ distanceKm, durationSec: durationSec! })) redirect("/runs/new?error=pace");
  await storeRuns(user.id, "manual", [
    {
      startedAt,
      distanceKm,
      durationSec,
      avgHr: intOrNull("avgHr"),
      maxHr: intOrNull("maxHr"),
      effort: intOrNull("effort"),
      walkBreaks: fd.get("walkBreaks") === "on",
      runType: runType as (typeof RUN_TYPES)[number],
      notes: str(fd, "notes").slice(0, 1000) || null,
      externalId: `manual:${randomToken(9)}`,
    },
  ]);
  redirect("/runs?saved=1");
}

export async function deleteRun(fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(schema.runs).where(and(eq(schema.runs.id, str(fd, "id")), eq(schema.runs.userId, user.id)));
  redirect("/runs");
}

export async function updateRunType(fd: FormData) {
  const user = await requireUser();
  const runType = str(fd, "runType");
  if (!(RUN_TYPES as readonly string[]).includes(runType)) redirect("/runs");
  const db = await getDb();
  await db
    .update(schema.runs)
    .set({ runType: runType as (typeof RUN_TYPES)[number] })
    .where(and(eq(schema.runs.id, str(fd, "id")), eq(schema.runs.userId, user.id)));
  redirect("/runs");
}

export async function importFiles(fd: FormData) {
  const user = await requireUser();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  let inserted = 0;
  let skipped = 0;
  for (const file of files.slice(0, 50)) {
    try {
      const { source, runs } = await parseActivityFile(file.name, await file.arrayBuffer(), { onlyName: str(fd, "onlyName") || undefined });
      const res = await storeRuns(user.id, source, runs);
      inserted += res.inserted;
      skipped += res.skipped;
    } catch (err) {
      const msg = err instanceof ImportError ? err.message : "unreadable file";
      redirect(`/runs?importError=${encodeURIComponent(`${file.name}: ${msg}`)}`);
    }
  }
  redirect(`/runs?imported=${inserted}&skipped=${skipped}`);
}

/* -------------------------------- Groups --------------------------------- */

export async function createGroup(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name").slice(0, 60);
  if (!name) redirect("/groups?error=name");
  const db = await getDb();
  let group: typeof schema.groups.$inferSelect | undefined;
  for (let i = 0; i < 5 && !group; i++) {
    [group] = await db.insert(schema.groups).values({ name, ownerId: user.id, inviteCode: inviteCode() }).onConflictDoNothing().returning();
  }
  if (!group) redirect("/groups?error=name");
  await db.insert(schema.groupMembers).values({ groupId: group.id, userId: user.id, role: "owner" });
  redirect(`/groups/${group.id}`);
}

export async function joinGroup(fd: FormData) {
  const user = await requireUser();
  const code = str(fd, "code").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!rateLimit(`join:${user.id}`, 20)) redirect("/groups?error=code");
  const db = await getDb();
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.inviteCode, code)).limit(1);
  if (!group) redirect("/groups?error=code");
  await db.insert(schema.groupMembers).values({ groupId: group.id, userId: user.id }).onConflictDoNothing();
  redirect(`/groups/${group.id}`);
}

/** Hands a group to its longest-standing other member, or deletes it if nobody else is in it. */
async function handOverOrDelete(groupId: string, leavingUserId: string) {
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

export async function leaveGroup(fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  const groupId = str(fd, "groupId");
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId)).limit(1);
  if (group?.ownerId === user.id) await handOverOrDelete(groupId, user.id);
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, user.id)));
  redirect("/groups");
}

/* ------------------------------ Connections ------------------------------ */

export async function syncNow(fd: FormData) {
  const user = await requireUser();
  const provider = str(fd, "provider");
  const p = getOAuthProvider(provider);
  if (!p) redirect("/connections");
  let n = 0;
  try {
    n = await syncConnection(user.id, provider);
  } catch (err) {
    redirect(`/connections?error=${provider}&msg=${encodeURIComponent(err instanceof Error ? err.message.slice(0, 120) : "error")}`);
  }
  redirect(`/connections?ok=${provider}&n=${n}`);
}

export async function disconnect(fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  await db
    .delete(schema.connections)
    .where(and(eq(schema.connections.userId, user.id), eq(schema.connections.provider, str(fd, "provider"))));
  redirect("/connections");
}

/* ------------------------------ API tokens ------------------------------- */

export async function createApiToken(_prev: { token: string | null }, fd: FormData): Promise<{ token: string | null }> {
  const user = await requireUser();
  const label = str(fd, "label").slice(0, 60) || "Token";
  const token = `pp_${randomToken(24)}`;
  const db = await getDb();
  await db.insert(schema.apiTokens).values({ userId: user.id, label, tokenHash: sha256(token) });
  revalidatePath("/settings");
  // Returned once to the browser; only the hash is stored.
  return { token };
}

export async function revokeApiToken(fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(schema.apiTokens).where(and(eq(schema.apiTokens.id, str(fd, "id")), eq(schema.apiTokens.userId, user.id)));
  redirect("/settings");
}

export async function deleteAccount(fd: FormData) {
  const user = await requireUser();
  if (str(fd, "confirm") !== "DELETE") redirect("/settings");
  const db = await getDb();
  const owned = await db.select().from(schema.groups).where(eq(schema.groups.ownerId, user.id));
  for (const g of owned) await handOverOrDelete(g.id, user.id);
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  (await cookies()).delete("pp_session");
  redirect("/");
}
