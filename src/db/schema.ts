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
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

export const connections = sqliteTable(
  "connections",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalUserId: text("external_user_id"),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    expiresAt: ts("expires_at"),
    lastSyncAt: ts("last_sync_at"),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("connections_user_provider_uq").on(t.userId, t.provider),
    index("connections_provider_external_idx").on(t.provider, t.externalUserId),
  ],
);

export const apiTokens = sqliteTable("api_tokens", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  label: text("label").notNull(),
  createdAt: ts("created_at").notNull().$defaultFn(now),
  lastUsedAt: ts("last_used_at"),
});

export type User = typeof users.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type Connection = typeof connections.$inferSelect;
