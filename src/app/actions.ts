"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { EXPERIENCE, RUN_TYPES } from "@/db/schema";
import { deleteUserData, destroySession, requireUser } from "@/lib/auth";
import { randomToken, sha256 } from "@/lib/crypto";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { ImportError, parseActivityFile } from "@/lib/import";
import { HALF_MARATHON_KM, MARATHON_KM, parseDuration } from "@/lib/pace";
import { isPlausibleRun, safeLocalPath } from "@/lib/plausibility";
import { getOAuthProvider } from "@/lib/providers/registry";
import { freshTokens, syncConnection } from "@/lib/providers/sync";
import { deauthorizeStrava } from "@/lib/providers/strava";
import { storeRuns } from "@/lib/runs-store";
import { joinByCode } from "@/lib/social/join";
import { refreshWeeks, weeksOf } from "@/lib/social/store";

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
  const groupId = await joinByCode(user.id, str(fd, "join"));
  redirect(groupId ? `/groups/${groupId}?joined=1` : "/dashboard?welcome=1");
}

/** `join` is the invite code the runner signed up with: they join right after the welcome flow. */
export async function skipOnboarding(join?: string) {
  const user = await requireUser();
  const db = await getDb();
  await db.update(schema.users).set({ onboardedAt: new Date() }).where(eq(schema.users.id, user.id));
  const groupId = await joinByCode(user.id, typeof join === "string" ? join : "");
  redirect(groupId ? `/groups/${groupId}?joined=1` : "/dashboard");
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
  redirect(safeLocalPath(str(fd, "back"), "/runs?saved=1"));
}

export async function deleteRun(fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  const [run] = await db
    .delete(schema.runs)
    .where(and(eq(schema.runs.id, str(fd, "id")), eq(schema.runs.userId, user.id)))
    .returning({ id: schema.runs.id, startedAt: schema.runs.startedAt });
  if (run) {
    // Remove what others attached to the run, and milestones it alone stood for.
    await db.delete(schema.comments).where(eq(schema.comments.targetId, run.id));
    await db.delete(schema.reactions).where(eq(schema.reactions.targetId, run.id));
    await db
      .delete(schema.milestones)
      .where(and(eq(schema.milestones.userId, user.id), eq(schema.milestones.achievedAt, run.startedAt)));
    await refreshWeeks(user.id, weeksOf([run.startedAt]));
  }
  redirect("/runs");
}

export async function updateRunType(fd: FormData) {
  const user = await requireUser();
  const runType = str(fd, "runType");
  if (!(RUN_TYPES as readonly string[]).includes(runType)) redirect("/runs");
  const db = await getDb();
  // Walk breaks can be confirmed afterwards for imports that cannot tell (Apple Health, Strava, files).
  const walk = str(fd, "walk");
  const walkSet = walk === "no" || walk === "yes" ? { walkKnown: true, walkBreaks: walk === "yes" } : fd.has("walk") ? { walkKnown: false, walkBreaks: false } : {};
  const [run] = await db
    .update(schema.runs)
    .set({ runType: runType as (typeof RUN_TYPES)[number], ...walkSet })
    .where(and(eq(schema.runs.id, str(fd, "id")), eq(schema.runs.userId, user.id)))
    .returning({ startedAt: schema.runs.startedAt });
  if (run) await refreshWeeks(user.id, weeksOf([run.startedAt]));
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

/** Disconnects a service: revokes access there, deletes the tokens and, by default, the runs imported from it. */
export async function disconnect(fd: FormData) {
  const user = await requireUser();
  const provider = str(fd, "provider");
  const p = getOAuthProvider(provider);
  if (!p) redirect("/connections");
  const db = await getDb();
  const [conn] = await db
    .delete(schema.connections)
    .where(and(eq(schema.connections.userId, user.id), eq(schema.connections.provider, provider)))
    .returning();
  if (conn && provider === "strava") {
    try {
      await deauthorizeStrava((await freshTokens(conn, p)).accessToken);
    } catch {
      // Token already invalid: nothing left to revoke.
    }
  }
  if (fd.get("deleteRuns") === "on") {
    await db.delete(schema.runs).where(and(eq(schema.runs.userId, user.id), eq(schema.runs.source, provider)));
  }
  redirect("/connections?disconnected=1");
}

/** Creates the token for the Apple Health sync and returns it once. */
export async function createAppleToken(_prev: { token: string | null }, _fd: FormData): Promise<{ token: string | null }> {
  const user = await requireUser();
  const token = `pp_${randomToken(24)}`;
  const db = await getDb();
  await db.insert(schema.apiTokens).values({ userId: user.id, label: "Apple Health", tokenHash: sha256(token) });
  revalidatePath("/connections");
  return { token };
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
  await deleteUserData(user.id);
  (await cookies()).delete("pp_session");
  redirect("/");
}
