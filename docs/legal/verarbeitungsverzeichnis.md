# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) – Pacepact

> Stand 2026-11-12, **Entwurf – vom Verantwortlichen zu prüfen und freizugeben.** Internes Dokument; muss nicht veröffentlicht, aber auf Anfrage der Datenschutzbehörde vorgelegt werden. Bei Änderungen aktualisieren. Keine Rechtsberatung.

## Verantwortlicher

Maximilian Auer, Wien, Österreich – contact@maximilianauer.at
Datenschutzbeauftragter: nicht erforderlich (keine Kerntätigkeit in umfangreicher Verarbeitung besonderer Kategorien, keine systematische Überwachung; siehe `dsfa-schwellwertanalyse.md`).

## Verarbeitung 1: Nutzerkonto, Ziele und Läufe

| Punkt | Inhalt |
| --- | --- |
| Zweck | Lauftracker: Konto, Ziele, Trainingsplan, Erfassung und Auswertung von Läufen |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nutzungsverhältnisses) |
| Betroffene | Registrierte Nutzerinnen und Nutzer ab 14 Jahren (§ 4 Abs. 4 DSG) |
| Datenkategorien | Zufällige Konto-ID, Name (frei wählbar), Sprache, Zeitpunkte (Erstellung, Bestätigung der Hinweise, letzte Nutzung); Trainingseinstellungen (Ausgangslage, Läufe pro Woche, Krafttraining ja/nein); Passkey (Kennung, öffentlicher Schlüssel, Signaturzähler, Übertragungsart, Zeitpunkte); Anmelde-Challenges (5 Minuten); SHA-256-Hash des Sitzungs-Tokens mit Ablauf; Ziele (Rennen, Datum, Distanz, Zielzeit); Läufe (Zeitpunkt, Art, Distanz, Dauer, Anstrengung 1–10, Gehpausen, Notizen, Quelle, externe Aktivitäts-ID) |
| Nicht verarbeitet | E-Mail-Adresse, Passwort, Biometrie (bleibt auf dem Gerät), GPS-Strecken (nur Distanz/Dauer werden berechnet), Gewicht, Körperfett, Tracking, Werbung, IP-Adressen (dauerhaft) |
| Empfänger | Cloudflare, Inc. als Auftragsverarbeiter (Workers, D1) |
| Drittlandübermittlung | Datenbank mit Gerichtsbarkeit „EU“. Mögliche Zugriffe aus den USA: EU-US Data Privacy Framework bzw. Standardvertragsklauseln im DPA des Hosters |
| Löschfristen | Sofort bei Löschung durch Nutzer (D1 Time Travel: Wiederherstellungspunkte 7 Tage im Gratis-, 30 Tage im Paid-Tarif); automatisch nach 2 Jahren ohne Nutzung; Sitzungen nach 30 Tagen |
| TOMs | siehe `toms.md` |

## Verarbeitung 2: Pulsdaten (Gesundheitsdaten, Art. 9 DSGVO)

| Punkt | Inhalt |
| --- | --- |
| Zweck | Trainingsauswertung (z. B. Pace bei vergleichbarem Puls) |
| Rechtsgrundlage | Ausdrückliche Einwilligung, Art. 9 Abs. 2 lit. a DSGVO (separates, nicht vorausgewähltes Häkchen bei Registrierung, im Formular „Lauf eintragen“ oder in den Einstellungen; Zeitpunkt wird gespeichert als Nachweis nach Art. 7 Abs. 1) |
| Datenkategorien | Durchschnitts- und Maximalpuls je Lauf |
| Ohne Einwilligung | Pulswerte werden bei Import und Eingabe verworfen, nicht gespeichert |
| Widerruf | Jederzeit in den Einstellungen; löscht sofort alle gespeicherten Pulswerte |
| Weitergabe | Nur auf ausdrücklichen Wunsch: Der Durchschnittspuls je Lauf wird einer Crew angezeigt, wenn die Person das für diese Crew einschaltet (eigene, freiwillige Handlung, jederzeit abschaltbar; Widerruf der Einwilligung schaltet es überall aus). Puls fließt in keine Wochenwerte, Vergleiche oder Challenges ein |
| Löschfristen | Wie Verarbeitung 1, zusätzlich sofort bei Widerruf |

## Verarbeitung 3: Crews (Gruppen), Ranglisten, Challenges, Kudos und Kommentare

