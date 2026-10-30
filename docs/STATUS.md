# Status

Last updated: 2026-10-30, Phase 1E (final setup PR audit). Update this
whenever state changes; keep it short and factual. Who is doing what lives in
`docs/HANDOFF.md`.

## Where the project is

Setup (repo audit, agent logging, team docs) is committed locally on a feature branch,
**unpushed** (see "Git state" below). **Product implementation has not started**; the landing page is
audited, not built (`docs/INITIAL_PRODUCT_SPEC_AUDIT.md`). Setup is **not fully
complete**: the Codex live test is still unverified and Linux CI results have not
been seen.

## Git state (corrected in Phase 1F.1)

- **Branch:** `chore/phase-0-agent-setup`, created from `2f2f925`.
- **Commit 1:** `af75f14` — `chore(logging): add local-only session logging for agents`
  (26 paths, including the deletion of the historical log from the index).
- **Commit 2:** `docs: add project context, workflow and planning documents`. Its SHA is
  deliberately not written here: it is the commit that contains this file, so the SHA
  changes whenever the commit is amended and cannot be recorded inside itself. Read it
  with `git log --oneline main..chore/phase-0-agent-setup`.
- **Both commits are local and unpushed.** The branch is exactly two commits ahead of
  `main`. `main` and `origin/main` are still at `2f2f925`.
- **Has not happened yet:** Linux verification, the pre-push hook, pushing, opening the PR,
  and CI. None of them has passed, because none has run. The only runs so far are the
  Windows ones listed below, which are not Linux evidence.
- `.impeccable/` is excluded from both commits and remains untracked, as are the local
  session logs (ignored).
- The commits use the author's GitHub no-reply address, not a personal one.
- Headings below that say "uncommitted" or "nothing committed or pushed" describe the state
  at the time they were written; the list above is the current state.

## Phase 1E: final setup-PR audit (written before the commits were made; nothing was committed or pushed then)

Scope is frozen to the setup work; `.impeccable/` is excluded and untouched. The audit found
and fixed one blocking problem: `scripts/session-log.test.mjs` held two literal fake values that
the repo's own secret scanner flags, which would have failed the pre-commit hook and CI's
`check:secrets` as soon as the file was tracked (it passed before only because the file was
untracked). They are now assembled at runtime. Also fixed: ragged paragraph wrapping in five
instruction files, one path reference, a stale header here, and a developer GitHub handle that
had been written into two docs (a public repo would have kept it permanently).

Final matrix (this Windows machine, CRLF working tree; **Linux not run**):

