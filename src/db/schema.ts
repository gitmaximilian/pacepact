import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Cloudflare D1 (SQLite). Timestamps are stored as epoch milliseconds. */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const now = () => new Date();

export const users = sqliteTable("users", {
  id: id(),
  /** Display name, freely chosen (a nickname is fine). No email, no password: sign-in is passkey-only. */
  name: text("name").notNull(),
  locale: text("locale").notNull().default("en"),
  /** Explicit consent to store heart-rate data (health data, Art. 9 GDPR). Null = no consent. */
  hrConsentAt: ts("hr_consent_at"),
  /** When the user confirmed being at least 14 and having read the privacy notice. */
  termsAcceptedAt: ts("terms_accepted_at"),
  /** Updated at most once a day; accounts inactive for two years are deleted. */
  lastActiveAt: ts("last_active_at").notNull().$defaultFn(now),
  /** Set when the welcome flow was finished or skipped. */
  onboardedAt: ts("onboarded_at"),
  /** Self-reported starting point: "new" (run/walk), "easy30" (30 easy minutes) or "regular". */
  experience: text("experience").$type<Experience>(),
  /** Planned runs per week (2–4). */
  runsPerWeek: integer("runs_per_week").notNull().default(3),
  /** Does strength training on the side (affects plan hints). */
  strength: integer("strength", { mode: "boolean" }).notNull().default(false),
  /** Version of the precomputed weekly stats (run_weeks); older versions are rebuilt on demand. */
  statsVersion: integer("stats_version").notNull().default(0),
  createdAt: ts("created_at").notNull().$defaultFn(now),
});

export const EXPERIENCE = ["new", "easy30", "regular"] as const;
export type Experience = (typeof EXPERIENCE)[number];

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the session token
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** WebAuthn credentials (passkeys). Only public keys are stored. */
export const passkeys = sqliteTable(
  "passkeys",
  {
    id: text("id").primaryKey(), // credential ID (base64url)
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(), // base64url
    counter: integer("counter").notNull().default(0),
    transports: text("transports").notNull().default("[]"),
    createdAt: ts("created_at").notNull().$defaultFn(now),
    lastUsedAt: ts("last_used_at"),
  },
  (t) => [index("passkeys_user_idx").on(t.userId)],
);

/** One-time WebAuthn challenges, valid for five minutes. */
export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  /** "register" (new account), "add" (extra passkey for an existing account) or "login". */
  purpose: text("purpose").$type<"register" | "add" | "login">().notNull(),
  userId: text("user_id"),
  /** Sign-up details kept until the passkey is verified (JSON: name, locale, hrConsent). */
  pending: text("pending"),
  expiresAt: ts("expires_at").notNull(),
});

