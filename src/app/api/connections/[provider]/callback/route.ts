import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { decodeState, STATE_COOKIE } from "@/lib/oauth-state";
import { appUrl, getOAuthProvider } from "@/lib/providers/registry";
import { exchangeCode, saveConnection, syncConnection } from "@/lib/providers/sync";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const back = (q: string) => {
    const res = NextResponse.redirect(`${appUrl()}/connections?${q}`);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/connections" });
    return res;
  };
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/signin`);
  const p = getOAuthProvider(provider);
  const st = decodeState(req.cookies.get(STATE_COOKIE)?.value);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!p || !st || st.provider !== provider || !state || state !== st.state) {
    return back(`error=${encodeURIComponent(provider)}&msg=state`);
  }
  if (!code) return back(`error=${p.id}&msg=${encodeURIComponent(req.nextUrl.searchParams.get("error") ?? "denied")}`);
  try {
    const tokens = await exchangeCode(p, code, st.verifier);
    await saveConnection(user.id, p, tokens);
    const n = await syncConnection(user.id, p.id);
    return back(`ok=${p.id}&n=${n}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    return back(`error=${p.id}&msg=${encodeURIComponent(msg.slice(0, 120))}`);
  }
}
