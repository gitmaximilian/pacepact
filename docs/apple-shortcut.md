# Pacepact Apple Shortcut

Free way to send Apple Watch runs to Pacepact: a personal automation "Apple Watch Workout → Ends" runs the shared
shortcut "Pacepact run", which posts the latest workout to `/api/ingest/apple-health`.

The shortcut is built once (by the maintainer), shared as an iCloud link and set as `APPLE_SHORTCUT_URL` in
`wrangler.jsonc`. Every runner then installs it, pastes their key (import question) and creates the automation.
Automations themselves cannot be shared; the Connections page explains that step.

## Endpoint contract

`POST https://pacepact.maximilianauer.at/api/ingest/apple-health`, header `Authorization: Bearer pp_…`, JSON body:

| Field | Required | Accepted shapes |
| --- | --- | --- |
| `start` | yes | ISO 8601 (`2026-11-12T07:00:00+01:00`), `2026-11-12 07:00:00 +0100`, `12.11.2026, 07:00` (Vienna time) |
| `end` | if no `duration` | same as `start` |
| `duration` | if no `end` | seconds, `32:05`, `0:32:05`, `32 min 5 s`, `1 Std. 5 Min.`, `PT32M5S` |
| `distance` | no | `5.08`, `5,08 km`, `5080 m`, `3.1 mi` (bare numbers: km, or metres above 400) |
| `type` | no | if present and not a run (`run`, `lauf`), the workout is ignored |
| `avgHr`, `maxHr` | no | stored only with heart-rate consent |

The response contains `message` (e.g. "Pacepact: Lauf gespeichert · 5,08 km · 32:05") for a notification.
Sending the same run twice is harmless (same start minute = same run); a run that also arrives from Strava or a
manual entry is merged (`src/lib/dedupe.ts`).

## Building the shortcut (German iOS labels, English in brackets)

1. **Text** (Text): leave empty. In the shortcut's settings (ⓘ) → **Importfragen** (Import Questions) add a question
   for this text: "Dein Pacepact-Schlüssel (Verbindungen → Apple Health)". Rename the output to `Schlüssel`.
2. **Warten** (Wait) 10 seconds, so Health has saved the workout when the automation fires.
3. **Health-Beispiele suchen** (Find Health Samples): type **Trainings** (Workouts), sort by **Startdatum**, **Neueste
   zuerst**, limit **1**.
4. **Details von Health-Beispiel abrufen** (Get Details of Health Sample) three times: **Startdatum** → variable
   `Start`, **Enddatum** → `Ende`, **Dauer** → `Dauer`.
5. **Health-Beispiele suchen**: type **Gehen + Laufen (Distanz)** (Walking + Running Distance), filter **Startdatum ist
   nach** `Start` and **Enddatum ist vor** `Ende`. Then **Statistik berechnen** (Calculate Statistics) → **Summe** →
   variable `Distanz`. (During a run, this is the run's distance including walk breaks.)
6. **Datum formatieren** (Format Date) `Start` → **ISO 8601**, time included → `StartISO`; same for `Ende` → `EndeISO`.
7. **Inhalte von URL abrufen** (Get Contents of URL): URL above, method **POST**, header `Authorization` =
   `Bearer ` + `Schlüssel`, request body **JSON**: `start` = `StartISO`, `end` = `EndeISO`, `duration` = `Dauer`,
   `distance` = `Distanz`.
8. **Wörterbuchwert abrufen** (Get Dictionary Value) `message` → **Mitteilung anzeigen** (Show Notification).

Name it "Pacepact Lauf" / "Pacepact run", then Share → **iCloud-Link kopieren** and put the link into
`APPLE_SHORTCUT_URL`.

If step 3 does not offer **Trainings** on your iOS version, use the automation time instead: `Ende` = **Aktuelles
Datum** (Current Date) and `Start` = `Ende` minus the duration from **Health-Beispiele suchen** for the latest
**Trainingsminuten**, or send only `end` and `distance` and report back: the endpoint can be extended.

Status: endpoint and parsing are tested with simulated payloads; the shortcut itself still has to be built and
checked on a real iPhone with an Apple Watch.
