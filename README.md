# Qodlume

Qodlume is a Next.js daily developer quiz platform. Quiz content is stored in Cloudflare D1 for production publishing; the JSON files in `content/quizzes/` remain versioned backups and importable seed data.

## Quiz content and validation

The existing JSON format and validator remain the source format for imports. The validator checks quiz metadata, publication dates, statuses, question and option IDs, answer keys, explanations, code snippets, references, and supported question types. Publishing also enforces operational limits of 50 questions per quiz and 20 options per question.

Run the validator against every JSON file in `content/quizzes/`:

```bash
npm run validate:quizzes
```

`npm run build` runs this validation before the Next.js build.

## Publishing workflow

Sign in at `/admin` using the `ADMIN_PASSWORD` Worker secret. The admin publishing workspace at `/admin/import` supports:

- Creating and editing drafts or importing existing quiz JSON.
- Validating and previewing content before saving.
- Immediate publication, scheduling, unpublishing, archiving, and restoring.
- Downloading quiz JSON backups.

The server validates all content again before publication. Admin changes use same-origin, authenticated API requests; public pages and APIs only return records whose status is `published`. Scheduled items are published by the Worker Cron Trigger once a minute, even if no browser is open. Schedule timestamps are stored in UTC, while `publicationDate` remains a calendar date in the quiz’s IANA timezone (normally `Asia/Kolkata`).

Public quiz payloads omit answer keys and explanations. Answers are graded on the server and feedback is returned only after a complete submission.

### Bulk quiz imports and scheduling

In `/admin/import`, choose or paste either one quiz JSON object or an array of quiz objects in the existing quiz format. Preview each record's status, timezone, resolved schedule, validation errors, and conflicts before confirming **Save all as Draft** or **Schedule valid records**. Draft imports remain drafts regardless of their publication date. Scheduling an item without `scheduledAt` resolves to `00:00` on its publication date in its configured timezone (default `Asia/Kolkata`); explicit ISO timestamps with offsets are honored after date/timezone validation. Timestamps are normalized to UTC. Invalid items and duplicates are reported individually; existing quizzes and question IDs are never overwritten. A single quiz can be scheduled with **Schedule Publication**, or multiple drafts can be scheduled from the list. Public quiz APIs return only published records.

## Daily game challenges

Manage Reaction Time Challenge, Word Guess, and Memory Match content at `/admin/daily-games`. Daily game configurations are stored in the `daily_game_challenges` D1 table, separate from game rendering and logic. Create drafts as JSON, preview and validate them, then publish immediately or schedule them. Drafts never publish automatically. Scheduling without an explicit `scheduledAt` resolves to `00:00` on the publication date in its configured timezone (default `Asia/Kolkata`); explicit ISO timestamps with offsets are honored after validation and normalized to UTC. Only draft or unpublished items can be edited; a unique game/date constraint prevents accidental replacement of an existing record. Unpublishing makes the challenge unavailable without deleting it.

The public game endpoints choose the challenge matching the current `publicationDate` in that record’s IANA timezone. Scheduled challenges become published on the existing one-minute Worker Cron Trigger. The Word Guess answer is stored once in the challenge configuration, so every player receives the same answer for that date. Browser-local progress is keyed by game and publication date; game personal records remain separate from challenge configuration.

### Bulk game imports and scheduling

In `/admin/daily-games`, import one challenge JSON object or an array using the downloadable per-game templates and preview each item before confirming **Save all as Draft** or **Schedule valid records**. Game fields are `id`, `publicationDate`, optional `scheduledAt`, `timezone`, `status`, `gameType`, `title`, `description`, and `configuration`. Reaction Time configuration contains `attempts`, `minimumDelayMs`, and `maximumDelayMs`; Word Guess contains the five-letter `answer`, six `attempts`, and a `validWords` array that includes the answer; Memory Match contains `pairs` and an `emojis` array with one unique emoji per pair. The default timezone is `Asia/Kolkata`. Draft imports remain drafts, while scheduled imports resolve a missing time to midnight on each record's own publication date. Explicit timestamp offsets are honored. Imports never replace an existing game/date entry; invalid records and conflicts are reported individually. Word Guess answers and accepted-word lists remain server-side and are omitted from public challenge responses. Players can submit any five-letter alphabetic guess; each submission returns feedback and uses one attempt.

Apply the new schema before using the management UI:

```bash
npm run db:migrate:local
```

Apply it to remote D1 with `npm run db:migrate:remote` only after confirming the configured Cloudflare account and database, following the remote migration checks below.

## Cloudflare Workers and D1 setup

This app needs the **Cloudflare Workers + OpenNext** runtime. It is no longer a static Cloudflare Pages export: dynamic D1-backed `/quiz/[date]`, archive, sitemap, and admin routes require server-side execution. Existing Cloudflare resources are not automatically removed or changed by these project files.

