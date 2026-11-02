# Testing and quality gates

## Commands

```bash
pnpm test        # unit tests, node --test, no browser
pnpm test:e2e    # Playwright; boots the app itself unless E2E_BASE_URL is set
```

Run a single file while iterating:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs --test scripts/session-log.test.mjs
```

`pnpm test` is `node --test` over `scripts/*.test.mjs` and `src/**/*.test.mts`. The `register-ts.mjs` import lets the runner load TypeScript and resolve the `@/` alias; there is no separate test framework. A full run on Windows reports 338 tests: 337 pass, 0 fail and 1 is skipped (the check for an on-disk executable bit, which NTFS cannot express).

## What is covered

| Area                                                 | Where                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Session logger: parsing, redaction, attribution, CLI | `scripts/session-log.test.mjs`                                                                             |
| Secret scanner                                       | `scripts/check-secrets.test.mjs`                                                                           |
| Commit-message rules                                 | `scripts/check-commit-message.test.mjs`                                                                    |
| Standards checker, run against fixture repos         | `scripts/check-standards.test.mjs`                                                                         |
| Template-cleanliness check                           | `scripts/check-template-clean.test.mjs`                                                                    |
| Run-once SQL runner                                  | `scripts/run-once-sql.test.mjs`                                                                            |
| RLS check                                            | `scripts/check-rls.test.mjs`                                                                               |
| Hook-environment isolation for the git tests         | `scripts/test-git-env.test.mjs`                                                                            |
| Feature flags, RBAC, logger, AI usage, cron auth     | `src/lib/flags/`, `src/lib/rbac/`, `src/server/lib/logger/`, `src/server/lib/ai-usage/`, `src/server/api/` |
| SEO registry (every public page has metadata)        | `src/lib/seo/seo.test.mts`                                                                                 |

Playwright specs live in `e2e/`: `smoke.spec.ts` (root serves the default locale, `/en` redirects), `auth.spec.ts`, `assessment-pdf.spec.ts`, `dashboard.spec.ts` and `dev-frontend-mode.spec.ts`. Specs that need a real Supabase session skip themselves when it is not configured, which is always the case in CI. The dashboard and dev-mode specs run against the sample-data mode when `DOJO_DEV_FRONTEND_MODE=true` and are skipped otherwise, so run the suite twice (flag on, flag off) to exercise everything; see [`TEAM_SETUP.md`](TEAM_SETUP.md). The landing page itself (a WebGL scene in an iframe) is not covered by an automated test; it is checked by looking at it, and the screenshots in the README come from a real production build.

## Writing tests that use git

Git exports `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_WORK_TREE` and similar variables to the hooks it runs, and in a linked worktree `GIT_DIR` is set for `pre-push`. A child process inherits them, so a test that runs `git init` or `git config` in a temporary directory would operate on the repository that is running the hook and rewrite its config or index.

Tests that use git on a temporary repository must take their environment from [`scripts/test-git-env.mjs`](../scripts/test-git-env.mjs):

- `cleanGitEnv()` returns a copy of `process.env` without any `GIT_*` variable. Pass it as `env` to `spawnSync`, `execFileSync` and similar.
- `withoutGitEnv(fn)` removes `GIT_*` from `process.env` for the duration of a synchronous call, for code that spawns git itself.

Commands that deliberately target the real repository keep the inherited environment. `scripts/test-git-env.test.mjs` proves the isolation by running the git-using tests as a child process with hook-style variables pointing at a sentinel repository and checking that its config, index, refs and status come out identical. Do not weaken or skip it.

## Quality gates

| Gate                 | Command                | Runs in                                               |
| -------------------- | ---------------------- | ----------------------------------------------------- |
| Formatting           | `pnpm format:check`    | `pre-push`, CI `check`                                |
| Lint                 | `pnpm lint`            | `pre-push`, CI `check`                                |
| Types                | `pnpm typecheck`       | `pre-push`, CI `check`                                |
| Env declarations     | `pnpm check:env`       | `pre-push`, CI `check`                                |
| Secret scan          | `pnpm check:secrets`   | `pre-commit` (staged), CI `check` (all tracked files) |
| Standards            | `pnpm check:standards` | CI `check`                                            |
| Template cleanliness | `pnpm check:template`  | CI `check`                                            |
| Unit tests           | `pnpm test`            | `pre-push`, CI `check`                                |
| Production build     | `pnpm build`           | CI `build`                                            |
| End-to-end           | `pnpm test:e2e`        | CI `e2e`                                              |
| AI model registry    | `pnpm check:ai-models` | CI `ai-models`                                        |
| Commit messages      | `check-commit-message` | `commit-msg`, CI `commits`                            |
| Migrations and RLS   | `pnpm check:rls`       | CI `migrations` (needs Postgres)                      |

The `pre-push` hook is the local half of CI. Run it, or `/local-review`, before pushing: every push to an open pull request is a paid CI run. The workflows are in [`.github/workflows/`](../.github/workflows); setting up their secrets is covered in [`CI_CD_SETUP.md`](CI_CD_SETUP.md).

## Platform notes

Linux CI is the reference. On Windows, the standards tests give the fixture repositories the executable modes of the real index and run `tsc` through its JavaScript entry point instead of the `.bin` shim, so the same checks run there. The exceptions are listed in [`DEVELOPMENT.md`](DEVELOPMENT.md#windows-notes).
