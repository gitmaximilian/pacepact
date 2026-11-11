# Technische und organisatorische Maßnahmen (Art. 32 DSGVO) – Pacepact

> Stand 2026-11-11, **Entwurf.** Beschreibt, was der Code tatsächlich tut.

## Datenminimierung (Art. 5, 25 DSGVO)

- Anmeldung ausschließlich per Passkey (WebAuthn): keine E-Mail, kein Passwort. Name ist frei wählbar (Spitzname möglich); keine Telefonnummer, keine Adresse, kein Geburtsdatum.
- Puls nur mit ausdrücklicher Einwilligung; ohne Einwilligung verwirft `src/lib/runs-store.ts` Pulswerte vor dem Speichern.
- Keine GPS-Strecken: GPX/TCX/FIT-Importe speichern nur Summenwerte (Distanz, Dauer, Puls).
- Gruppen sehen nur Lauf-Kennzahlen, keine Notizen, keinen Puls, keine Strava-Läufe.
- Kein Tracking, keine Analyse-Tools, keine Werbung, Schriften selbst gehostet. Cloudflare Web Analytics ist für die Zone maximilianauer.at automatisch aktiv; Pacepact setzt auf allen HTML-Seiten `Cache-Control: no-transform` (`worker.ts`), damit Cloudflare dort kein Messskript einbaut.

## Vertraulichkeit

- Übertragung nur per HTTPS (TLS) über den Hoster.
- Passkeys sind phishing-resistent; der Server speichert nur öffentliche Schlüssel. Anmelde-Challenges sind einmalig verwendbar und laufen nach 5 Minuten ab. Origin-Prüfung bei allen Anmelde-Anfragen.
- Sitzungs-Tokens: 256 Bit zufällig, nur als SHA-256-Hash gespeichert; Cookie `HttpOnly`, `Secure` (Produktion), `SameSite=Lax`, 30 Tage.
- API-Tokens: nur als SHA-256-Hash gespeichert, werden einmalig angezeigt.
- Tokens von Drittdiensten: AES-256-GCM mit eigenem Schlüssel (`ENCRYPTION_KEY`), getrennt von der Datenbank.
- Zugriff auf Daten nur über die eigene Sitzung (Nutzer-ID aus der Sitzung, nie aus Anfrageparametern); Gruppenseiten prüfen die Mitgliedschaft.
- Schutz vor Cross-Site-Anfragen: Server Actions mit Origin-Prüfung, OAuth mit `state` und PKCE (Fitbit).
- Begrenzung von Anmeldeversuchen (pro E-Mail und IP) und der Ingest-API. Hinweis: Der Zähler liegt im Arbeitsspeicher einer Worker-Instanz und ist daher nur ein Grundschutz; bei Bedarf Cloudflare-Rate-Limiting-Regeln für `/signin` ergänzen.
- Sicherheits-Header: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- Zugriff auf Hoster-Konto: nur Verantwortlicher, Zwei-Faktor-Anmeldung aktivieren.

## Integrität

- Eingaben werden geprüft (Wertebereiche für Distanz, Dauer, Puls, Anstrengung); Importe auf 15 MB je Datei begrenzt.
- Duplikate werden über (Nutzer, Quelle, externe ID) verhindert.

## Verfügbarkeit und Belastbarkeit

- Redundante Infrastruktur des Hosters; Wiederherstellungspunkte der Datenbank (D1 Time Travel: 7 Tage im Gratis-, 30 Tage im Paid-Tarif).
- Nutzer können jederzeit einen vollständigen Export herunterladen.

## Löschung und Betroffenenrechte

- „Konto und alle Daten löschen“ entfernt sofort alle Zeilen (Konto, Passkeys, Sitzungen, Ziele, Läufe, Verbindungen, Tokens, Mitgliedschaften).
- „Meine Daten herunterladen“ (`/api/export`) liefert alle gespeicherten Daten ohne Geheimnisse.
- Widerruf der Puls-Einwilligung löscht alle Pulswerte sofort.
- Automatische Löschung von Konten nach 2 Jahren ohne Nutzung (Prüfung höchstens stündlich beim Seitenaufruf).

## Protokollierung

- Pacepact speichert keine Zugriffslogs. Bei Fehlern im Strava-Webhook wird nur die Fehlermeldung protokolliert.
- Logs beim Hoster (z. B. Workers-Logs/Logpush) nicht aktivieren, solange nicht nötig.

## Überprüfung

- Automatisierte Tests: `npm test`; Abhängigkeiten aktuell halten (`npm audit`), Überprüfung mindestens jährlich.
