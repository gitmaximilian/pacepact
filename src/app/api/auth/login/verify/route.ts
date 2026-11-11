import { NextResponse, type NextRequest } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { createSession } from "@/lib/auth";
import { sameOrigin, verifyAuthentication } from "@/lib/passkeys";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as AuthenticationResponseJSON | null;
  if (!body) return NextResponse.json({ error: "input" }, { status: 400 });
  const userId = await verifyAuthentication(body);
  if (!userId) return NextResponse.json({ error: "unknown" }, { status: 400 });
  await createSession(userId);
  return NextResponse.json({ ok: true });
}
