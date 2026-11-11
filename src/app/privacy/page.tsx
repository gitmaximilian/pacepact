import Link from "next/link";
import type { ReactNode } from "react";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { INACTIVE_ACCOUNT_DAYS, LEGAL } from "@/lib/legal";
import { LangSwitch, LegalFooter, Logo } from "../components";

export const metadata = { title: "Privacy" };

const H = LEGAL.hosting;
const Mail = () => <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;
const years = INACTIVE_ACCOUNT_DAYS / 365;

const de: { title: string; intro: string; sections: [string, ReactNode][] } = {
  title: "Datenschutzhinweise",
  intro: "Was Pacepact speichert, warum, und was nicht.",
  sections: [
    [
      "Kurz gesagt",
      <ul key="s">
        <li>Wir speichern nur, was für Konto, Ziele, Läufe und Gruppen nötig ist. Kein Tracking, keine Werbung, kein Verkauf von Daten, keine extern geladenen Schriften.</li>
        <li>Deinen Puls speichern wir nur, wenn du ausdrücklich einwilligst. Du kannst jederzeit widerrufen, dann löschen wir alle Pulswerte.</li>
        <li>Du kannst deine Daten jederzeit herunterladen und dein Konto sofort löschen.</li>
      </ul>,
    ],
    [
      "Verantwortlicher",
      <p key="s">
        {LEGAL.controller} · <Mail />. Impressum und die allgemeine Datenschutzerklärung findest du unter{" "}
        <a href={LEGAL.legalUrl} rel="noopener">maximilianauer.at/legal</a>.
      </p>,
    ],
    [
      "Welche Daten wir speichern",
      <ul key="s">
        <li><b>Konto:</b> Name (frei wählbar, auch ein Spitzname), E-Mail-Adresse, Passwort nur als scrypt-Hash, Sprache, Zeitpunkte von Erstellung, Bestätigung der Hinweise und letzter Nutzung.</li>
        <li><b>Anmeldung:</b> nur eine Prüfsumme (SHA-256) des Sitzungs-Tokens mit Ablaufdatum.</li>
        <li><b>Ziele:</b> Rennen, Datum, Distanz, Zielzeit.</li>
        <li><b>Läufe:</b> Zeitpunkt, Art (Run 1/2/3, Test), Distanz, Dauer, Anstrengung 1–10, Gehpausen, deine Notizen, Quelle (z. B. Datei oder Strava) und die ID der Aktivität beim Anbieter. GPS-Strecken speichern wir nicht: Beim Import berechnen wir nur Distanz und Dauer.</li>
        <li><b>Puls (nur mit Einwilligung):</b> Durchschnitts- und Maximalpuls je Lauf.</li>
        <li><b>Gruppen:</b> Gruppenname, Einladungscode, Mitgliedschaft und Rolle.</li>
        <li><b>Verbindungen zu anderen Diensten:</b> Zugriffs-Tokens (verschlüsselt mit AES-256), deine Nutzer-ID beim Dienst, Zeitpunkt der letzten Synchronisierung.</li>
        <li><b>API-Tokens:</b> Bezeichnung und nur eine Prüfsumme des Tokens.</li>
      </ul>,
    ],
    [
      "Zweck und Rechtsgrundlage",
      <ul key="s">
        <li>Konto, Ziele, Läufe, Plan, Gruppen und Importe: Bereitstellung des Dienstes, den du nutzt (Art. 6 Abs. 1 lit. b DSGVO).</li>
        <li>Puls: deine ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO). Freiwillig; ohne Einwilligung funktioniert alles andere genauso. Widerruf jederzeit in den Einstellungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
        <li>Schutz vor Missbrauch, z. B. Begrenzung von Anmeldeversuchen: berechtigtes Interesse am sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Dafür werden IP-Adressen nur kurz im Arbeitsspeicher gezählt und nicht gespeichert.</li>
      </ul>,
    ],
    [
      "Was andere in deinen Gruppen sehen",
      <p key="s">
        Mitglieder einer Gruppe sehen deinen Namen sowie Datum, Art, Distanz, Dauer und Pace deiner Läufe und daraus berechnete
        Kennzahlen. Sie sehen <b>nicht</b> deine Notizen, deinen Puls, deine E-Mail-Adresse oder deine Ziele. Von Strava
        importierte Läufe sind nur für dich sichtbar. Wenn du eine Gruppe verlässt, sehen ihre Mitglieder deine Läufe nicht mehr.
      </p>,
    ],
    [
      "Verbindungen zu Strava, Polar, Fitbit, Wahoo und Suunto",
      <p key="s">
        Eine Verbindung entsteht nur, wenn du sie selbst startest und beim jeweiligen Dienst zustimmst. Pacepact liest dann
        deine Laufaktivitäten und postet nie etwas zurück. Für die Daten beim Dienst selbst gilt dessen Datenschutzerklärung.
        „Trennen“ löscht die gespeicherten Zugriffs-Tokens sofort; bereits importierte Läufe bleiben, bis du sie löschst. Den
        Zugriff kannst du zusätzlich in den Einstellungen des Dienstes entziehen.
      </p>,
    ],
    [
      "Cookies",
      <p key="s">
        Nur technisch notwendige Cookies, keine Analyse- oder Werbe-Cookies (§ 165 Abs. 3 TKG 2021): <code>pp_session</code>{" "}
        (Anmeldung, 30 Tage), <code>pp_locale</code> (deine Sprachwahl, 1 Jahr) und <code>pp_oauth</code> (nur während du
        einen Dienst verbindest, 10 Minuten).
      </p>,
    ],
    [
      "Empfänger und Speicherort",
      <p key="s">
        Hosting und Datenbank: {H.provider} ({H.services}) als Auftragsverarbeiter auf Grundlage des{" "}
        <a href={H.dpa} rel="noopener">Auftragsverarbeitungsvertrags</a>. Speicherort: {H.location}. Für etwaige Zugriffe aus
        den USA gelten das EU-US Data Privacy Framework bzw. Standardvertragsklauseln. Beim Abruf der Seite verarbeitet der
        Hoster technisch notwendige Verbindungsdaten (siehe allgemeine Datenschutzerklärung). Wir geben keine Daten an
        Dritte weiter, außer an die Dienste, die du selbst verbindest.
      </p>,
    ],
    [
      "Speicherdauer",
      <ul key="s">
        <li>Bis du Läufe oder dein Konto löschst. Die Löschung ist sofort und endgültig; technische Wiederherstellungspunkte des Hosters laufen nach spätestens {LEGAL.restoreDays} Tagen ab.</li>
        <li>Konten ohne Nutzung seit {years} Jahren werden automatisch gelöscht.</li>
        <li>Anmeldungen laufen nach 30 Tagen ab.</li>
        <li>Pulswerte werden beim Widerruf der Einwilligung sofort gelöscht.</li>
      </ul>,
    ],
    [
      "Alter und Gesundheit",
      <p key="s">
        Pacepact ist ab {LEGAL.minAge} Jahren nutzbar (§ 4 Abs. 4 DSG). Der Trainingsplan ist eine allgemeine Orientierung,
        keine medizinische Beratung und keine automatisierte Entscheidung über dich.
      </p>,
    ],
    [
      "Deine Rechte",
      <p key="s">
        Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Widerruf deiner Einwilligung.
        Auskunft und Übertragbarkeit: „Meine Daten herunterladen“ in den <Link href="/settings">Einstellungen</Link>. Löschung:
        „Konto und alle Daten löschen“. Für alles Weitere schreib an <Mail />. Du kannst dich außerdem bei der österreichischen
        Datenschutzbehörde beschweren (<a href={LEGAL.authority} rel="noopener">dsb.gv.at</a>).
      </p>,
    ],
  ],
};

