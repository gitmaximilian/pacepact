import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { param, type SearchParams } from "@/lib/queries";
import { signUp } from "../actions";
import { Flash, LangSwitch, Logo } from "../components";

export const metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const { t, locale } = await getT();
  const error = param(await searchParams, "error");
  const msg = error === "exists" ? t.auth.errExists : error ? t.auth.errInput : null;
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
          <Flash err={msg} />
          <form action={signUp} className="form">
            <div className="field"><label htmlFor="name">{t.auth.name}</label><input id="name" name="name" autoComplete="given-name" maxLength={60} required /></div>
            <div className="field"><label htmlFor="email">{t.auth.email}</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
            <div className="field">
              <label htmlFor="password">{t.auth.password}</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
              <span className="hint">{t.auth.passwordHint}</span>
            </div>
            <button className="btn signal">{t.auth.submitSignUp}</button>
          </form>
          <p className="small muted">{t.auth.haveAccount} <Link href="/signin">{t.nav.signIn}</Link></p>
        </div>
      </main>
    </>
  );
}