| Check                                                                                                            | Result                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm lint`, `typecheck`, `check:env` (14 vars), `check:secrets`, `check:template`, `check:ai-models` (6 models) | exit 0                                                                             |
| `pnpm build` (placeholder env)                                                                                   | exit 0                                                                             |
| Logger tests                                                                                                     | 31/31                                                                              |
| `pnpm test` (full)                                                                                               | 219 tests, 201 pass, 18 fail; the same 18 as an untouched checkout, **0 new**      |
| `check-standards.test.mjs` alone                                                                                 | 46 tests, 29 pass, 17 fail (all in the 18 baseline)                                |
| `pnpm check:standards`                                                                                           | 17/24; the 7 failures are Windows-only; `session-logs-tracked` passes              |
| `pnpm format:check` (plain)                                                                                      | exit 1, 183 files: `core.autocrlf=true` CRLF working copies                        |
| `prettier --check --end-of-line auto .`                                                                          | exit 1, only the two `.impeccable/*.json` files (decision pending, not in this PR) |
| `pnpm check:rls`                                                                                                 | exit 1: no `DATABASE_URL`/Postgres here; **requires PostgreSQL**, runs in CI       |

A rehearsal of the Linux transfer (patch + tarball replayed into a fresh LF clone on this host) reproduced all 32 in-scope files byte-for-byte, the staged deletion and both `.gitkeep`s, and there `format:check` and `check:secrets` exit 0, `session-logs-tracked` passes, logger tests are 31/31 and the full suite is 219 tests with 11 failures (the Windows-only exec-bit, `.bin` shim and `@/` alias ones). That is not Linux evidence. The transfer procedure is in `docs/HANDOFF.md`.

## Phase 1D: standard aligned, historical log untracked (applied, uncommitted)

Owner-approved and applied in the working tree and index (nothing committed or pushed):

- **Standard.** `session-logs-tracked` now enforces local-only logs: both log directories
  gitignored (also when absent), no actual log tracked (`.gitkeep` allowed), Prettier
  ignore kept for directories that exist, neither directory required. Id unchanged.
  Seven `session-logs` tests pass in an LF checkout; five new/changed tests cover the new
  rules.
- **Historical log.** `git rm --cached` on that one path: a staged deletion in this
  clone's index. The local file is byte-identical (same SHA-256). `.gitkeep` files are
  still tracked. History is not rewritten (HEAD `2f2f925`, 2 commits).
- **Sharing.** Prohibited until an approval process is documented (supersedes the Phase 1C
  "approved sanitized example" wording, changed in every instruction file).
- **Result here (Windows, CRLF).** `check:standards` 17/24 (the 7 Windows failures; `session-logs-tracked` passes).
  Full suite 219 tests, 201 pass, 18 fail = the same 18 as an untouched checkout, **no new failures**.
  Logger tests 31/31. Not verified on Linux.
- **Not resolved.** The log is still reachable on public `main` until a commit with the
  deletion is merged, and in history permanently (`docs/PUBLISHED_LOG_EXPOSURE.md`, section 0).

## Phase 1C: log privacy remediation (applied, uncommitted)

The owner-approved policy is implemented: `.claude-logs/` and `.codex-logs/` are
gitignored (root and nested), no instruction in the repo tells anyone to stage or commit
them, and a test guards both. Logger capture is unchanged. **One blocker (resolved in Phase 1D, above):**
`pnpm check:standards`' `session-logs-tracked` standard contradicts the policy and fails;
the proposed patch awaits approval (`docs/HANDOFF.md` item 21). Measured on Windows: logger tests 31/31; full suite 216 tests, 197 pass, 19 fail = the 18 known Windows failures plus one new `check-standards` test ("session-logs-tracked passes a Claude-only repo…") that fails because of this conflict. `check:standards` is now 16/24 (was 17/24); the extra failure is `session-logs-tracked`. On Linux CI the same conflict would also fail the "template itself meets every standard" family of tests. Historical history is
untouched; see `docs/PUBLISHED_LOG_EXPOSURE.md`.

## Implemented

- Template rules, CI, hooks and skills (`AGENTS.md`, `docs/rules/`, `.github/`,
  `.githooks/`, `.claude/skills/`).
- Session logging for Claude Code and Codex into `.claude-logs/`
  (`scripts/session-log.mjs`, `.claude/settings.json`, `.codex/hooks.json`,
  `docs/SESSION_LOGGING.md`) with redaction and 31 tests.
- Team docs and the "Before you start" block in `AGENTS.md`.

## Not implemented

Everything product-specific. The repo is still the template: `package.json` name
`template-web`, template home page and copy, `template-setup` not run.

## Verified live (a real agent, real hooks)

| Claim                                            | Evidence                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Claude Code project hooks fire in a real session | `.claude-logs/2026-10-30_09-19-22_416301eb-06e8-41c8-8932-890290641c95.md`, written by the hooks (not by hand)                |
| `UserPromptSubmit` captured the prompt           | PROMPT 1 and PROMPT 2 entries (the latter appeared at its own `generated_at`, 10:20:31Z)                                      |
| `Stop` captured the final answer                 | RESPONSE 1, 8,478 chars, timestamp 09:45:18Z — the report only                                                                |
| Narration between tool calls excluded            | 5 distinctive mid-turn narration lines: 0 occurrences in the file                                                             |
| No tool output / reasoning leaked                | 6 distinctive tool-result strings (pnpm progress, module errors, Codex errors): 0 occurrences                                 |
| Same session file updated, no duplicates         | one file for the session across several hook runs; `total_exchanges: 2` after the second prompt                               |
| Attribution                                      | `author`/`git_email` from git, `github_user` = the developer login (it was `unknown` on the first hook run — see limitations) |
| Redaction still clean                            | `node scripts/check-secrets.mjs <log>` prints nothing; `redactions: 0` (nothing to redact in that session)                    |

## Verified by fixtures / automated tests only

- `node --test scripts/session-log.test.mjs`: 31/31 — parsing (Claude and Codex
  shapes, malformed lines, `.jsonl.zst`), tool/sidechain/reasoning exclusion,
  redaction, idempotency, session separation, attribution fallbacks, repeated
  prompts, multiple Codex stops, env isolation, CLI exit codes.
- Mutation checks: four deliberate breakages of the logger (narration treated as
  final, scanner pass removed, repeat-prompt rule, latest-stop rule) each made
  exactly one test fail.
- The Codex hook command string, run through a child PowerShell with piped stdin
  from a subfolder, with synthetic payloads: log written at the git root, `{}`
  printed on `Stop`.
- Claude hook run manually against this session's real transcript in a temp repo.

## Pending live verification (NOT VERIFIED)

| Item                                                                             | Why it is open                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Codex hooks firing in a real Codex session                                       | Needs the interactive `/hooks` trust review by the developer. A real `codex exec` run **without** any bypass completed a model turn but wrote no log (hooks untrusted, as documented); tool execution also failed in this machine's Windows sandbox (`CreateProcessWithLogonW failed: 267`) and the configured model `gpt-6.1-sol` is rejected for the account (ran with `-m gpt-5.6-luna`). Manual steps: `docs/SESSION_LOGGING.md` |
| Codex tool-execution turn logged correctly                                       | Same; not exercised because tools could not run                                                                                                                                                                                                                                                                                                                                                                                      |
| Linux results for the full suite, `check:standards`, `format:check`, `check:rls` | Docker Desktop's engine would not start on this machine (`docker desktop start` did nothing), no WSL distro, no local Postgres. Reproducible commands below                                                                                                                                                                                                                                                                          |
| `check:rls`                                                                      | Needs a Postgres with migrations applied; CI runs it                                                                                                                                                                                                                                                                                                                                                                                 |
| Claude hooks on the second developer's machine                                   | Needs their workspace-trust acceptance                                                                                                                                                                                                                                                                                                                                                                                               |

## Cross-platform results (this Windows machine; Linux not run)

| Check                                                                     | Result                       | Cause of failures                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`, `typecheck`, `check:env`, `check:secrets`, `check:ai-models` | pass                         | —                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm build` (placeholder env, as CI)                                     | pass, exit 0                 | — (run before the Phase 0.5 changes, which touched no `src/`)                                                                                                                                                                                                                                                                                       |
| `pnpm format:check` in the working tree                                   | fails 191 files              | `core.autocrlf=true` leaves CRLF; **passes** in a fresh `core.autocrlf=false` clone with my changes overlaid                                                                                                                                                                                                                                        |
| `pnpm test`, untouched `main`                                             | 185 tests, 18 fail           | see below                                                                                                                                                                                                                                                                                                                                           |
| `pnpm test`, working tree (measured at 27 logger tests; now 28)           | 212 tests, 18 fail (same 18) | my 27 tests all pass                                                                                                                                                                                                                                                                                                                                |
| `pnpm test`, LF clone + my changes                                        | 212 tests, **11 fail**       | 7 of the 18 were CRLF-only                                                                                                                                                                                                                                                                                                                          |
| `pnpm check:standards`                                                    | 17/24, in both trees         | 2 hooks "not executable" (NTFS has no exec bit; git index has 100755) and 5 checks that `spawnSync` `node_modules/.bin/eslint`/`tsc` without the Windows `.cmd` shim (ENOENT). The 11 remaining test failures are these standards tests (10) and `src/lib/seo/seo.test.mts` (the `@/` import alias fails to resolve under the TS loader on Windows) |

None of the checks was changed or weakened. To reproduce on Linux:

```bash
git clone https://github.com/faizan5002/Dojo.git && cd Dojo   # + your branch
docker run --rm -it -v "$PWD":/w -w /w node:22-bookworm bash -c \
  'corepack enable && pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && \
   pnpm format:check && pnpm check:env && pnpm check:secrets && pnpm check:standards && pnpm test'
```

## Known limitations

See `docs/SESSION_LOGGING.md` ("Known limitations"): Codex logs only hook-seen
turns, resume/clear can split a conversation across files, Git Bash is needed for
the Claude hook on Windows, `github_user` can be `unknown` until `gh` or
`git config github.user` is available.

## Blockers and decisions awaiting both developers

Listed once, in `docs/HANDOFF.md` ("Decisions needed").
