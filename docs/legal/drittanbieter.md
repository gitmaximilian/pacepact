# Drittdienste: Bedingungen vor dem Livegang prüfen – Pacepact

> Stand 2026-11-12. Die API-Bedingungen der Anbieter ändern sich regelmäßig. Vor dem Freischalten jedes Dienstes den aktuellen Text lesen und hier abhaken. Keine Rechtsberatung.

## Strava (API Agreement, Brand Guidelines)

- [x] **Anzeige nur für den eigenen Nutzer:** Seit dem Update der Strava-API-Bedingungen (November 2024) dürfen Strava-Daten eines Athleten nur diesem Athleten angezeigt werden. Umgesetzt: Läufe mit Quelle `strava` werden in Crews weder angezeigt noch mitgezählt – auch nicht aggregiert (Team-Summen, Ranglisten, Challenges, Meilensteine). Die UI erklärt das. Aktuellen Wortlaut vor dem Freischalten von Strava erneut prüfen.
- [ ] **Keine Nutzung für KI-Training** und keine Weitergabe – Pacepact tut beides nicht.
- [ ] **Athleten-Kapazität:** Neue API-Apps sind anfangs auf sehr wenige verbundene Athleten begrenzt; für mehr Nutzer muss die App bei Strava zur Prüfung eingereicht werden.
- [ ] **Branding:** „Connect with Strava“-Button und „Powered by Strava“-Hinweis gemäß Brand Guidelines; Strava-Logo-Dateien von Strava beziehen.
- [x] **Löschung:** Trennt ein Nutzer die Verbindung bei Strava, löscht der Webhook (Deauthorization-Event) die gespeicherten Tokens sofort. Gelöschte Strava-Aktivitäten werden auch in Pacepact gelöscht.

## Polar AccessLink, Fitbit/Google, Wahoo, Suunto

- [ ] Developer-Bedingungen lesen (Anzeige an Dritte/Gruppen erlaubt? Speicherdauer? Branding?).
- [x] Bis zur Prüfung ausgeschlossen: Alle OAuth-Anbieter stehen in `PROVIDER_SOURCES` (`src/lib/social/sources.ts`) und zählen nicht in Crews. Erst nach geprüften Bedingungen (Anzeige an andere Nutzer, auch aggregiert) einzeln freischalten und Datenschutzseite anpassen.
- [ ] Fitbit: Status der Fitbit Web API prüfen (Google führt Fitbit in Google-Konten über; Schnittstelle kann sich ändern).
- [ ] Suunto: Aktivitäts-IDs für Laufen mit echtem Konto prüfen (`src/lib/providers/others.ts`).

## Garmin, COROS

- Nur mit Partner-Freigabe. Bis dahin Import über Strava oder FIT-Datei.

## Apple Health, Health Connect

- Kein Web-Zugang; Import über persönliche API-Tokens (Apple-Kurzbefehle, Android-Automationen). Nutzer senden ihre Daten selbst; gleiche Regeln wie bei manueller Eingabe (Puls nur mit Einwilligung).
