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
        <li>Anmeldung nur per Passkey: keine E-Mail-Adresse, kein Passwort.</li>
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
        <li><b>Konto:</b> eine zufällige Konto-ID, Name (frei wählbar, auch ein Spitzname), Sprache, Zeitpunkte von Erstellung, Bestätigung der Hinweise und letzter Nutzung.</li>
        <li><b>Trainingseinstellungen aus der Begrüßung:</b> deine Ausgangslage (z. B. „30 Minuten locker gehen“), Läufe pro Woche und ob du Krafttraining machst.</li>
        <li><b>Passkey:</b> die Kennung deines Passkeys, der zugehörige öffentliche Schlüssel, ein Signaturzähler, die Übertragungsart und Zeitpunkte. Dein privater Schlüssel und biometrische Daten (Face ID, Touch ID) verlassen nie dein Gerät.</li>
        <li><b>Anmeldung:</b> nur eine Prüfsumme (SHA-256) des Sitzungs-Tokens mit Ablaufdatum; während der Anmeldung eine einmalige Challenge für 5 Minuten.</li>
        <li><b>Ziele:</b> Rennen, Datum, Distanz, Zielzeit.</li>
        <li><b>Läufe:</b> Zeitpunkt, Art (Run 1/2/3, Test), Distanz, Dauer, Anstrengung 1–10, Gehpausen, deine Notizen, Quelle (von Hand oder Apple Health). GPS-Strecken speichern wir nicht.</li>
        <li><b>Puls (nur mit Einwilligung):</b> Durchschnitts- und Maximalpuls je Lauf.</li>
        <li><b>Crews (Gruppen):</b> Name der Crew, Einladungscode, optional Rennen und Renndatum, die Einstellung „nur aus Apple Health importierte Läufe zählen“; je Mitglied Rolle, Beitrittsdatum, deine Sichtbarkeitseinstellungen (Distanz, Pace), freiwillig ob du fürs Rennen angemeldet bist, und wann du die Crew zuletzt geöffnet hast (für „seit deinem letzten Besuch“).</li>
        <li><b>Wochenwerte und Meilensteine:</b> aus deinen Läufen berechnete Summen pro Woche (Anzahl, Minuten, km, längster Lauf, längster Lauf ohne Gehpause, Läufe mit Gehpausen, Läufe mit lockerer Anstrengung, Testläufe) und erreichte Meilensteine (z. B. erstmals 30 Minuten ohne Gehpause). Sie enthalten keine Pulswerte und nur Läufe, die in Crews zählen dürfen.</li>
        <li><b>Challenges:</b> Art, Messgröße, Ziel, Zeitraum, wer sie erstellt hat; je Teilnahme Zusage oder Absage und am Ende Ergebnis, Platz und Sticker.</li>
        <li><b>Kudos, Kommentare und Meldungen:</b> wer worauf wie reagiert hat, Kommentartexte (max. 280 Zeichen) mit Zeitpunkt, und wer einen Kommentar gemeldet hat.</li>
      </ul>,
    ],
    [
      "Zweck und Rechtsgrundlage",
      <ul key="s">
        <li>Konto, Ziele, Läufe, Plan, Gruppen und Importe: Bereitstellung des Dienstes, den du nutzt (Art. 6 Abs. 1 lit. b DSGVO).</li>
        <li>Puls: deine ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO). Du gibst sie mit einem eigenen, nicht vorausgewählten Häkchen bei der Registrierung, beim Eintragen eines Laufs oder in den Einstellungen. Freiwillig; ohne Einwilligung funktioniert alles andere genauso. Der Puls dient deiner eigenen Auswertung („Pace bei gleichem Puls“); den Durchschnittspuls je Lauf sehen die Mitglieder deiner Crews. Den Maximalpuls sieht nur du. Widerruf jederzeit in den Einstellungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
        <li>Crews, Wochenvergleich, Challenges, Kudos und Kommentare: Bereitstellung der Gemeinschaftsfunktionen, die du nutzt, wenn du einer Crew beitrittst (Art. 6 Abs. 1 lit. b DSGVO).</li>
        <li>Schutz vor Missbrauch, z. B. Begrenzung von Anmelde- und Beitrittsversuchen, sowie Moderation gemeldeter Inhalte: berechtigtes Interesse am sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Für Zähler speichern wir nur eine Prüfsumme (SHA-256) aus IP-Adresse bzw. Konto-ID und Zweck, höchstens 24 Stunden lang, nie die IP-Adresse selbst.</li>
      </ul>,
    ],
    [
      "Was andere in deinen Crews sehen",
      <ul key="s">
        <li><b>Immer:</b> deinen Namen, Datum, Art und Dauer deiner Läufe seit deinem Beitritt (letzte 21 Tage im Feed), ob ein Lauf aus Apple Health stammt oder selbst eingetragen wurde, Gehpausen, Anzahl der Läufe, deinen Wochenplan-Fortschritt, deinen Platz im Vier-Wochen-Vergleich (Serie in Wochen und Minuten, gedeckelt beim Plan + 10 %), deine Statistik je Zeitraum (Anzahl Läufe, Minuten, längster Lauf, Serie, Anteil erledigter Planwochen; für „Jahr“ und „Gesamt“ erst ab Gründung der Crew) und als Diagramme pro Woche oder Monat (Minuten, gedeckelt beim Plan + 10 %, erledigte Planwochen, längster Lauf und durchschnittliche Pace als dein eigener Verlauf, nie als Rangfolge), Meilensteine, Challenge-Teilnahmen und Sticker, deine Kudos und Kommentare.</li>
        <li><b>Immer, ab sofort für alle:</b> Distanz und Pace deiner Läufe. <b>Mit deiner Puls-Einwilligung:</b> den Durchschnittspuls je Lauf (die Einwilligung umfasst ausdrücklich die Anzeige in deinen Crews; ältere Einwilligungen ohne diesen Zusatz gelten erst nach deiner Bestätigung). <b>Freiwillig:</b> ob du fürs Rennen angemeldet bist.</li>
        <li><b>Nie:</b> Maximalpuls, Notizen, Ziele, Zielzeit, Trainingseinstellungen. Für deinen Wochenplan im Vergleich nutzen wir intern dein Renndatum und deine Läufe pro Woche, zeigen sie aber nicht an.</li>
        <li><b>Gar nicht in Crews:</b> unplausible Läufe (schneller als 2:30 min/km).</li>
        <li>Wenn du eine Crew verlässt oder entfernt wirst, sieht sie deine Läufe nicht mehr. Deine Kommentare dort bleiben, bis du sie löschst oder dein Konto löschst.</li>
      </ul>,
    ],
    [
      "Kommentare, Meldungen und Moderation",
      <p key="s">
        Kommentare und Crew-Namen sind deine Inhalte; es gelten die <Link href="/rules">Crew-Regeln</Link>. Du kannst eigene
        Kommentare jederzeit löschen. Die Crew-Leitung sieht gemeldete Kommentare und kann sie entfernen. Meldungen an uns:{" "}
        <Mail />. Gemeldete Inhalte prüfen wir und entfernen sie, wenn sie rechtswidrig sind oder gegen die Regeln verstoßen.
      </p>,
    ],
    [
      "Import aus Apple Health",
      <p key="s">
        Du exportierst deine Daten selbst in der Health-App („Alle Gesundheitsdaten exportieren“) und wählst die Datei in
        Pacepact aus. Die Datei wird <b>nur in deinem Browser</b> gelesen und nie hochgeladen. An Pacepact gehen nur
        Lauf-Trainings: Zeitpunkt, Dauer, Distanz, und Durchschnitts- und Maximalpuls nur mit deiner Einwilligung. Andere
        Trainings und alle übrigen Gesundheitsdaten bleiben auf deinem Gerät. Hast du denselben Lauf auch von Hand eingetragen,
        behalten wir eine Kopie und übernehmen deine Anstrengung und Notizen.
      </p>,
    ],
    [
      "Cookies",
      <p key="s">
        Nur technisch notwendige Cookies, keine Analyse- oder Werbe-Cookies (§ 165 Abs. 3 TKG 2021): <code>pp_session</code>{" "}
        (Anmeldung, 30 Tage), <code>pp_locale</code> (deine Sprachwahl, 1 Jahr), <code>pp_crew</code> (welche deiner Crews zuletzt offen war, 1 Jahr), <code>pp_challenge</code> (nur während der
        Anmeldung, 5 Minuten). Im Speicher deines
        Browsers merken wir uns nur, wenn du „Nicht jetzt“ bei der App-Installation wählst, damit wir 30 Tage nicht erneut fragen.
        Passkeys verwaltet dein Betriebssystem (z. B. iCloud-Schlüsselbund); dafür gelten die Bedingungen des Anbieters.
      </p>,
    ],
    [
      "Empfänger und Speicherort",
      <p key="s">
        Hosting und Datenbank: {H.provider} ({H.services}) als Auftragsverarbeiter auf Grundlage des{" "}
        <a href={H.dpa} rel="noopener">Auftragsverarbeitungsvertrags</a>. Speicherort: {H.location}. Für etwaige Zugriffe aus
        den USA gelten das EU-US Data Privacy Framework bzw. Standardvertragsklauseln. Beim Abruf der Seite verarbeitet der
        Hoster technisch notwendige Verbindungsdaten (siehe allgemeine Datenschutzerklärung). Wir geben keine Daten an
        Dritte weiter.
      </p>,
    ],
    [
      "Speicherdauer",
      <ul key="s">
        <li>Bis du Läufe oder dein Konto löschst. Die Löschung ist sofort und endgültig; technische Wiederherstellungspunkte des Hosters laufen nach spätestens {LEGAL.restoreDays} Tagen ab.</li>
        <li>Konten ohne Nutzung seit {years} Jahren werden automatisch gelöscht.</li>
        <li>Anmeldungen laufen nach 30 Tagen ab.</li>
        <li>Pulswerte werden beim Widerruf der Einwilligung sofort gelöscht.</li>
        <li>Wochenwerte und Meilensteine werden bei jeder Änderung deiner Läufe neu berechnet und mit dem Konto gelöscht. Kudos und Kommentare auf einen Lauf werden mit dem Lauf gelöscht; deine eigenen Kommentare mit deinem Konto. Löschst du dein Konto, geht die Leitung deiner Crews an das am längsten dabei befindliche Mitglied; leere Crews werden gelöscht, ebenso beim Löschen einer Crew alle Challenges, Kudos und Kommentare darin.</li>
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
        <li>Sign-in with passkeys only: no email address, no password.</li>
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
        <li><b>Account:</b> a random account ID, name (any name or nickname), language, and when the account was created, the notice confirmed and last used.</li>
        <li><b>Training setup from the welcome flow:</b> your starting point (e.g. “30 easy minutes work”), runs per week and whether you do strength training.</li>
        <li><b>Passkey:</b> your passkey&apos;s ID, its public key, a signature counter, the transport type and timestamps. Your private key and biometric data (Face ID, Touch ID) never leave your device.</li>
        <li><b>Sign-in:</b> only a checksum (SHA-256) of the session token and its expiry; during sign-in a one-time challenge for 5 minutes.</li>
        <li><b>Goals:</b> race, date, distance, target time.</li>
        <li><b>Runs:</b> time, type (Run 1/2/3, test), distance, duration, effort 1–10, walk breaks, your notes, source (by hand or Apple Health). We do not store GPS tracks.</li>
        <li><b>Heart rate (only with consent):</b> average and maximum heart rate per run.</li>
        <li><b>Crews (groups):</b> crew name, invite code, optionally race and race date, the setting “count only runs imported from Apple Health”; per member role, join date, your visibility settings (distance, pace), voluntarily whether you are registered for the race, and when you last opened the crew (for “since your last visit”).</li>
        <li><b>Weekly totals and milestones:</b> sums per week calculated from your runs (count, minutes, km, longest run, longest run without walk breaks, runs with walk breaks, runs at easy effort, test runs) and milestones reached (e.g. first 30 minutes without a walk break). They contain no heart rate and only runs that may count in crews.</li>
        <li><b>Challenges:</b> type, measure, target, period, who created it; per participant acceptance or refusal and, at the end, result, place and sticker.</li>
        <li><b>Kudos, comments and reports:</b> who reacted to what and how, comment texts (max. 280 characters) with time, and who reported a comment.</li>
      </ul>,
    ],
    [
      "Purpose and legal basis",
      <ul key="s">
        <li>Account, goals, runs, plan, groups and imports: providing the service you use (Art. 6(1)(b) GDPR).</li>
        <li>Heart rate: your explicit consent (Art. 9(2)(a) GDPR). You give it with a separate, unticked checkbox at sign-up, when logging a run, or in Settings. Voluntary; everything else works the same without it. Heart rate is used for your own analysis ("pace at the same heart rate"); members of your crews see the average heart rate per run. Only you see the maximum heart rate. Withdraw at any time in Settings, with effect for the future (Art. 7(3) GDPR).</li>
        <li>Crews, weekly comparison, challenges, kudos and comments: providing the community features you use when you join a crew (Art. 6(1)(b) GDPR).</li>
        <li>Abuse protection such as limiting sign-in and join attempts, and moderating reported content: legitimate interest in secure operation (Art. 6(1)(f) GDPR). Counters store only a checksum (SHA-256) of IP address or account ID and purpose, for at most 24 hours, never the IP address itself.</li>
      </ul>,
    ],
    [
      "What others in your crews see",
      <ul key="s">
        <li><b>Always:</b> your name; date, type and duration of your runs since you joined (last 21 days in the feed); whether a run came from Apple Health or was entered by you; walk breaks; number of runs; your weekly plan progress; your place in the four-week comparison (streak in weeks and minutes, capped at the plan + 10 %); your statistics per period (number of runs, minutes, longest run, streak, share of plan weeks done; for "Year" and "All time" only from the crew's start) and as charts per week or month (minutes capped at the plan + 10 %, plan weeks done, longest run and average pace as your own trend, never as a ranking); milestones; challenge participation and stickers; your kudos and comments.</li>
        <li><b>Always:</b> distance and pace of your runs. <b>With your heart-rate consent:</b> the average heart rate per run (the consent explicitly covers showing it in your crews; older consents without that wording only apply once you confirm). <b>Voluntary:</b> whether you are registered for the race.</li>
        <li><b>Never:</b> maximum heart rate, notes, goals, target time, training settings. To compute your weekly plan in the comparison we use your race date and runs per week internally, but never show them.</li>
        <li><b>Not in crews at all:</b> implausible runs (faster than 2:30 min/km).</li>
        <li>When you leave a crew or are removed, it no longer sees your runs. Your comments there stay until you delete them or your account.</li>
      </ul>,
    ],
    [
      "Comments, reports and moderation",
      <p key="s">
        Comments and crew names are your content; the <Link href="/rules">crew rules</Link> apply. You can delete your own comments
        at any time. The crew admin sees reported comments and can remove them. Reports to us: <Mail />. We review reported
        content and remove it if it is unlawful or breaks the rules.
      </p>,
    ],
    [
      "Import from Apple Health",
      <p key="s">
        You export your data yourself in the Health app (“Export All Health Data”) and choose the file in Pacepact. The file is
        read <b>only in your browser</b> and never uploaded. Pacepact receives running workouts only: time, duration, distance,
        and average and maximum heart rate only with your consent. Other workouts and all other health data stay on your
        device. If you also typed the same run in by hand, we keep one copy and keep your effort and notes.
      </p>,
    ],
    [
      "Cookies",
      <p key="s">
        Only strictly necessary cookies, no analytics or advertising cookies: <code>pp_session</code> (sign-in, 30 days),{" "}
        <code>pp_locale</code> (your language choice, 1 year), <code>pp_crew</code> (which of your crews was open last, 1 year) and <code>pp_challenge</code> (only during sign-in, 5 minutes). In your browser&apos;s storage we only remember
        when you choose “Not now” for installing the app, so we do not ask again for 30 days. Passkeys are managed by your
        operating system (e.g. iCloud Keychain); the provider&apos;s terms apply.
      </p>,
    ],
    [
      "Recipients and storage location",
      <p key="s">
        Hosting and database: {H.provider} ({H.servicesEn}) as processor under its{" "}
        <a href={H.dpa} rel="noopener">data processing addendum</a>. Location: {H.locationEn}. Any access from the US is covered
        by the EU-US Data Privacy Framework or standard contractual clauses. When you load the site, the host processes
        technically necessary connection data (see the general privacy policy). We do not share data with anyone else.
      </p>,
    ],
    [
      "Retention",
      <ul key="s">
        <li>Until you delete runs or your account. Deletion is immediate and final; the host&apos;s technical restore points expire after {LEGAL.restoreDays} days at the latest.</li>
        <li>Accounts unused for {years} years are deleted automatically.</li>
        <li>Sign-ins expire after 30 days.</li>
        <li>Heart-rate values are deleted immediately when you withdraw consent.</li>
        <li>Weekly totals and milestones are recalculated whenever your runs change and deleted with your account. Kudos and comments on a run are deleted with the run; your own comments with your account. If you delete your account, your crews go to the longest-standing member; empty crews are deleted, and deleting a crew deletes all its challenges, kudos and comments.</li>
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
