# Environment variables

Every variable the app reads is declared in two places that must agree: [`.env.example`](../.env.example) (what each one is for, with inline comments) and the Zod schema in [`src/lib/env.ts`](../src/lib/env.ts), which validates them at boot (`instrumentation.ts` calls it, so a bad value fails immediately with a clear message). `pnpm check:env` fails if a `process.env.X` in `src/` is missing from either.

Local development reads `.env.local`, which is gitignored. Never commit a populated env file (`.env.example` is the only tracked one). Where each variable lives in production is covered in [`CI_CD_SETUP.md`](CI_CD_SETUP.md).

## What you need to run the landing page

Only `DATABASE_URL`, and it only has to be a valid URL. The landing page does not connect to the database. The placeholder in `.env.example` is enough for `pnpm dev`, `pnpm build` and `pnpm start`. Everything else is optional and degrades quietly: Sentry, PostHog, Slack alerting and Supabase are all inactive until configured.

`/api/health` does check the database, so it returns `503` until `DATABASE_URL` points at a reachable Postgres. That is expected locally.

## Reference

| Variable                               | Required                  | Used for                                                                                                                                                                                               |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                         | **Yes**, in every env     | Prisma runtime connection. Use the pooler (port 6543, `pgbouncer=true`) on serverless hosts.                                                                                                           |
| `DIRECT_URL`                           | Local and CI only         | Direct connection (port 5432) for the Prisma CLI (`migrate`) and `pnpm db:run-once`. Never set it in the deployed app.                                                                                 |
| `NEXT_PUBLIC_SUPABASE_URL`             | No                        | Supabase Auth (sessions only). Without it, `src/proxy.ts` skips session refresh.                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No                        | Supabase publishable key (`sb_publishable_...`).                                                                                                                                                       |
| `SUPABASE_SECRET_KEY`                  | No                        | Server-only Supabase secret key, used for admin auth operations. Never expose it to the client.                                                                                                        |
| `TEST_DATABASE_URL`                    | Local only, optional      | A throwaway Postgres database with the schema applied. `src/features/workspace/repository.test.mts` runs against it and is skipped without it. Never the dev or production database.                   |
| `LOG_LEVEL`                            | No                        | Server logger level: `debug`, `info`, `warn`, `error` or `silent`. Defaults to `info` (`silent` under tests).                                                                                          |
| `NEXT_PUBLIC_SENTRY_DSN`               | No (set it in production) | Error reporting. Unset means reporting is off and the server logs `error reporting disabled`.                                                                                                          |
| `SENTRY_ORG`, `SENTRY_PROJECT`         | No                        | Sentry project identity, used when uploading source maps.                                                                                                                                              |
| `SENTRY_AUTH_TOKEN`                    | No                        | Source-map upload at build time. CI and Vercel only; not needed locally. No code in this repository reads it; Sentry's build tooling picks it up from the environment, so it is not in the Zod schema. |
| `NEXT_PUBLIC_POSTHOG_KEY`              | No                        | Client-side analytics capture key (public by design).                                                                                                                                                  |
| `NEXT_PUBLIC_POSTHOG_HOST`             | No                        | PostHog host. Defaults to `https://us.i.posthog.com`.                                                                                                                                                  |
| `POSTHOG_PERSONAL_API_KEY`             | No                        | Server-side PostHog key that enables local feature-flag evaluation. A real secret: never prefix it with `NEXT_PUBLIC_`.                                                                                |
| `SLACK_ALERT_WEBHOOK_URL`              | No                        | `captureError()` posts unexpected production errors here. Does nothing when unset.                                                                                                                     |
| `ADMIN_EMAIL_DOMAINS`                  | No                        | Comma-separated email domains whose users receive the lowest admin seat on first sign-in.                                                                                                              |
| `NEXT_PUBLIC_DEFAULT_LOCALE`           | No                        | Defaults to `en`. The locale list itself is in `src/i18n/routing.ts` (English only today).                                                                                                             |
| `CRON_SECRET`                          | Only for cron routes      | Bearer secret checked by routes under `src/app/api/cron/**`. There are no cron routes today; CI sets a placeholder so the build and e2e jobs run.                                                      |
| `NEXT_PUBLIC_APP_URL`                  | No (set it in production) | The site's canonical origin, used for canonicals, the sitemap and `llms.txt`. Defaults to `http://localhost:3000`. Must be the real domain in production.                                              |
| `NEXT_PUBLIC_APP_VERSION`              | No                        | Attached to analytics events as `app_version`.                                                                                                                                                         |

Two further variables are not in `.env.example` because they are set by the platform or by a person:

- `VERCEL_ENV` is set by Vercel. The site only reports itself as indexable when it equals `production` (`src/lib/seo/site.ts`), which is why `robots.txt` disallows everything and `llms.txt` returns `404` locally and on previews.
- `PRODUCTION_DATABASE_URL` is a GitHub Environment secret used only by `.github/workflows/deploy-migrations.yml`. It is commented out in `.env.example` for discoverability and must never appear in a local or Vercel environment.

## Adding a variable

1. Read it through `src/lib/env.ts`, not `process.env` directly where the schema applies.
2. Add it to the Zod schema and to `.env.example` with a comment.
3. Run `pnpm check:env`.
4. If CI or Vercel needs it, document where in [`CI_CD_SETUP.md`](CI_CD_SETUP.md).

Secrets handling rules, including what must never reach a log or a transcript, are in [`rules/secrets.md`](rules/secrets.md).
