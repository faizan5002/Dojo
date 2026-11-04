# Team setup

How a teammate goes from a fresh clone to a running, tested Dojo on their own machine. Everything here is local: no step touches another person's database, Supabase project or credentials.

For the full command list and troubleshooting, see [`DEVELOPMENT.md`](DEVELOPMENT.md). For every variable, see [`ENVIRONMENT.md`](ENVIRONMENT.md).

## Ground rules

- **You use your own accounts.** You create your own local PostgreSQL database and your own Supabase project. Do not ask for, share or reuse anyone else's `.env.local`, database password or Supabase keys, and never commit yours (`.env*` is git-ignored except `.env.example`; a pre-commit hook and CI scan for secrets).
- **Two developers share this repo, each with an agent.** Read [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) and [`HANDOFF.md`](HANDOFF.md) before editing, and work on a branch, never on `main`.
- **Nothing here deploys anything.** Deployment is CI/CD only ([`rules/deployment.md`](rules/deployment.md)).

## 1. Prerequisites

| Tool       | Version               | Notes                                                            |
| ---------- | --------------------- | ---------------------------------------------------------------- |
| Node.js    | 22.18 or newer        | CI uses 22; 24 also works.                                       |
| pnpm       | 10.6.2                | `corepack enable` picks up the version pinned in `package.json`. |
| Git        | recent                | On Windows, Git Bash is needed for the hooks.                    |
| PostgreSQL | 16 (a local server)   | Docker is fine too. Any reachable Postgres 16 works.             |
| Supabase   | your own free project | Auth only. Needed for real sign-in, not for sample-data UI work. |

## 2. Clone and install

```bash
git clone https://github.com/faizan5002/Dojo.git
cd Dojo
pnpm install
```

`pnpm install` also runs `prisma generate` and points Git at the shared hooks in `.githooks/`. Do not bypass the hooks with `--no-verify`.

## 3. Create your `.env.local`

```bash
cp .env.example .env.local
```

On Windows PowerShell: `Copy-Item .env.example .env.local`. Then edit `.env.local`. Which variables you need depends on what you are doing:

| Variable                               | Needed for                                           | Status                       |
| -------------------------------------- | ---------------------------------------------------- | ---------------------------- |
| `DATABASE_URL`                         | Everything (must be a valid URL)                     | **Required**                 |
| `DIRECT_URL`                           | Applying migrations locally                          | Required for a real database |
| `NEXT_PUBLIC_SUPABASE_URL`             | Real sign-in, upload, scoring                        | Optional                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Real sign-in                                         | Optional                     |
| `SUPABASE_SECRET_KEY`                  | Server-side admin auth operations (account deletion) | Optional                     |
| `NEXT_PUBLIC_APP_URL`                  | Absolute URLs; match your dev port                   | Optional                     |
| `TEST_DATABASE_URL`                    | Repository tests against a throwaway database        | Optional, local only         |
| `DOJO_DEV_FRONTEND_MODE`               | Sample-data mode for UI work                         | **Dev only**, optional       |

Everything else in `.env.example` (Sentry, PostHog, Slack, cron) can stay empty locally. Never set `DOJO_DEV_FRONTEND_MODE` on a deployed environment; it is ignored when `NODE_ENV=production`, but it should not be there at all.

## 4. Database

Create an empty database, put its URL in `DATABASE_URL` and `DIRECT_URL` (a local server uses the same URL for both, on port 5432), then apply the committed migrations:

```bash
pnpm exec prisma migrate deploy
```

Never write or edit a file under `prisma/schema/migrations/` by hand. CI generates migrations from the schema diff ([`rules/migrations.md`](rules/migrations.md)).

For the repository tests, create a second throwaway database, apply the same migrations to it, and set `TEST_DATABASE_URL`. Never point that at the database you use for development.

## 5. Your own Supabase project

Real sign-in needs a Supabase project that you own:

1. Create a project at supabase.com.
2. Copy its project URL, the publishable key (`sb_publishable_...`) and the secret key (`sb_secret_...`) into `.env.local`. Use the new-style keys, not the legacy anon or service-role keys.
3. Under Authentication, set the Site URL to your dev URL (for example `http://localhost:3000`) and add `http://localhost:3000/**` as a redirect URL.
4. Decide whether email confirmation is on. If it is, sign-up needs a working mailbox; for local testing it is simpler to turn it off in your own project.

Supabase is used for Auth only. All application data lives in your PostgreSQL database through Prisma ([`rules/auth.md`](rules/auth.md)). Keep the Supabase Data API off.

## 6. Run the app

```bash
pnpm dev
```

Open <http://localhost:3000>. The landing page needs only `DATABASE_URL` to be a valid URL. If port 3000 is busy, `pnpm dev -p 3001` and set `NEXT_PUBLIC_APP_URL` to match.

On Windows, if routes start returning 404 or odd type errors after you stopped the dev server abruptly, delete the `.next` folder and start again. A production build and `pnpm dev` cannot share `.next`; stop one before running the other.

## 7. Two ways to use the signed-in pages

| Mode                  | How                                             | What you get                                                                                         |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Real auth**         | Supabase variables set, flag unset              | Sign up, upload `.claude-logs` digests, score them, PDF report. Data is yours, in your database.     |
| **Dev frontend mode** | `DOJO_DEV_FRONTEND_MODE="true"` in `.env.local` | A labelled mock user and fixture data in `/dashboard`, `/sessions`, `/assessment`. Nothing is saved. |

To switch the dev mode on or off, add or remove the one line in `.env.local` and **restart** `pnpm dev`. Writes (upload, score, delete) are refused in this mode on purpose. Details and the safety argument: [`FRONTEND_DEV_MODE.md`](FRONTEND_DEV_MODE.md).

## 8. Run the checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:env
pnpm check:secrets
pnpm test          # unit tests, about 6 minutes on Windows
```

Playwright (`pnpm test:e2e`) boots `pnpm dev` itself unless `E2E_BASE_URL` is set. Run it twice to cover everything:

1. With `DOJO_DEV_FRONTEND_MODE=true` in the environment of the server: the dashboard and dev-mode specs run.
2. With the flag unset: those specs skip, and the real sign-in specs run if Supabase is configured.

Specs that need a real Supabase session skip themselves when Supabase is not configured; this is always the case in CI, so a green CI run does not exercise real sign-in. Check [`TESTING.md`](TESTING.md) for what each spec covers.

## 9. Before you push

Run `/local-review` (or the commands above plus `pnpm build`). The `pre-push` hook runs format, lint, typecheck, env check and the unit tests, so the first push takes several minutes. Open a pull request against `main` only when the work is finished and self-reviewed; every push to an open PR is a paid CI run ([`rules/pull-requests.md`](rules/pull-requests.md)). Wait for all CI checks to pass before merging.

## Troubleshooting

| Symptom                                           | Likely cause and fix                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/api/health` returns 503                         | `DATABASE_URL` does not point at a reachable Postgres. Expected until you set one up. |
| Sign-up works but the app says you are signed out | Supabase Site URL or redirect URL does not match your dev URL.                        |
| Dashboard shows the sign-in page in dev mode      | You did not restart `pnpm dev` after editing `.env.local`.                            |
| `MISSING_MESSAGE` errors after editing `messages` | Restart `pnpm dev`.                                                                   |
| Push is slow                                      | The `pre-push` hook runs the whole unit suite. This is intended.                      |
