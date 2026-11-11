import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { param, type SearchParams } from "@/lib/queries";
import { signIn } from "../actions";
import { Flash, LangSwitch, Logo } from "../components";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getT();
  const error = param(await searchParams, "error");
  const msg = error === "rate" ? t.auth.errRate : error ? t.auth.errInvalid : null;
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
          <Flash err={msg} />
          <form action={signIn} className="form">
            <div className="field"><label htmlFor="email">{t.auth.email}</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="password">{t.auth.password}</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <button className="btn">{t.auth.submitSignIn}</button>
          </form>
          <p className="small muted">{t.auth.noAccount} <Link href="/signup">{t.nav.signUp}</Link></p>
        </div>
      </main>
    </>
  );
}
