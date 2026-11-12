import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/auth";
import { authenticationOptions, sameOrigin } from "@/lib/passkeys";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 });
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (!(await rateLimit(`login:${ip}`, 60, 15 * 60_000))) return NextResponse.json({ error: "rate" }, { status: 429 });
  return NextResponse.json(await authenticationOptions());
}
