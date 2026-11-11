import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { and, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/db";
import { appUrl } from "./providers/registry";

const CHALLENGE_COOKIE = "pp_challenge";
const CHALLENGE_MS = 5 * 60_000;

export interface Pending {
  name: string;
  locale: string;
  hrConsent: boolean;
}

function relyingParty() {
  const url = new URL(appUrl());
  return { rpID: url.hostname, origin: url.origin };
}

/** Rejects cross-site requests: the Origin header must be our own origin. */
export function sameOrigin(req: Request): boolean {
  return req.headers.get("origin") === relyingParty().origin;
}

async function saveChallenge(
  challenge: string,
  purpose: "register" | "add" | "login",
  userId: string | null,
  pending: Pending | null,
) {
  const db = await getDb();
  await db.delete(schema.challenges).where(lt(schema.challenges.expiresAt, new Date()));
  const id = crypto.randomUUID();
  await db.insert(schema.challenges).values({
    id,
    challenge,
    purpose,
    userId,
    pending: pending ? JSON.stringify(pending) : null,
    expiresAt: new Date(Date.now() + CHALLENGE_MS),
  });
  (await cookies()).set(CHALLENGE_COOKIE, id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: CHALLENGE_MS / 1000,
  });
}

/** Reads and deletes the challenge (single use). */
async function takeChallenge(purpose: "register" | "add" | "login") {
  const jar = await cookies();
  const id = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete({ name: CHALLENGE_COOKIE, path: "/api/auth" });
  if (!id) return null;
  const db = await getDb();
  const [row] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, id)).limit(1);
  await db.delete(schema.challenges).where(eq(schema.challenges.id, id));
  if (!row || row.purpose !== purpose || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

/** Options for a new account ("register") or an extra passkey on an existing one ("add"). */
export async function registrationOptions(
  purpose: "register" | "add",
  user: { id: string; name: string } | null,
  pending: Pending | null,
) {
  const db = await getDb();
  const userId = user?.id ?? crypto.randomUUID();
  const existing = user
    ? await db.select({ id: schema.passkeys.id, transports: schema.passkeys.transports }).from(schema.passkeys).where(eq(schema.passkeys.userId, user.id))
    : [];
  const name = user?.name ?? pending?.name ?? "Runner";
  const options = await generateRegistrationOptions({
    rpName: "Pacepact",
    rpID: relyingParty().rpID,
    userID: new TextEncoder().encode(userId),
    userName: `Pacepact · ${name}`,
    userDisplayName: name,
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: JSON.parse(c.transports) as AuthenticatorTransport[] })),
  });
  await saveChallenge(options.challenge, purpose, userId, pending);
  return options;
}

/** Verifies a registration. Returns the user ID the passkey belongs to, or null. */
export async function verifyRegistration(purpose: "register" | "add", body: RegistrationResponseJSON, sessionUserId: string | null) {
  const chal = await takeChallenge(purpose);
  if (!chal?.userId) return null;
  if (purpose === "add" && chal.userId !== sessionUserId) return null;
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: chal.challenge,
      expectedOrigin: relyingParty().origin,
      expectedRPID: relyingParty().rpID,
      requireUserVerification: false,
    });
  } catch {
    return null;
  }
  if (!verification.verified || !verification.registrationInfo) return null;
  const { credential } = verification.registrationInfo;
  const db = await getDb();
  if (purpose === "register") {
    const pending = JSON.parse(chal.pending ?? "{}") as Pending;
    const nowDate = new Date();
    await db.insert(schema.users).values({
      id: chal.userId,
      name: pending.name,
      locale: pending.locale === "de" ? "de" : "en",
      termsAcceptedAt: nowDate,
      hrConsentAt: pending.hrConsent ? nowDate : null,
    });
  }
  await db.insert(schema.passkeys).values({
    id: credential.id,
    userId: chal.userId,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: JSON.stringify(credential.transports ?? []),
    lastUsedAt: new Date(),
  });
  return chal.userId;
}

export async function authenticationOptions() {
  // Empty allowCredentials: the browser offers the stored passkeys, no username needed.
  const options = await generateAuthenticationOptions({
    rpID: relyingParty().rpID,
    userVerification: "preferred",
    allowCredentials: [],
  });
  await saveChallenge(options.challenge, "login", null, null);
  return options;
}

/** Verifies a sign-in. Returns the user ID, or null. */
export async function verifyAuthentication(body: AuthenticationResponseJSON) {
  const chal = await takeChallenge("login");
  if (!chal || typeof body?.id !== "string") return null;
  const db = await getDb();
  const [cred] = await db.select().from(schema.passkeys).where(eq(schema.passkeys.id, body.id)).limit(1);
  if (!cred) return null;
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: chal.challenge,
      expectedOrigin: relyingParty().origin,
      expectedRPID: relyingParty().rpID,
      requireUserVerification: false,
      credential: {
        id: cred.id,
        publicKey: isoBase64URL.toBuffer(cred.publicKey),
        counter: cred.counter,
        transports: JSON.parse(cred.transports) as AuthenticatorTransport[],
      },
    });
  } catch {
    return null;
  }
  if (!verification.verified) return null;
  await db
    .update(schema.passkeys)
    .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
    .where(and(eq(schema.passkeys.id, cred.id), eq(schema.passkeys.userId, cred.userId)));
  return cred.userId;
}
