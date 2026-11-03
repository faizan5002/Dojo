# Local development

How to get Dojo running on your machine and what each command does. For how two developers and their agents share the repository, read [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md). For the rules that apply to every change, read [`../AGENTS.md`](../AGENTS.md).

## Prerequisites

| Tool     | Version      | Notes                                                                                             |
| -------- | ------------ | ------------------------------------------------------------------------------------------------- |
| Node.js  | `>= 22.18.0` | `engines.node` in `package.json`. CI uses Node 22.                                                |
| pnpm     | `10.6.2`     | Pinned by `packageManager`. Run `corepack enable` and pnpm picks it up.                           |
| Git      | any recent   | On Windows, install Git for Windows: the hooks are shell scripts run by its `sh`.                 |
| Postgres | optional     | Only needed for `/api/health`, migrations and `pnpm check:rls`. The landing page runs without it. |

## First run

```bash
git clone https://github.com/faizan5002/Dojo.git
cd Dojo
pnpm install
cp .env.example .env.local
pnpm dev
```

`pnpm install` does two things beyond installing packages: the `prepare` script sets `core.hooksPath` to `.githooks` (so the secret scan, commit-message check and pre-push gates run), and `postinstall` runs `prisma generate`.

Open <http://localhost:3000>. English is served unprefixed, and `/en` redirects to `/`. See [`ENVIRONMENT.md`](ENVIRONMENT.md) for what `.env.local` needs (only `DATABASE_URL`, and it only has to be a valid URL).

The landing page shows a loading screen for several seconds while its 3D scene and textures load, then unlocks scrolling.

## Commands

| Command                              | What it does                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                           | Next.js dev server (Turbopack).                                                                                                     |
| `pnpm build` / `pnpm start`          | Production build and server.                                                                                                        |
| `pnpm lint`                          | ESLint, `--max-warnings=0`.                                                                                                         |
| `pnpm typecheck`                     | `tsc --noEmit`.                                                                                                                     |
| `pnpm format:check` / `pnpm format`  | Prettier check / write. Formatting applies to Markdown too.                                                                         |
| `pnpm test`                          | Unit tests with `node --test`. See [`TESTING.md`](TESTING.md).                                                                      |
| `pnpm test:e2e`                      | Playwright smoke test. Boots `pnpm dev` itself unless `E2E_BASE_URL` is set.                                                        |
| `pnpm check:env`                     | Every `process.env.X` in `src/` is declared in `.env.example` and `src/lib/env.ts`.                                                 |
| `pnpm check:secrets`                 | Scans every tracked file for credentials. The pre-commit hook runs the same scanner on staged files.                                |
| `pnpm check:standards`               | Verifies the standards in [`STANDARDS.md`](STANDARDS.md) are still wired (rules index, hooks, CI gates, lint config).               |
| `pnpm check:template`                | Fails if the template's own repository tracks a session log. Passes trivially here.                                                 |
| `pnpm check:ai-models`               | Checks registered AI model slugs against OpenRouter. Needs network; exits 0 if OpenRouter is unreachable.                           |
| `pnpm check:rls`                     | Reads the database `DATABASE_URL` points at and verifies row-level security on every table. Needs Postgres with migrations applied. |
| `pnpm prisma:generate`               | Regenerate the Prisma client after a schema change.                                                                                 |
| `pnpm prisma:migrate:generate:check` | Dry-run what CI's migration generator would write.                                                                                  |
| `pnpm db:run-once`                   | Apply `prisma/run-once.sql` once to `DIRECT_URL` (else `DATABASE_URL`). A deploy does this; you normally do not.                    |
| `pnpm db:seed:practice`              | Seed the Prompting Guru challenge library into `DIRECT_URL` (else `DATABASE_URL`, or `--db-url`). Idempotent. Deploys run it too.   |

## A database for the signed-in app

Sessions, assessments and Prompting Guru need PostgreSQL and Supabase Auth (see [`ENVIRONMENT.md`](ENVIRONMENT.md)). For a fresh local database:

