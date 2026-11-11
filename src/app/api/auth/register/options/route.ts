import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentUser, rateLimit } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { registrationOptions, sameOrigin } from "@/lib/passkeys";

const Body = z.object({
  mode: z.enum(["register", "add"]),
  name: z.string().trim().min(1).max(60).optional(),
  terms: z.boolean().optional(),
  hrConsent: z.boolean().optional(),
  locale: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origin" }, { status: 403 });
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (!rateLimit(`register:${ip}`, 20, 60 * 60_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "input" }, { status: 400 });
  const b = parsed.data;
  if (b.mode === "add") {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
    return NextResponse.json(await registrationOptions("add", user, null));
  }
  if (!b.name) return NextResponse.json({ error: "input" }, { status: 400 });
  if (!b.terms) return NextResponse.json({ error: "terms" }, { status: 400 });
  const options = await registrationOptions("register", null, {
    name: b.name,
    locale: isLocale(b.locale) ? b.locale : "en",
    hrConsent: b.hrConsent === true,
  });
  return NextResponse.json(options);
}
