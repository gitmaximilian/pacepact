import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { LangSwitch, LegalFooter, Logo } from "../components";
import { SignInButton } from "../passkey-client";
import { passkeyLabels } from "../passkey-labels";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const { t, locale } = await getT();
  return (
    <>
      <div className="track gutter" style={{ paddingBlock: 18 }}>
        <div className="wrap row" style={{ justifyContent: "space-between" }}>
          <Link href="/" className="brand"><Logo size={30} /> Pacepact</Link>
          <LangSwitch locale={locale} back="/signin" />
        </div>
      </div>
      <main className="gutter">
        <div className="auth panel">
          <h2>{t.auth.signInTitle}</h2>
          <p className="small muted">{t.auth.passkeyIntro}</p>
          <SignInButton labels={passkeyLabels(t)} />
          <p className="small muted">{t.auth.noAccount} <Link href="/signup">{t.nav.signUp}</Link></p>
        </div>
      </main>
      <LegalFooter t={t} />
    </>
  );
}
