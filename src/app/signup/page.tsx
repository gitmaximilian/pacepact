import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { param, type SearchParams } from "@/lib/queries";
import { normalizeCode } from "@/lib/social/join";
import { LangSwitch, LegalFooter, Logo } from "../components";
import { SignUpForm } from "../passkey-client";
import { passkeyLabels } from "../passkey-labels";

export const metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getT();
  const join = normalizeCode(param(await searchParams, "join") ?? "") || undefined;
  return (
    <>
      <div className="track gutter" style={{ paddingBlock: 18 }}>
        <div className="wrap row" style={{ justifyContent: "space-between" }}>
          <Link href="/" className="brand"><Logo size={30} /> Pacepact</Link>
          <LangSwitch locale={locale} back="/signup" />
        </div>
      </div>
      <main className="gutter">
        <div className="auth panel">
          <h2>{t.auth.signUpTitle}</h2>
          <p className="small muted">{t.auth.passkeyIntro}</p>
          <SignUpForm labels={passkeyLabels(t)} locale={locale} join={join} />
          <p className="small muted">{t.auth.haveAccount} <Link href="/signin">{t.nav.signIn}</Link></p>
        </div>
      </main>
      <LegalFooter t={t} />
    </>
  );
}
