import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { LEGAL } from "@/lib/legal";
import { BackLink, LegalFooter, Logo, Shell } from "../components";

export const metadata = { title: "Crew rules" };

export default async function RulesPage() {
  const { t, locale } = await getT();
  const user = await currentUser();
  const body = (
    <>
      <h1>{t.social.rulesTitle}</h1>
      <ol className="panel rules">
        {t.social.rules.map((r) => <li key={r}>{r}</li>)}
      </ol>
      <p className="small muted">{fmt(t.social.rulesContact, { email: LEGAL.email })} <Link href="/privacy">{t.legal.privacy}</Link></p>
    </>
  );
  if (user) return <Shell t={t} locale={locale} active="/groups"><BackLink href="/groups" label={t.nav.groups} />{body}</Shell>;
  return (
    <>
      <div className="track gutter" style={{ paddingBlock: 18 }}>
        <div className="wrap"><Link href="/" className="brand"><Logo size={30} /> Pacepact</Link></div>
      </div>
      <main className="gutter"><div className="wrap stack" style={{ maxWidth: 720 }}>{body}</div></main>
      <LegalFooter t={t} />
    </>
  );
}