export const goals = sqliteTable(
  "goals",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    raceName: text("race_name").notNull(),
    raceDate: text("race_date").notNull(), // YYYY-MM-DD
    distanceKm: real("distance_km").notNull(),
    targetSeconds: integer("target_seconds"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: ts("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

export const RUN_TYPES = ["run1", "run2", "run3", "test", "other"] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const runs = sqliteTable(
  "runs",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: ts("started_at").notNull(),
    runType: text("run_type").$type<RunType>().notNull().default("other"),
    distanceKm: real("distance_km").notNull(),
    durationSec: integer("duration_sec").notNull(),
    avgHr: integer("avg_hr"),
    maxHr: integer("max_hr"),
    effort: integer("effort"),
    walkBreaks: integer("walk_breaks", { mode: "boolean" }).notNull().default(false),
    /** False when the source cannot tell walk breaks apart (watch imports): then walkBreaks means "unknown". */
    walkKnown: integer("walk_known", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),
    source: text("source").notNull().default("manual"),
    externalId: text("external_id"),
    createdAt: ts("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    index("runs_user_started_idx").on(t.userId, t.startedAt),
    uniqueIndex("runs_user_source_external_uq").on(t.userId, t.source, t.externalId),
  ],
);

export const groups = sqliteTable("groups", {
  id: id(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Only runs imported from Apple Health count in rankings and challenges. */
  onlyImported: integer("only_imported", { mode: "boolean" }).notNull().default(false),
  /** Shared race for the countdown (optional). */
  raceName: text("race_name"),
  raceDate: text("race_date"), // YYYY-MM-DD
  createdAt: ts("created_at").notNull().$defaultFn(now),
});

export const groupMembers = sqliteTable(
  "group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "member">().notNull().default("member"),
    joinedAt: ts("joined_at").notNull().$defaultFn(now),
    /** Privacy per membership. By default the group sees minutes, run counts and plan progress only. */
    shareDistance: integer("share_distance", { mode: "boolean" }).notNull().default(false),
    sharePace: integer("share_pace", { mode: "boolean" }).notNull().default(false),
    /** Voluntary: registered for the group race (null = not said). */
    raceRegistered: integer("race_registered", { mode: "boolean" }),
    /** For "since your last visit" hints. */
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

/**
 * Precomputed weekly totals per runner, rebuilt whenever a run is stored, changed or deleted.
 * Implausible runs are left out. variant "all" = every run, "device" = only runs imported from Apple Health.
 */
export const runWeeks = sqliteTable(
  "run_weeks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    week: text("week").notNull(), // Monday, YYYY-MM-DD
    variant: text("variant").$type<"all" | "device">().notNull(),
    runs: integer("runs").notNull().default(0),
    sec: integer("sec").notNull().default(0),
    km: real("km").notNull().default(0),
    longestSec: integer("longest_sec").notNull().default(0),
    longestKm: real("longest_km").notNull().default(0),
    continuousSec: integer("continuous_sec").notNull().default(0),
    walkRuns: integer("walk_runs").notNull().default(0),
    easySec: integer("easy_sec").notNull().default(0),
    easyKm: real("easy_km").notNull().default(0),
    testKm: real("test_km").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.week, t.variant] })],
);

/** Personal milestones (first 30 minutes without walking, first 10 km, …). */
export const milestones = sqliteTable(
  "milestones",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<MilestoneKind>().notNull(),
    value: integer("value").notNull(),
    achievedAt: ts("achieved_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.value] }), index("milestones_user_time_idx").on(t.userId, t.achievedAt)],
);
export type MilestoneKind = "continuous" | "distance" | "test";

export const CHALLENGE_KINDS = ["coop", "compete", "duel", "personal"] as const;
export type ChallengeKind = (typeof CHALLENGE_KINDS)[number];
export const CHALLENGE_METRICS = ["minutes", "runs", "km", "planWeeks", "continuous", "longRun", "test"] as const;
export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];

/** Group and personal challenges (called "contests" in code; the WebAuthn table is already named "challenges"). */
export const contests = sqliteTable(
  "contests",
  {
    id: id(),
    /** Null for personal challenges. */
    groupId: text("group_id").references(() => groups.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").$type<ChallengeKind>().notNull(),
    metric: text("metric").$type<ChallengeMetric>().notNull(),
    target: real("target").notNull(),
    startWeek: text("start_week").notNull(), // Monday, YYYY-MM-DD
    weeks: integer("weeks").notNull(),
    template: text("template"),
    title: text("title"),
    status: text("status").$type<"active" | "done">().notNull().default("active"),
    createdAt: ts("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("contests_group_idx").on(t.groupId, t.status), index("contests_creator_idx").on(t.createdBy)],
);

export const contestEntries = sqliteTable(
  "contest_entries",
  {
    contestId: text("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<"invited" | "accepted" | "declined">().notNull(),
    /** Filled when the challenge is finished. */
    score: real("score"),
    rank: integer("rank"),
    badge: text("badge"),
  },
  (t) => [primaryKey({ columns: [t.contestId, t.userId] }), index("contest_entries_user_idx").on(t.userId)],
);

export const REACTIONS = ["clap", "fire", "strong", "party"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const TARGET_TYPES = ["run", "contest", "milestone"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const reactions = sqliteTable(
  "reactions",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    targetType: text("target_type").$type<TargetType>().notNull(),
    targetId: text("target_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").$type<Reaction>().notNull(),
    createdAt: ts("created_at").notNull().$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.targetType, t.targetId, t.userId, t.emoji] }), index("reactions_target_idx").on(t.targetId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: id(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    targetType: text("target_type").$type<TargetType>().notNull(),
    targetId: text("target_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("comments_group_target_idx").on(t.groupId, t.targetId), index("comments_target_idx").on(t.targetId)],
);

export const reports = sqliteTable(
  "reports",
  {
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.reporterId] })],
);

/** Fixed-window rate limits shared by all Worker instances. Keys contain hashes, never raw IPs. */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});

export type User = typeof users.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type RunWeek = typeof runWeeks.$inferSelect;
export type Contest = typeof contests.$inferSelect;
