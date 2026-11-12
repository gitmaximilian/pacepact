# Drittdienste: Bedingungen vor dem Livegang prüfen – Pacepact

> Stand 2026-11-12. Die API-Bedingungen der Anbieter ändern sich regelmäßig. Vor dem Freischalten jedes Dienstes den aktuellen Text lesen und hier abhaken. Keine Rechtsberatung.

## Strava (API Agreement, Brand Guidelines)

- [x] **Anzeige nur für den eigenen Nutzer:** Seit dem Update der Strava-API-Bedingungen (November 2024) dürfen Strava-Daten eines Athleten nur diesem Athleten angezeigt werden. Umgesetzt: Läufe mit Quelle `strava` werden in Crews weder angezeigt noch mitgezählt – auch nicht aggregiert (Team-Summen, Ranglisten, Challenges, Meilensteine). Die UI erklärt das. Aktuellen Wortlaut vor dem Freischalten von Strava erneut prüfen.
- [ ] **Keine Nutzung für KI-Training** und keine Weitergabe – Pacepact tut beides nicht.
- [ ] **Athleten-Kapazität:** Neue API-Apps starten im „Single Player Mode“ (nur das eigene Konto). Für Freunde: Kapazität im Strava-API-Dashboard erhöhen bzw. Review beantragen (seit Juni 2026 neue Stufen, ggf. Strava-Abo nötig).
- [ ] **Branding:** Derzeit Text-Button „Connect with Strava“ in Strava-Orange und Text „Powered by Strava“. Vor dem Freischalten für andere die offiziellen Button-/Logo-Dateien aus den Strava Brand Guidelines einsetzen.
- [x] **Trennen/Widerruf:** Trennen ruft `/oauth/deauthorize` auf und löscht standardmäßig alle Strava-Läufe; Deauthorisierungs-Webhook löscht Tokens und Strava-Läufe.
- [x] **Löschung:** Trennt ein Nutzer die Verbindung bei Strava, löscht der Webhook (Deauthorization-Event) die gespeicherten Tokens sofort. Gelöschte Strava-Aktivitäten werden auch in Pacepact gelöscht.

## Apple Health über „Health Auto Export“

- [x] Kein Web-Zugang zu Apple Health; die iPhone-App „Health Auto Export“ (HealthyApps) sendet Workouts per REST-Automation direkt vom Gerät an `/api/ingest/apple-health`. Die Daten kommen vom Nutzer selbst, nicht über eine Anbieter-API; es gelten die Regeln wie bei Datei-Uploads (Puls nur mit Einwilligung). Automationen brauchen dort das Premium-Abo des Nutzers.
- [ ] Prüfen, ob die von Strava/Garmin in Apple Health geschriebenen Workouts Bedingungen unterliegen, die eine Anzeige in Crews ausschließen (Einschätzung: nein, da der Nutzer seine eigenen Gerätedaten selbst weitergibt; keine Rechtsberatung).

## Entfernt (2026-11-12)

Polar, Fitbit, Wahoo, Suunto, Garmin und COROS sind aus der App entfernt: Fitbit Web API wurde am 2. 11. 2026 abgeschaltet, Garmin/COROS/Wahoo/Suunto brauchen Partner-Freigaben, Polar war ungetestet. Uhren dieser Hersteller kommen über Apple Health oder Datei-Upload herein.
