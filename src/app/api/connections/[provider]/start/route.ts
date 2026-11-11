import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { encodeState, newState, pkceChallenge, STATE_COOKIE } from "@/lib/oauth-state";
import { appUrl, clientCredentials, getOAuthProvider, isConfigured, redirectUri } from "@/lib/providers/registry";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/signin`);
  const p = getOAuthProvider(provider);
  if (!p || !isConfigured(p)) return NextResponse.redirect(`${appUrl()}/connections`);

  const st = newState(p.id, !!p.pkce);
  const url = new URL(p.authorizeUrl);
  url.searchParams.set("client_id", clientCredentials(p)!.id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri(p));
  url.searchParams.set("scope", p.scopes.join(p.scopeSeparator ?? " "));
  url.searchParams.set("state", st.state);
  if (st.verifier) {
    url.searchParams.set("code_challenge", pkceChallenge(st.verifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) url.searchParams.set(k, v);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set(STATE_COOKIE, encodeState(st), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/connections",
    maxAge: 600,
  });
  return res;
}
