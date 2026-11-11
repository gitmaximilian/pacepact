# Pacepact

A running tracker for race goals, a simple repeating plan, and groups.
Set a race and target time, log runs by hand or import them automatically,
and train together with friends.

Planned address: `https://pacepact.maximilianauer.at`

## Features

- **Accounts:** open sign-up with passkeys only (Face ID, Touch ID, Windows Hello, phone). No email, no password.
  Users can add more passkeys in Settings.
- **Welcome flow:** four questions after sign-up (goal and date, starting point, runs per week, strength training)
  that set up the plan. It can be repeated from Settings.
- **Install as app:** web app manifest and icons; Android/Chrome gets a real install button, iPhone/iPad a short
  "Share → Add to Home Screen" guide (as in Rookie).
- **Languages:** English by default, German selectable on every page and saved per account.
- **Goals:** race, date, distance and optional target time. The required pace and a countdown in weeks are calculated.
- **Plan:** Run 1 (easy), Run 2 (easy, later tempo) and Run 3 (long run), with no fixed weekdays. Two runs a week drop
  Run 2; four add an easy Run 4. Phases are counted back from race day.
  Tempo work in Run 2 unlocks after a logged 30-minute run without walk breaks or, until then, based on the runner's own
  statement in the welcome flow (shown as "reported", not "measured"). Never because of the calendar.
- **Runs:** manual entry (distance, duration, heart rate, effort 1–10, walk breaks, notes) and a list where the run type can be changed.
- **Import:**
  - Files: GPX, TCX, FIT and CSV. The CSV import understands English and German headers, including the old team spreadsheet.
  - OAuth connections: Strava (including a push webhook), Polar, Fitbit, Wahoo and Suunto.
  - Personal API tokens for Apple Shortcuts (Apple Health), Android automations (Health Connect), Zapier, Make and similar tools.
  - Duplicates are skipped by source and activity ID.
- **Groups:** create a group, invite others with a 6-character code, and see team km, a feed and each member's progress.
  Progress is measured against each member's own first runs, not against the fastest runner.
  Members see run summaries only, never notes.
- **Design:** "Bahn" (blue tartan track, lane numbers, condensed race numerals), light and dark mode, works on phones.

Garmin Connect and COROS need partner approval from the vendor before API credentials are issued. Until then, users can
sync those watches to Strava or upload FIT files.

## Stack