```bash
pnpm exec prisma migrate deploy   # every migration, in order
pnpm db:seed:practice             # the 40 Prompting Guru challenges
pnpm check:rls                    # RLS on every table, no policies
```

`prisma migrate deploy` reads `DATABASE_URL` and `DIRECT_URL` from the environment, not from `.env.local`, so export them first (the seed and the checks read `.env.local` themselves). Seeding again is safe: unchanged challenges are skipped. The database tests (`src/**/*-repository.test.mts`, `challenge-library.test.mts`) run against a second, throwaway database named by `TEST_DATABASE_URL`, with the same migrations applied, and skip without it.

## Git hooks

Installed automatically by `pnpm install`. They live in [`.githooks/`](../.githooks) and must never be skipped with `--no-verify`.

| Hook         | Runs                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| `pre-commit` | `node scripts/check-secrets.mjs --staged`                                                             |
| `commit-msg` | `node scripts/check-commit-message.mjs`: Conventional Commits plus a `Changelog:` line                |
| `pre-push`   | `format:check`, `lint`, `typecheck`, `check:env`, `check:events` (skipped: no such script) and `test` |

`pre-push` is the local version of CI. Push only when it passes.

## Working on the landing page

The page is a generated file, not hand-written. `public/landing-pages/kage.html` is produced from the document shipped in `@designcodeio/threeui` by `scripts/adapt-kage-landing.mjs`. To change its copy or layout, change the script and regenerate:

```bash
node scripts/adapt-kage-landing.mjs
```

The script refuses to run unless the source file's SHA-256 matches the expected value, and every replacement must match exactly once, so a package upgrade fails loudly instead of producing a half-adapted page. Update the hashes in [`public/landing-pages/ADAPTATION.md`](../public/landing-pages/ADAPTATION.md) when the output changes. Page metadata and the page's screen-reader text come from the `HomePage` namespace in `messages/en.json`.

## Session logs

Claude Code and Codex sessions write a redacted digest to `.claude-logs/`. These files are tracked: read yours, then commit it on your branch, in its own commit just before you push. See [`SESSION_LOGGING.md`](SESSION_LOGGING.md).

## Windows notes

- Line endings are LF everywhere: [`.gitattributes`](../.gitattributes) sets `* text=auto eol=lf`, so a checkout with `core.autocrlf=true` still gets LF working files and Prettier passes. If a clone made before that file existed shows every file as changed, run `git add --renormalize .` and review the result before committing.
- NTFS has no executable bit. The checks that look for one in the working tree are skipped on Windows; the Git-index mode check still enforces `100755` on the hooks.
- Run the git hooks and `pnpm` from a shell where Git for Windows' `sh` is on `PATH` (Git Bash, or PowerShell with Git installed).

## Troubleshooting

| Symptom                                                                    | Cause and fix                                                                                                                                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid environment variables` at startup                                 | `DATABASE_URL` is missing or not a URL. Copy `.env.example` to `.env.local`.                                                                                            |
| `/api/health` returns `503`                                                | There is no reachable database. Expected without Postgres; the landing page does not use it.                                                                            |
| `/llms.txt` and `/llms-full.txt` return `404`, `/robots.txt` disallows all | Intentional outside an indexable production deployment (`VERCEL_ENV=production` and `SITE.indexable`).                                                                  |
| The landing page sits on a loading screen                                  | The 3D scene is still loading; software rendering can take several seconds. If it never finishes, check the browser console for a failed asset under `/landing-pages/`. |
| `Failed to load resource` for `/_vercel/insights/script.js`                | Vercel Analytics is requested but only exists on Vercel. Harmless locally.                                                                                              |
| `pnpm install` fails in `prisma generate`                                  | The Prisma engines could not be downloaded. Retry with network access; `pnpm prisma:generate` repeats just that step.                                                   |
| Push is rejected by the `pre-push` hook                                    | Read the failing gate in the output, fix it and push again. Do not bypass it.                                                                                           |
| `git status` shows a session log                                           | Expected. Read it, then commit it in its own commit just before you push.                                                                                               |
