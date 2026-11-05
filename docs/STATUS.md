# Status

Last updated: 2026-11-03. Update this whenever state changes; keep it short and factual. Who is doing what lives in [`HANDOFF.md`](HANDOFF.md); why choices were made lives in [`DECISIONS.md`](DECISIONS.md).

## Where the project is

Dojo is in early development. The **public landing page is implemented**, and so is a first signed-in workspace: accounts, session upload, rules-based assessment, PDF reports and a coaching-first dashboard. The LLM judge, progress sharing and a production deployment are **not built**, and some product questions remain open (see [`HANDOFF.md`](HANDOFF.md), "Decisions needed"). Direction and sequencing: [`PRODUCT_STRATEGY.md`](PRODUCT_STRATEGY.md), [`FUTURE_ARCHITECTURE.md`](FUTURE_ARCHITECTURE.md), [`ROADMAP.md`](ROADMAP.md).

The work so far is published on the branch `chore/phase-0-agent-setup` of `https://github.com/faizan5002/Dojo.git`. `main` still points at `2f2f925` (the template plus one historical commit); the branch has not been merged into it.

## Implemented

| Item                                                                | Notes                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing page at `/`                                                 | Adapted from the Kage page in `@designcodeio/threeui` 1.2.0. Provenance and hashes: `public/landing-pages/ADAPTATION.md`. Copy states plainly that the coaching loop is still being built.                                                                                                |
| Local session logger for Claude Code and Codex                      | `scripts/session-log.mjs`, `.claude/settings.json`, `.codex/hooks.json`. Redacted, committed with the work. See [`SESSION_LOGGING.md`](SESSION_LOGGING.md).                                                                                                                               |
| Windows-capable test suite and checks                               | CRLF checkouts, the missing executable bit, `.bin` shims and the `@/` alias no longer fail tests on Windows. LF is enforced by `.gitattributes`.                                                                                                                                          |
| Test isolation from git hooks                                       | Git-using tests no longer inherit `GIT_*` variables from a hook, so a push from a linked worktree cannot corrupt the repository's config or index. See [`TESTING.md`](TESTING.md).                                                                                                        |
| Engineering foundation: rules, CI, hooks, skills, standards checker | Inherited from `8xsocial/template-web`. See [`../AGENTS.md`](../AGENTS.md) and [`STANDARDS.md`](STANDARDS.md).                                                                                                                                                                            |
| Documentation set                                                   | [`README.md`](README.md) is the index.                                                                                                                                                                                                                                                    |
| Prompting Guru (merged, #8)                                         | `/prompting-guru`: 40 challenges across five skills, stored as versioned rows in PostgreSQL and served by `/api/prompting-guru/*`, scored by rules on the server, personalized from the latest assessment; attempts and progress in PostgreSQL. See [`ARCHITECTURE.md`](ARCHITECTURE.md). |

| AI insights (`feat/grok-integration`, not merged) | Five JSON endpoints (session analysis, assessment explanation, attempt feedback and rewrite, example answers, recommendation explanation) through OpenRouter's free Nemotron by default (xAI optional), stored in `ai_insights`, tracked in `ai_usage`, shown as AI panels on the assessment, sessions and Prompting Guru pages. Verified live against OpenRouter. See [`ARCHITECTURE.md`](ARCHITECTURE.md). |
| LLM scoring (`feat/grok-integration`, not merged) | Assessments and Prompting Guru answers are scored by the LLM applying the rubric, with Dojo's arithmetic and quote checks and the rules engine as fallback; `AI_SCORING=off` for rules only. Verified live. |

## Not implemented

- Everything product-specific beyond the landing page, intake and free metrics, rules-based scoring, accounts with a saved workspace, and PDF reports of assessments, and rules-scored Prompting Guru practice (on `feat/prompting-guru-db-library`, not merged): an admin interface for editing challenges, progress and sharing, the project constitution.
- Project customisation: `package.json` is still named `template-web`, and `SITE.name` in `src/lib/seo/site.ts` is still `Web template`. The `template-setup` skill has not been run, deliberately, until the product questions in [`HANDOFF.md`](HANDOFF.md) are answered.
- A configured production URL. `NEXT_PUBLIC_APP_URL` defaults to `http://localhost:3000`.
- Automated coverage of the landing page itself. Playwright covers the smoke test, sign-in/up, the PDF route, the dashboard and the dev frontend mode (see [`TESTING.md`](TESTING.md)).

## Verified

Last full local run (Windows, LF working tree, Node 24 locally; CI uses Node 22):

| Check                                                                   | Result                                                                              |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm format:check`, `lint`, `typecheck`, `check:env`                   | pass                                                                                |
| `pnpm check:secrets`                                                    | pass                                                                                |
| `pnpm test`                                                             | 338 tests: 337 pass, 0 fail, 1 skipped (on-disk executable bit)                     |
| `pnpm build` (placeholder `DATABASE_URL`)                               | pass                                                                                |
| The real `pre-push` hook, from a plain clone and from a linked worktree | pass, and the repository's config, index and tracked files are unchanged afterwards |

**Not run locally:** Linux, `pnpm check:rls` (needs Postgres with migrations applied; CI runs it) and `pnpm test:e2e`. The CI workflow results for the published branch have not been recorded here; read them on GitHub.

**Session logger, verified live with a real agent:** Claude Code hooks fire in a real session; prompts and final answers are captured, narration, tool output and reasoning are excluded, a session keeps one file, attribution is recorded, and redaction leaves no secret. Evidence is in a local log that is not shared (see the privacy policy in [`SESSION_LOGGING.md`](SESSION_LOGGING.md)).

**Session logger, verified by automated tests only:** parsing for Claude and Codex shapes, malformed input, tool and sidechain exclusion, redaction, idempotency, session separation, attribution fallbacks and CLI exit codes (`scripts/session-log.test.mjs`).

## Pending verification

| Item                                                   | Why it is open                                                                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex hooks firing in a real Codex session             | Needs the interactive `/hooks` trust review by the developer. Manual steps are in [`SESSION_LOGGING.md`](SESSION_LOGGING.md). A Codex turn that runs tools has not been logged yet. |
| Claude hooks on the second developer's machine         | Needs their workspace-trust acceptance.                                                                                                                                             |
| Linux results for the full suite and `check:standards` | Not run on Linux locally; CI is the reference.                                                                                                                                      |

## Known limitations

See "Known limitations" in [`SESSION_LOGGING.md`](SESSION_LOGGING.md): Codex logs only the turns its hooks saw, resuming or clearing can split a conversation across files, Git Bash is needed for the Claude hook on Windows, and `github_user` can be `unknown` until `gh` or `git config github.user` is available.

## Open exposure

A personal session log was published in Git history before the local-only policy existed. The current tree no longer tracks it, but it remains in history and on `main` until the branch is merged. The history decision belongs to the repository owner and is open. See [`PUBLISHED_LOG_EXPOSURE.md`](PUBLISHED_LOG_EXPOSURE.md).

## Playwright status at hand-off

**Not verified on this branch.** A flag-on run (`DOJO_DEV_FRONTEND_MODE=true`, dev server on port 3001, 51 specs) did not complete cleanly: 26 passed, 3 skipped, 9 did not run, and several specs failed (for example `assessment-pdf`, `assessment`, `auth` wrong-password and `dashboard` fixture specs). The cause was not investigated before this hand-off, and the flag-off run and a production-build safety re-check were not run in this pass. Earlier runs of the same specs reported 48 pass and 0 fail with the flag on; treat that as unconfirmed for the final commit. Unit-test count: 338 (337 pass, 1 skipped) against 343 recorded earlier; the 5-test difference is unexplained. CI does not run the auth-backed or dashboard specs for lack of Supabase credentials and the flag.
