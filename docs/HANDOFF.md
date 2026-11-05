# Handoff

The live baton between the two developers (and their agents). Overwrite the
sections below when you stop; keep it current rather than adding history
(history is `git log` and `docs/DECISIONS.md`). Read `AGENTS.md` and
`docs/DEVELOPMENT_WORKFLOW.md` first, and inspect `git status` / `git log` before
trusting anything here.

## Last updated

2026-11-01, by a Claude Code session run from one developer account (deliberately not
named here). The repo owner and author of the existing commits is `faizan5002`. The
second developer's identity is deliberately not recorded; add it here when known.

## Git state at handoff

- The work is **published** on `chore/phase-0-agent-setup` at
  `https://github.com/faizan5002/Dojo.git`. `main` and `origin/main` are still at
  `2f2f925`; the branch has not been merged. Read the current head with
  `git log --oneline main..origin/chore/phase-0-agent-setup`.
- The branch contains the session-logging commit (`af75f14`), the planning documents
  (`b43194a`), the Dojo landing page (`e822bca`) and the commits that make the checks
  pass on Windows (`7b72307`, `f2147ce`, `8773870`, `42f8b8a`). `git log` is
  authoritative.
- The historical session log's deletion from tracking is part of `af75f14`; the log
  stays in earlier history (`docs/PUBLISHED_LOG_EXPOSURE.md`).
- Per `AGENTS.md`, land changes through a branch and PR, not directly on `main`.
- Not committed anywhere: `.impeccable/` (untracked, decision pending, item 19) and
  local session logs (gitignored).

## In progress / claimed

Add rows as `path or area — branch — who`.

| Area                                                                                                                                                | Branch                  | Who                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------- |
| AI insights (OpenRouter, xAI optional): `src/server/ai/`, `src/features/ai-insights/`, the AI insight endpoints, `prisma/schema/ai-insights.prisma` | `feat/grok-integration` | Developer 1's session |

## Exact remaining actions

**Developer 1 (whoever holds the working tree):**

1. Open the pull request from `chore/phase-0-agent-setup` to `main` (write the
   description last; a `## Production Watch List` is required, and a
   `## Screenshots` section because the PR changes what people see) and watch CI
   to green. This is the first CI run on Linux for the logger tests and the
   standards checks. Fix anything it shows; do not weaken a check.
2. Do the Codex manual verification in `docs/SESSION_LOGGING.md` and record the
   result in `docs/STATUS.md`.

**Developer 2:**

1. `git pull` the branch, `pnpm install`, `cp .env.example .env.local`
   (`docs/DEVELOPMENT.md`).
2. Do the Claude **and** Codex manual verification in `docs/SESSION_LOGGING.md`
   (Claude: accept workspace trust; Codex: `/hooks` trust). Record the result.
3. If you installed the guide's `~/.claude/extract-log.py` hooks, remove them.
4. Set `git config --global github.user <login>` if your logs say
   `github_user: unknown`.

**Both:** answer "Decisions needed" below, then run `template-setup` once on a branch
to rename the project (`package.json`, `SITE.name`).

## Decisions needed (both developers)

Items 1 and 3 were raised before the landing page existed. A landing page has since
been built (`docs/DECISIONS.md`, 2026-11-01), so the parts of them about its copy and
assets are answered in practice; the product questions behind them are still open.

1. Is the supplied landing page the real positioning for Dojo, or a placeholder?
   (It describes a generic AI platform with enterprise claims.)
2. User accounts at launch (keep Supabase Auth) or landing page only (remove it,
   `docs/rules/auth.md`)? Internal- or external-facing (`SITE.indexable`)? AI
   provider calls now? Icon provider (default Phosphor)? Project name?
3. Landing page: the questions in `docs/INITIAL_PRODUCT_SPEC_AUDIT.md` §9 and §9b —
   placeholder trust claims and third-party logos, accessibility vs one
   non-scrolling viewport, title vs H1, who supplies `logo.webp`,
   `GeistPixel-Circle.woff2` and a reference screenshot, font/video licences.
4. Branch protection on `main` (none today) and the setup in
   `docs/CI_CD_SETUP.md` (`MIGRATIONS_TOKEN`/App, `production-database`, Vercel).
5. Remove the unused `.codex-logs/` scaffolding from the template (supported by
   `check:standards` as a Claude-only layout), or leave it?
6. `/cicd` says "never `--draft` unless asked"; `docs/rules/pull-requests.md` says
   open as draft if the PR must exist early. Which wins?

Added by the Phase 1A shaping (`docs/FIRST_PUBLIC_EXPERIENCE.md`, section 10 has
the options and recommendations; none of these is decided):

7. First release scope. The requester chose "landing page + working app"; that needs
   accounts, storage, a privacy model and probably a provider decided first. Accept
   the sliced plan (landing + logger page, then invite-only upload, then review), or
   not? (D-SCOPE)
8. Audience and indexing: invited external developers (stated). `SITE.indexable`
   `false` until copy and privacy text are final? Invite mechanism? (D-AUDIENCE)
9. How do users provide session digests, and where are they processed and stored,
   for how long, and by whom? (D-INTAKE, D-PROCESS/STORE)
10. Which AI provider(s), if any, receive session data, and on what terms? (D-PROVIDER)
11. What can users delete, export or inspect? This becomes a public promise.
    (D-CONTROL)
12. The logger a visitor installs must not commit prompts to their repos by default.
    Gitignored, user-level, or opt-in? How is the logger distributed and licensed?
    (D-LOG, D-FIRSTACTION)
