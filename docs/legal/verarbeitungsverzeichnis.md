# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) – Pacepact

> Stand 2026-11-11, **Entwurf – vom Verantwortlichen zu prüfen und freizugeben.** Internes Dokument; muss nicht veröffentlicht, aber auf Anfrage der Datenschutzbehörde vorgelegt werden. Bei Änderungen aktualisieren. Keine Rechtsberatung.

## Verantwortlicher

Maximilian Auer, Wien, Österreich – contact@maximilianauer.at
Datenschutzbeauftragter: nicht erforderlich (keine Kerntätigkeit in umfangreicher Verarbeitung besonderer Kategorien, keine systematische Überwachung; siehe `dsfa-schwellwertanalyse.md`).

## Verarbeitung 1: Nutzerkonto, Ziele und Läufe

| Punkt | Inhalt |
| --- | --- |
| Zweck | Lauftracker: Konto, Ziele, Trainingsplan, Erfassung und Auswertung von Läufen |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nutzungsverhältnisses) |
| Betroffene | Registrierte Nutzerinnen und Nutzer ab 14 Jahren (§ 4 Abs. 4 DSG) |
| Datenkategorien | Name (frei wählbar), E-Mail, Passwort-Hash (scrypt), Sprache, Zeitpunkte (Erstellung, Bestätigung der Hinweise, letzte Nutzung); SHA-256-Hash des Sitzungs-Tokens mit Ablauf; Ziele (Rennen, Datum, Distanz, Zielzeit); Läufe (Zeitpunkt, Art, Distanz, Dauer, Anstrengung 1–10, Gehpausen, Notizen, Quelle, externe Aktivitäts-ID) |
| Nicht verarbeitet | GPS-Strecken (nur Distanz/Dauer werden berechnet), Gewicht, Körperfett, Tracking, Werbung, IP-Adressen (dauerhaft) |
| Empfänger | Hoster als Auftragsverarbeiter (geplant: Cloudflare, Inc. – Workers/D1) |
| Drittlandübermittlung | Datenbank mit Gerichtsbarkeit „EU“. Mögliche Zugriffe aus den USA: EU-US Data Privacy Framework bzw. Standardvertragsklauseln im DPA des Hosters |
| Löschfristen | Sofort bei Löschung durch Nutzer (Wiederherstellungspunkte des Hosters max. 7 Tage); automatisch nach 2 Jahren ohne Nutzung; Sitzungen nach 30 Tagen |
| TOMs | siehe `toms.md` |

## Verarbeitung 2: Pulsdaten (Gesundheitsdaten, Art. 9 DSGVO)

| Punkt | Inhalt |
| --- | --- |
| Zweck | Trainingsauswertung (z. B. Pace bei vergleichbarem Puls) |
| Rechtsgrundlage | Ausdrückliche Einwilligung, Art. 9 Abs. 2 lit. a DSGVO (separates, nicht vorausgewähltes Häkchen bei Registrierung oder in den Einstellungen; Zeitpunkt wird gespeichert als Nachweis nach Art. 7 Abs. 1) |
| Datenkategorien | Durchschnitts- und Maximalpuls je Lauf |
| Ohne Einwilligung | Pulswerte werden bei Import und Eingabe verworfen, nicht gespeichert |
| Widerruf | Jederzeit in den Einstellungen; löscht sofort alle gespeicherten Pulswerte |
| Weitergabe | Keine; Gruppenmitglieder sehen keinen Puls |
| Löschfristen | Wie Verarbeitung 1, zusätzlich sofort bei Widerruf |

## Verarbeitung 3: Gruppen

| Punkt | Inhalt |
| --- | --- |
| Zweck | Gemeinsames Training: Team-Kennzahlen, Verlauf, Fortschritt gegenüber dem eigenen Start |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO (vom Nutzer gewählte Funktion; Beitritt nur aktiv per Code) |
| Für andere Mitglieder sichtbar | Name; Datum, Art, Distanz, Dauer, Pace der Läufe; daraus berechnete Kennzahlen |
| Nicht sichtbar | Notizen, Puls, E-Mail, Ziele; von Strava importierte Läufe (Strava-API-Bedingungen) |
| Löschung | Austritt beendet die Sichtbarkeit sofort; leere Gruppen werden gelöscht; bei Kontolöschung geht die Gruppenleitung an das älteste Mitglied |

## Verarbeitung 4: Verbindungen zu Drittdiensten und persönliche API

| Punkt | Inhalt |
| --- | --- |
| Zweck | Automatischer Import von Läufen auf Wunsch des Nutzers |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. b DSGVO (nur nach aktiver Verbindung durch den Nutzer und Zustimmung beim Dienst) |
| Dienste | Strava, Polar, Fitbit, Wahoo, Suunto (OAuth); Apple-Kurzbefehle, Android-Automationen u. a. über persönliche API-Tokens |
| Daten | Zugriffs- und Refresh-Tokens (AES-256-GCM verschlüsselt), externe Nutzer-ID, Zeitpunkt der letzten Synchronisierung, Fehlermeldung der letzten Synchronisierung; API-Tokens nur als SHA-256-Hash |
| Rolle | Die Dienste sind eigene Verantwortliche für ihre Daten; Pacepact liest nur und schreibt nichts zurück |
| Löschung | „Trennen“ löscht Tokens sofort; „Widerrufen“ löscht API-Token sofort |

## Verarbeitung 5: Auslieferung der Website (Hosting) und Missbrauchsschutz

| Punkt | Inhalt |
| --- | --- |
| Zweck | Auslieferung, Schutz vor Angriffen (Begrenzung von Anmeldeversuchen) |
| Rechtsgrundlage | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb) |
| Daten | Verbindungsdaten beim Hoster (IP, Zeitpunkt, URL, User-Agent); bei Pacepact IP-Adresse nur als Zähler im Arbeitsspeicher, max. 15 Minuten, nicht gespeichert |
| Empfänger | Hoster (Auftragsverarbeiter) |
| Löschfrist | gemäß Hoster (kurzfristige Logs); Pacepact speichert keine Zugriffslogs |

## Auftragsverarbeitung

Geplant: Cloudflare Data Processing Addendum – gilt automatisch mit den Cloudflare-Nutzungsbedingungen: https://www.cloudflare.com/cloudflare-customer-dpa/
Wird ein anderer Hoster gewählt, dessen DPA hier eintragen und `src/lib/legal.ts` anpassen.