const en: typeof de = {
  title: "Privacy notice",
  intro: "What Pacepact stores, why, and what it does not.",
  sections: [
    [
      "In short",
      <ul key="s">
        <li>We store only what your account, goals, runs and groups need. No tracking, no advertising, no selling of data, no externally loaded fonts.</li>
        <li>We store your heart rate only if you explicitly consent. You can withdraw at any time; we then delete all heart-rate values.</li>
        <li>You can download your data at any time and delete your account instantly.</li>
      </ul>,
    ],
    [
      "Controller",
      <p key="s">
        {LEGAL.controllerEn} · <Mail />. Legal notice and the general privacy policy:{" "}
        <a href={LEGAL.legalUrl} rel="noopener">maximilianauer.at/legal</a>.
      </p>,
    ],
    [
      "What we store",
      <ul key="s">
        <li><b>Account:</b> name (any name or nickname), email address, password only as a scrypt hash, language, and when the account was created, the notice confirmed and last used.</li>
        <li><b>Sign-in:</b> only a checksum (SHA-256) of the session token and its expiry.</li>
        <li><b>Goals:</b> race, date, distance, target time.</li>
        <li><b>Runs:</b> time, type (Run 1/2/3, test), distance, duration, effort 1–10, walk breaks, your notes, source (e.g. file or Strava) and the activity ID at the provider. We do not store GPS tracks: imports only calculate distance and duration.</li>
        <li><b>Heart rate (only with consent):</b> average and maximum heart rate per run.</li>
        <li><b>Groups:</b> group name, invite code, membership and role.</li>
        <li><b>Connections to other services:</b> access tokens (encrypted with AES-256), your user ID at the service, time of the last sync.</li>
        <li><b>API tokens:</b> label and only a checksum of the token.</li>
      </ul>,
    ],
    [
      "Purpose and legal basis",
      <ul key="s">
        <li>Account, goals, runs, plan, groups and imports: providing the service you use (Art. 6(1)(b) GDPR).</li>
        <li>Heart rate: your explicit consent (Art. 9(2)(a) GDPR). Voluntary; everything else works the same without it. Withdraw at any time in Settings, with effect for the future (Art. 7(3) GDPR).</li>
        <li>Abuse protection such as limiting sign-in attempts: legitimate interest in secure operation (Art. 6(1)(f) GDPR). IP addresses are only counted briefly in memory and never stored.</li>
      </ul>,
    ],
    [
      "What others in your groups see",
      <p key="s">
        Group members see your name and the date, type, distance, duration and pace of your runs, plus figures calculated from
        them. They do <b>not</b> see your notes, heart rate, email address or goals. Runs imported from Strava are visible to you
        only. When you leave a group, its members no longer see your runs.
      </p>,
    ],
    [
      "Connections to Strava, Polar, Fitbit, Wahoo and Suunto",
      <p key="s">
        A connection is only created when you start it and approve it at the service. Pacepact then reads your running
        activities and never posts anything back. The service&apos;s own privacy policy applies to the data it holds.
        “Disconnect” deletes the stored access tokens immediately; runs already imported stay until you delete them. You can
        also revoke access in the service&apos;s settings.
      </p>,
    ],
    [
      "Cookies",
      <p key="s">
        Only strictly necessary cookies, no analytics or advertising cookies: <code>pp_session</code> (sign-in, 30 days),{" "}
        <code>pp_locale</code> (your language choice, 1 year) and <code>pp_oauth</code> (only while you connect a service,
        10 minutes).
      </p>,
    ],
    [
      "Recipients and storage location",
      <p key="s">
        Hosting and database: {H.provider} ({H.servicesEn}) as processor under its{" "}
        <a href={H.dpa} rel="noopener">data processing addendum</a>. Location: {H.locationEn}. Any access from the US is covered
        by the EU-US Data Privacy Framework or standard contractual clauses. When you load the site, the host processes
        technically necessary connection data (see the general privacy policy). We do not share data with anyone else, except
        the services you connect yourself.
      </p>,
    ],
    [
      "Retention",
      <ul key="s">
        <li>Until you delete runs or your account. Deletion is immediate and final; the host&apos;s technical restore points expire after {LEGAL.restoreDays} days at the latest.</li>
        <li>Accounts unused for {years} years are deleted automatically.</li>
        <li>Sign-ins expire after 30 days.</li>
        <li>Heart-rate values are deleted immediately when you withdraw consent.</li>
      </ul>,
    ],
    [
      "Age and health",
      <p key="s">
        Pacepact is for people aged {LEGAL.minAge} and over. The training plan is general guidance, not medical advice, and
        not an automated decision about you.
      </p>,
    ],
    [
      "Your rights",
      <p key="s">
        Access, rectification, erasure, restriction, portability, objection and withdrawal of consent. Access and portability:
        “Download my data” in <Link href="/settings">Settings</Link>. Erasure: “Delete account and all data”. For anything
        else, write to <Mail />. You can also complain to the Austrian Data Protection Authority (
        <a href={LEGAL.authority} rel="noopener">dsb.gv.at</a>).
      </p>,
    ],
  ],
};

export default async function PrivacyPage() {
  const { t, locale } = await getT();
  const user = await currentUser();
  const doc = locale === "de" ? de : en;
  return (
    <>
      <div className="track gutter" style={{ paddingBlock: 18 }}>
        <div className="wrap row" style={{ justifyContent: "space-between" }}>
          <Link href={user ? "/dashboard" : "/"} className="brand"><Logo size={30} /> Pacepact</Link>
          <LangSwitch locale={locale} back="/privacy" />
        </div>
      </div>
      <main className="gutter">
        <article className="wrap stack doc" style={{ maxWidth: 760 }}>
          <h1>{doc.title}</h1>
          <p className="muted">{doc.intro}</p>
          {doc.sections.map(([heading, body]) => (
            <section key={heading} className="stack" style={{ gap: 8 }}>
              <h2>{heading}</h2>
              {body}
            </section>
          ))}
          <p className="small muted">{locale === "de" ? "Stand" : "Last updated"}: {LEGAL.updated}</p>
        </article>
      </main>
      <LegalFooter t={t} />
    </>
  );
}
