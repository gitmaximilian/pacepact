# Drittdienste – Pacepact

> Stand 2026-11-12. Keine Rechtsberatung.

Pacepact bindet keine Schnittstellen von Drittanbietern an. Läufe kommen nur auf zwei Wegen herein:

1. **Manuelle Eingabe** durch den Nutzer.
2. **Apple-Health-Export:** Der Nutzer exportiert seine Daten selbst in der Health-App und wählt die Datei in Pacepact. Sie wird im Browser gelesen; übertragen werden nur Lauf-Trainings. Es gibt keinen Zugriff auf Apple Health über eine API und keine Verbindung zu Apple.

Workouts, die andere Apps (z. B. Strava, Garmin Connect) in Apple Health geschrieben haben, gibt der Nutzer damit selbst weiter. Pacepact nutzt dafür keine Anbieter-API; deren API-Bedingungen greifen daher nach Einschätzung nicht.

## Entfernt (2026-11-12)

Strava (OAuth, Webhook), die persönliche API, der Empfang aus „Health Auto Export“ und Apple-Kurzbefehlen sowie der Datei-Import (GPX, TCX, FIT, CSV). Die Tabellen `connections` und `api_tokens` wurden gelöscht (Migration `0002_import_only`), ebenso alle über Strava importierten Läufe. Das Cloudflare-Secret `ENCRYPTION_KEY` wird nicht mehr gebraucht und kann gelöscht werden.