1. Install dependencies, validate locally, and authenticate Wrangler:

   ```bash
   npm ci
   npm test
   npm run validate:quizzes
   npx.cmd tsc --noEmit
   npm run worker:build
   npx.cmd wrangler login
   ```

2. Use the existing D1 database. `wrangler.jsonc` is configured with binding `DB`, database name `qodlume`, and database ID `e4938352-b62d-4420-8dee-a62d82f3a81b`. Do not run `npm run db:create` for this project; the database already exists. Local development defaults to Wrangler's local D1 emulator so a local admin session cannot accidentally change production data. Remote database commands explicitly use `--remote`.

3. Configure production secrets; do not add them to Git. Check Cloudflare first so existing secrets are not unnecessarily replaced:

   ```bash
   npx.cmd wrangler secret put ADMIN_PASSWORD
   npx.cmd wrangler secret put AUTH_SECRET
   ```

   `ADMIN_PASSWORD` must be at least 16 characters. `AUTH_SECRET` must be at least 32 characters and should be a cryptographically random value. These are Worker secrets, not `NEXT_PUBLIC_*` variables.

4. Apply schema migrations and seed legacy content in local D1 first:

   ```bash
   npm run db:migrate:local
   npm run db:seed:local
   npm run preview
   ```

   These commands use Wrangler's local emulator. `npm run preview` also uses local D1.

5. After checking the existing remote database's migration state and reviewing the content to be imported, migrate and seed the remote database:

   ```bash
   npm run db:migrate:remote
   npm run db:seed:remote
   ```

   The JSON import is validated and inserts missing records without overwriting existing quizzes or editorial changes. The current JSON set contains three published quizzes, one draft, and one archived quiz. Do not run the remote seed until its additions have been reviewed.

6. Deploy the Worker. The first deployment provides the public Worker URL; confirm the intended production URL before configuring `SITE_URL`. Until configured, sitemap and robots requests fail explicitly rather than returning URLs for a placeholder domain. Deploy once to obtain the URL:

   ```bash
   npm run deploy
   ```

   Add the confirmed HTTPS origin under `vars.SITE_URL` in `wrangler.jsonc`, then redeploy:

   ```bash
   npm run deploy
   ```

   For Git-connected Worker builds, use `npm ci` for install and `npm run deploy` for the build/deploy command. Do not use the old Cloudflare Pages `out/` output-directory settings or `npx.cmd wrangler deploy` as an unconfigured Next.js auto-detection step.

Regenerate Cloudflare binding types after changing `wrangler.jsonc`:

```bash
npm run cf-typegen
```

## Local development

Create an ignored `.dev.vars` file for the local Worker preview:

```dotenv
ADMIN_PASSWORD="use-a-local-password-of-at-least-16-characters"
AUTH_SECRET="use-a-local-random-secret-of-at-least-32-characters"
SITE_URL="http://localhost:8787"
```

Then run:

```bash
npm run db:migrate:local
npm run db:seed:local
npm run preview
```

`npm run dev` starts the Next.js development server and uses Wrangler's local bindings through the OpenNext dev integration. The D1 local database must already have its schema and seed data. The local-only `SITE_URL` is allowed to use `http://localhost:8787`; production URLs must use HTTPS.

## Database model

The migrations in `migrations/` define `quizzes`, `questions`, `question_options`, `admin_login_attempts`, and `daily_game_challenges`, with checks, unique game/date pairs, and lookup indexes. `topic` is Qodlume’s existing category field; this preserves the current topic values and avoids a redundant categories table. Optional question hints and code/reference/tag metadata are preserved.

## Tests

```bash
npm test
npm run validate:quizzes
```

The test suite covers legacy validation, quiz and daily game publication visibility, timezone/date boundaries, explicit and default-midnight schedule resolution, draft preservation, scheduler recovery/idempotency, daily game configuration validation and consistency, answer grading, session signatures/expiry, and same-origin write protection.

## Operational notes and limitations

- A single shared administrator password is supported. Configure it as a Worker secret and rotate it when needed. This is not a multi-user identity provider or per-user role system.
- Cron scheduling has one-minute granularity. Cloudflare Cron Triggers are best-effort at their scheduled minute; due quizzes and daily game challenges are published on the next successful trigger.
- `SITE_URL` is a non-secret Worker variable that must be set to the confirmed canonical HTTPS origin before relying on sitemap and robots output. No placeholder production URL is configured.
- D1 database creation, remote migration/seed, secrets, Cloudflare project configuration, and deployment require the account owner’s Cloudflare access. This repository has not been connected to a production D1 database or deployed by these code changes.
