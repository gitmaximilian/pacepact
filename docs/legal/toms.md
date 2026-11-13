# Technische und organisatorische Maßnahmen (Art. 32 DSGVO) – Pacepact

> Stand 2026-11-12, **Entwurf.** Beschreibt, was der Code tatsächlich tut.

## Datenminimierung (Art. 5, 25 DSGVO)

- Anmeldung ausschließlich per Passkey (WebAuthn): keine E-Mail, kein Passwort. Name ist frei wählbar (Spitzname möglich); keine Telefonnummer, keine Adresse, kein Geburtsdatum.
- Puls nur mit ausdrücklicher Einwilligung; ohne Einwilligung verwirft `src/lib/runs-store.ts` Pulswerte vor dem Speichern.
- Keine GPS-Strecken. Der Apple-Health-Export wird nur im Browser des Nutzers gelesen; an den Server gehen nur Lauf-Summenwerte (Start, Dauer, Distanz, Puls nur mit Einwilligung).
- Crews sehen Minuten, Laufart, Anzahl, Distanz, Pace, Planfortschritt und Meilensteine; den Durchschnittspuls nur mit einer Einwilligung, die die Anzeige in Crews ausdrücklich umfasst (`src/lib/hr.ts`, ältere Einwilligungen erst nach Bestätigung; Widerruf beendet die Anzeige sofort). Nie Notizen, Maximalpuls, Ziele.
- Feed zeigt Läufe erst ab dem Beitritt und nur 21 Tage; Ranglisten arbeiten mit vorberechneten Wochensummen statt Einzelläufen.
- Kein Tracking, keine Analyse-Tools, keine Werbung, Schriften selbst gehostet. Cloudflare Web Analytics ist für die Zone maximilianauer.at automatisch aktiv; Pacepact setzt auf allen HTML-Seiten `Cache-Control: no-transform` (`worker.ts`), damit Cloudflare dort kein Messskript einbaut.

## Vertraulichkeit

- Übertragung nur per HTTPS (TLS) über den Hoster.
- Passkeys sind phishing-resistent; der Server speichert nur öffentliche Schlüssel. Anmelde-Challenges sind einmalig verwendbar und laufen nach 5 Minuten ab. Origin-Prüfung bei allen Anmelde-Anfragen.
- Sitzungs-Tokens: 256 Bit zufällig, nur als SHA-256-Hash gespeichert; Cookie `HttpOnly`, `Secure` (Produktion), `SameSite=Lax`, 30 Tage.
- Zugriff auf Daten nur über die eigene Sitzung (Nutzer-ID aus der Sitzung, nie aus Anfrageparametern); Crew-Seiten und alle Crew-Aktionen prüfen die Mitgliedschaft, Admin-Aktionen die Rolle. Kudos und Kommentare werden nur auf Inhalte zugelassen, die in derselben Crew sichtbar sind (`targetVisible`), Challenge-Antworten nur von Mitgliedern.
- Schutz vor Cross-Site-Anfragen: Server Actions und der Import-Endpunkt mit Origin-Prüfung und Sitzung; Import max. 200 Läufe je Anfrage, Werte per Schema geprüft.
- Begrenzung von Anmeldungen, Registrierungen, Crew-Beitritten, Einladungslink-Aufrufen, Crew-/Challenge-Erstellung, Kudos, Kommentaren und Import-Anfragen. Zähler liegen in D1 (`rate_limits`, nur Prüfsummen, gelten über alle Worker-Instanzen) und werden nach 24 Stunden gelöscht.
- Sicherheits-Header: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- Zugriff auf Hoster-Konto: nur Verantwortlicher, Zwei-Faktor-Anmeldung aktivieren.

## Integrität

- Eingaben werden geprüft (Wertebereiche für Distanz, Dauer, Puls, Anstrengung); Importe auf 15 MB je Datei begrenzt. Manuelle Läufe schneller als 2:30 min/km werden abgelehnt; unplausible Importe zählen in Crews nicht.
- Gruppeninhalte: Kommentare max. 280 Zeichen; Meldefunktion, Moderation durch Crew-Admin; Crew-Regeln unter `/rules`.
- Duplikate werden über (Nutzer, Quelle, externe ID) verhindert.

## Verfügbarkeit und Belastbarkeit

- Redundante Infrastruktur des Hosters; Wiederherstellungspunkte der Datenbank (D1 Time Travel: 7 Tage im Gratis-, 30 Tage im Paid-Tarif).
- Nutzer können jederzeit einen vollständigen Export herunterladen.

## Löschung und Betroffenenrechte

- „Konto und alle Daten löschen“ entfernt sofort alle Zeilen (Konto, Passkeys, Sitzungen, Ziele, Läufe, Wochenwerte, Meilensteine, Verbindungen, Tokens, Mitgliedschaften, Challenge-Teilnahmen, eigene Kudos/Kommentare/Meldungen sowie Kudos und Kommentare anderer auf eigene Läufe). Crew-Leitung geht vorher an das nächste Mitglied über.
- „Meine Daten herunterladen“ (`/api/export`) liefert alle gespeicherten Daten ohne Geheimnisse.
- Widerruf der Puls-Einwilligung löscht alle Pulswerte sofort.
- Automatische Löschung von Konten nach 2 Jahren ohne Nutzung (Prüfung höchstens stündlich beim Seitenaufruf), mit Übergabe der Crew-Leitung statt Löschung der Crew.

## Protokollierung

- Pacepact speichert keine Zugriffslogs.
- Logs beim Hoster (z. B. Workers-Logs/Logpush) nicht aktivieren, solange nicht nötig.

## Überprüfung

- Automatisierte Tests: `npm test`; Abhängigkeiten aktuell halten (`npm audit`), Überprüfung mindestens jährlich.