- Next.js 16 (App Router, server actions), React 19, TypeScript
- Runs on Cloudflare Workers via the OpenNext adapter (`@opennextjs/cloudflare`), like
  [Rookie](https://github.com/gitmaximilian/rookie-chess) on the same domain
- Cloudflare D1 (SQLite) with EU jurisdiction, accessed through Drizzle ORM
- Self-hosted fonts (no requests to Google Fonts)

## Local development

```bash
npm ci
cp .env.example .dev.vars        # optional; everything works without integrations
npm run db:migrate:local         # creates the local D1 database in .wrangler/
npm run dev                      # http://localhost:3000
```

`npm run preview` builds the Worker and runs it in the real Workers runtime (workerd) on your machine.

Checks:

```bash
npm run lint    # TypeScript
npm test        # unit tests (node:test)
npm run build
```

After changing `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`, then apply it
locally and remotely (`npm run db:migrate:local`, `npm run db:migrate:remote`).

## Deployment (Cloudflare)

One-time setup:

1. `npx wrangler login`
2. Create the database in the EU: `npx wrangler d1 create pacepact --jurisdiction eu`.
   Put the printed `database_id` into `wrangler.jsonc`.
3. Apply migrations: `npm run db:migrate:remote`
4. Set secrets: `npx wrangler secret put ENCRYPTION_KEY` (32 random bytes, base64), plus the client IDs and secrets of
   every service you want to offer (see below).
5. Deploy: `npm run deploy`. The route in `wrangler.jsonc` attaches `pacepact.maximilianauer.at` as a custom domain;
   because `maximilianauer.at` is on Cloudflare, DNS and HTTPS are set up automatically.

Afterwards, every `npm run deploy` publishes a new version.

Automatic deploys (set up for production): Cloudflare dashboard → Workers & Pages → `pacepact` → Settings → Builds →
Connect → repository `gitmaximilian/pacepact`, branch `main`, build command `npx opennextjs-cloudflare build`,
deploy command `npx opennextjs-cloudflare deploy`. Every push to `main` then goes live. Database migrations are not
applied by the build; run `npm run db:migrate:remote` before pushing a schema change.

Plan note: Pacepact is built for the Workers Free plan (10 ms CPU per request). Sign-in uses passkeys, whose
verification is cheap; page rendering measured around 10 ms locally, so occasional CPU-limit errors (1102) are
possible on Free. If they happen, Workers Paid removes the limit without code changes.

Local preview note: because `wrangler.jsonc` has a custom-domain route, run the local Worker with
`npx wrangler dev --local-upstream localhost:8787` so the Origin check of the passkey API sees the local address.

## Configuration

See `.env.example`. In production you need at least `ENCRYPTION_KEY` (32 random bytes, base64; it encrypts
provider tokens at rest). `APP_URL` is set in `wrangler.jsonc`.

### Connecting services

Each service is optional. A service only shows a "Connect" button once its credentials are set.
The callback URL for every service is:

```
https://<your-domain>/api/connections/<provider>/callback
```

| Service | Where to register | Environment variables |
| --- | --- | --- |
| Strava | https://www.strava.com/settings/api (set "Authorization Callback Domain" to your domain) | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`, optional `STRAVA_SUBSCRIPTION_ID` |
| Polar | https://admin.polaraccesslink.com | `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET` |
| Fitbit | https://dev.fitbit.com/apps (type "Server") | `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET` |
| Wahoo | https://developers.wahooligan.com | `WAHOO_CLIENT_ID`, `WAHOO_CLIENT_SECRET` |
| Suunto | https://apizone.suunto.com | `SUUNTO_CLIENT_ID`, `SUUNTO_CLIENT_SECRET`, `SUUNTO_SUBSCRIPTION_KEY` |

Strava push updates: after deploying, create a webhook subscription with the callback
`https://<your-domain>/api/webhooks/strava` and the same verify token
(see https://developers.strava.com/docs/webhooks/).

The provider mappings are unit-tested against sample payloads, but no service has been tested end to end against its
live API yet. Verify each one with a real account after adding its credentials.

### Personal API (Apple Health, Health Connect, automations)

Create a token under **Settings → API tokens**, then:

```bash
curl -X POST https://<your-domain>/api/ingest \
  -H "Authorization: Bearer pp_..." \
  -H "Content-Type: application/json" \
  -d '{"startedAt":"2026-11-12T18:30:00Z","distanceKm":5.2,"durationSec":1980,"avgHr":158,"runType":"run1","source":"apple-health"}'
```

The body can also be an array of up to 500 runs. Required fields: `startedAt`, `distanceKm`, `durationSec`.
Optional fields: `avgHr`, `maxHr`, `effort` (1–10), `walkBreaks`, `runType` (`run1`, `run2`, `run3`, `test`, `other`),
`notes`, `externalId`, `source`. Sending the same `externalId` again does not create a duplicate.

## Privacy and security

- Sign-in: passkeys (WebAuthn) only; the server stores public keys, one-time challenges expire after 5 minutes.
  Sessions: random tokens, stored only as SHA-256 hashes.
- Provider tokens are encrypted with AES-256-GCM. Pacepact only reads activities and never posts anything back.
- The passkey API checks the Origin header; sign-in and the ingest API are rate-limited per Worker instance.
- Users can delete their account and all data under Settings. Groups they own are handed to another member.
- Heart rate is health data (Art. 9 GDPR). It is only stored with explicit, separate consent; without consent,
  heart-rate values are dropped before saving. Withdrawing consent deletes all stored heart rates.
- Sign-up requires confirming a minimum age of 14 (Austria, § 4 (4) DSG) and having read the privacy notice.
  No email address is collected.
- Users can download all their data as JSON (`/api/export`). Accounts unused for two years are deleted automatically.
- Runs imported from Strava are never shown to other group members (Strava API terms).
- The in-app privacy notice is at `/privacy` (English and German). Its facts come from `src/lib/legal.ts`.
  It describes the hosting on Cloudflare (Workers and D1, EU). Update that file if the hosting changes.
- Internal GDPR documents (German) are in `docs/legal/`: record of processing activities, technical and organisational
  measures, data breach procedure, DPIA threshold assessment, third-party API checklist and a section for the
  privacy policy on maximilianauer.at.

## License

Not chosen yet.