| Punkt | Inhalt |
| --- | --- |
| Zweck | Gemeinsames Training: Wochenbahnen, fairer Vier-Wochen-Vergleich, Challenges (Gruppe, Duell, persönlich), Feed mit Kudos und Kommentaren, Hinweise „seit deinem letzten Besuch“ |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO (vom Nutzer gewählte Funktion; Beitritt nur aktiv per Code oder Einladungslink; Teilnahme an Challenges nur nach Zusage); Moderation: Art. 6 Abs. 1 lit. f DSGVO |
| Daten | Crew: Name, Einladungscode, optional Rennen/Renndatum, Einstellung „nur Apple-Health-Läufe“. Mitgliedschaft: Rolle, Beitritt, Sichtbarkeit (Distanz, Pace), freiwillig Rennanmeldung, letzter Besuch. Wochenwerte je Nutzer (`run_weeks`) und Meilensteine. Challenges und Teilnahmen (Zusage, Ergebnis, Platz, Sticker). Kudos, Kommentare (max. 280 Zeichen), Meldungen |
| Für andere Mitglieder sichtbar | Immer: Name; Datum, Art, Dauer der Läufe seit Beitritt (Feed 21 Tage); Herkunft (Apple Health/selbst eingetragen); Gehpausen; Anzahl Läufe; Wochenplan-Fortschritt; Platz im Vier-Wochen-Vergleich (Serie in Wochen, Minuten gedeckelt bei Plan + 10 %); Statistik je Zeitraum (Läufe, Minuten, längster Lauf, Serie, Planquote; Jahr/Gesamt erst ab Crew-Gründung); Meilensteine; Challenges und Sticker; Kudos und Kommentare. Nur bei Opt-in je Crew: Distanz, Pace, Durchschnittspuls (nur mit Puls-Einwilligung), Rennanmeldung |
| Nicht sichtbar | Notizen, Maximalpuls, Ziele, Zielzeit, Trainingseinstellungen (Renndatum und Läufe pro Woche werden nur intern für Wochenziele genutzt) |
| Ausgeschlossen | unplausible Läufe (< 2:30 min/km) |
| Löschung | Austritt oder Entfernen beendet die Sichtbarkeit sofort; leere Crews werden gelöscht; Löschen einer Crew löscht Challenges, Kudos, Kommentare und Meldungen; Löschen eines Laufs löscht Kudos und Kommentare darauf; Kontolöschung löscht eigene Kommentare, Kudos, Teilnahmen und Wochenwerte, die Crew-Leitung geht an das am längsten dabei befindliche Mitglied (auch bei automatischer Löschung nach 2 Jahren) |

## Verarbeitung 4: Import aus Apple Health

| Punkt | Inhalt |
| --- | --- |
| Zweck | Läufe aus dem Apple-Health-Export übernehmen, auf Wunsch des Nutzers |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO; Puls nur mit Einwilligung (Art. 9 Abs. 2 lit. a DSGVO) |
| Ablauf | Der Nutzer exportiert in der Health-App („Alle Gesundheitsdaten exportieren“) und wählt export.zip in Pacepact. Die Datei wird ausschließlich im Browser des Nutzers entpackt und gelesen (`src/app/import/apple-import.tsx`); sie wird nie übertragen |
| Übertragene Daten | Nur Lauf-Trainings: Startzeit, Dauer, Distanz; Durchschnitts- und Maximalpuls (serverseitig verworfen ohne Einwilligung). Andere Trainings und Gesundheitsdaten verlassen das Gerät nicht |
| Dubletten | Derselbe Lauf aus Import und manueller Eingabe wird zusammengeführt (Start ±5 Min., Dauer ±15 %); die importierte Kopie bleibt, Anstrengung und Notizen der manuellen werden übernommen. Wiederholte Importe erzeugen keine Duplikate |
| Löschung | Wie Verarbeitung 1 (Lauf löschen, Kontolöschung) |

## Verarbeitung 5: Auslieferung der Website (Hosting) und Missbrauchsschutz

| Punkt | Inhalt |
| --- | --- |
| Zweck | Auslieferung, Schutz vor Angriffen (Begrenzung von Anmelde-, Beitritts-, Kommentar- und Import-Anfragen) |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb) |
| Daten | Verbindungsdaten beim Hoster (IP, Zeitpunkt, URL, User-Agent); bei Pacepact Zähler in D1 (`rate_limits`) nur mit SHA-256-Prüfsumme aus Zweck und IP-Adresse bzw. Konto-ID, Löschung nach spätestens 24 Stunden; keine IP-Adressen im Klartext |
| Empfänger | Hoster (Auftragsverarbeiter) |
| Löschfrist | gemäß Hoster (kurzfristige Logs); Pacepact speichert keine Zugriffslogs |

## Auftragsverarbeitung

Cloudflare Data Processing Addendum – gilt automatisch mit den Cloudflare-Nutzungsbedingungen: https://www.cloudflare.com/cloudflare-customer-dpa/
Wird ein anderer Hoster gewählt, dessen DPA hier eintragen und `src/lib/legal.ts` anpassen.