13. Is the generic AI-platform copy from the original spec discarded, and is the
    hero-only full viewport (instead of a strictly non-scrolling page) acceptable?
    (D-POSITION, D-VIEWPORT)
14. Impeccable hook: leave it to the plugin (recommended), or install Codex/Cursor
    manifests, which could collide with `.codex/hooks.json`? Commit
    `.impeccable/config.json` or keep it local? (If committed it fails
    `format:check`: the tool writes 2-space JSON, the repo's Prettier wants tabs;
    it would need a `.prettierignore` line.)

Added by Phase 1B (`docs/PRODUCT_DECISIONS_REVIEW.md`; options and recommendations
are there, none is decided):

15. Existing exposure: a personal email address is in the published session log and in
    one public commit's author metadata. Do nothing, fix going forward only (noreply
    address on both machines, GitHub email-privacy settings), blank it in a new
    commit, or rewrite history and force-push (destructive; owner-only)?
16. Internal session logs on a public repo: stop committing them (gitignore plus a
    private archive), make the repo private, or keep committing after a human skim?
    Also: drop `git_email` from logs, scrub account names from paths, add a way to
    disable logging for a sensitive session, and set a retention period.
17. Product digests: approve the stricter handling in section 3 (pseudonymous id, local
    preview with user review, client-side redaction, retention in days, deletion), and
    accept that the current redactor misses emails, paths, hosts, prose passwords and
    source code, so it cannot back any "safe" claim.
18. Hallmark skill (installed globally, implicit invocation on): keep it unused until
    one design pipeline is chosen (Impeccable is wired to `PRODUCT.md`), or remove it?
19. Impeccable files: approve `.impeccable/` in `.prettierignore` and the local-config
    and cache files in `.gitignore`, and committing `.impeccable/config.json`.
20. Both developers set `git config user.email` to their GitHub no-reply address.

Added by Phase 1C. The owner approved: session logs are local-only and gitignored, never
staged or committed automatically (`docs/DECISIONS.md`). That resolves the "stop
committing them" part of item 16; its other parts (drop `git_email`, scrub paths, a
disable switch, retention) are still open.

21. **Blocks the setup PR.** The template's `session-logs-tracked` standard fails under the
    policy: `scripts/check-standards.mjs` (the `session-logs-tracked` entry, about line 635) reports a gitignored log directory as a problem, and `scripts/check-standards.test.mjs`
    copies the real `.gitignore` into its fixtures (several tests, including "the template
    itself meets every standard", then fail on Linux CI; on Windows they already fail for
    other reasons). Proposed patch, **not applied**: invert the ignore test (require that
    each present log directory _is_ ignored), keep the Prettier-ignore and `.gitkeep`
    requirements, flip the two tests that assert the old behaviour (the "gitignored" one
    becomes "fails when NOT gitignored"), and reword the `docs/STANDARDS.md` row. Approve
    the patch, or reject it and choose another way to reconcile the standard.
22. The one historical log is still tracked. Leave it (history untouched, file stays in
    the tree and on the public site), or stop tracking it with `git rm --cached` in a
    normal commit (removes it from the current tree only; history keeps it; the local copy
    is preserved)? Neither removes it from history.
23. Published-log exposure: choose among doing nothing, going-forward config only, a
    deletion commit, a history rewrite, or recreating the repository
    (`docs/PUBLISHED_LOG_EXPOSURE.md`, section 6). Owner decision.
24. (Superseded by Phase 1D: sharing is prohibited until an approval process exists.)
    Where would reviewed, sanitized example logs live (for example `docs/examples/`), and
    who approves a share?

Phase 1D (owner-approved and applied; nothing committed):

- Items 21 and 22 are **resolved**: the `session-logs-tracked` standard was rewritten to
  enforce local-only logs, and the historical log was untracked with `git rm --cached`
  (staged deletion). Item 24 is **superseded**: sharing any log, even sanitized, is
  prohibited until an approval process is documented.
- Still open for the repository owner (item 23): the history decision. The exposure is
  **not** resolved: the log stays reachable in commit `2f2f925` and on public `main` until the
  deletion is merged; copies may exist (`docs/PUBLISHED_LOG_EXPOSURE.md`, section 0).
- 25. If sharing logs is ever wanted, the owner documents the approval process first
      (who approves, where reviewed examples live, required review). Until then, no sharing.

## How to run and test

```bash
pnpm install
cp .env.example .env.local
pnpm dev
pnpm lint && pnpm typecheck && pnpm check:secrets && pnpm test
node --test scripts/session-log.test.mjs     # just the logger tests
```

## Gotchas

- Windows: line endings are LF (`.gitattributes`), and the checks that depend on an
  executable bit are skipped there; see `docs/DEVELOPMENT.md` ("Windows notes").
  Linux CI is the reference.
- A push from a linked worktree exports `GIT_DIR` to the hooks. Tests that use git
  on a temporary repository must use `scripts/test-git-env.mjs` (`docs/TESTING.md`).
- Pre-commit scans staged files for secrets; commit messages must be Conventional
  Commits with a `Changelog:` line. `pre-push` runs format, lint, typecheck, env and
  the tests; never bypass it.
- `agent-session-logs-setup.md` is the original spec and is Prettier-ignored.
- This machine's Codex: `~/.codex/config.toml` selects a model the account rejects
  and its Windows sandbox is half-provisioned (`codex doctor`); fix those before
  testing Codex here.
