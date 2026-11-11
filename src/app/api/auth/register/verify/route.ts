import { NextResponse, type NextRequest } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { createSession, currentUser } from "@/lib/auth";
import { sameOrigin, verifyRegistration } from "@/lib/passkeys";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 });
  const mode = req.nextUrl.searchParams.get("mode") === "add" ? "add" : "register";
  const body = (await req.json().catch(() => null)) as RegistrationResponseJSON | null;
  if (!body) return NextResponse.json({ error: "input" }, { status: 400 });
  const sessionUser = mode === "add" ? await currentUser() : null;
  const userId = await verifyRegistration(mode, body, sessionUser?.id ?? null);
  if (!userId) return NextResponse.json({ error: "verify" }, { status: 400 });
  if (mode === "register") await createSession(userId);
  return NextResponse.json({ ok: true });
}
