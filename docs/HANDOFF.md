# Handoff

The live baton between the two developers (and their agents). Overwrite the
sections below when you stop; keep it current rather than adding history
(history is `git log` and `docs/DECISIONS.md`). Read `AGENTS.md` and
`docs/DEVELOPMENT_WORKFLOW.md` first, and inspect `git status` / `git log` before
trusting anything here.

## Last updated

2026-10-30, Phase 1F.1 (git state corrected after the commits were made), by a Claude Code session, run from one
developer account (deliberately not named here). The repo owner and author of the existing commits is
`faizan5002`. The second developer's identity is deliberately not recorded; add it
here when known.

## Git state at handoff

- **Current state (Phase 1F.1).** Branch `chore/phase-0-agent-setup`, created from
  `2f2f925`, with exactly two commits, both **local and unpushed**: commit 1 is `af75f14`
  (`chore(logging): add local-only session logging for agents`); commit 2 is the docs commit
  (`docs: add project context, workflow and planning documents`), whose SHA is not recorded
  here because it is the commit containing this file; read it with
  `git log --oneline main..chore/phase-0-agent-setup`. `main` and `origin/main` are
  still at `2f2f925`. **Linux verification, the pre-push hook, the push, the PR and CI have
  not happened**; nothing outstanding has passed. `.impeccable/` is not in either commit.
- The lists below summarise what the two commits contain; they are not exhaustive (17 tracked
  files were modified), so `git show --stat` is authoritative. The historical log's deletion from
  tracking (`git rm --cached`, Phase 1D) is part of commit 1; the local file is untouched.
- New: `scripts/session-log.mjs`, `scripts/session-log.test.mjs`,
  `.claude/settings.json`, `.codex/hooks.json`, `docs/{SESSION_LOGGING,
PROJECT_CONTEXT,DEVELOPMENT_WORKFLOW,STATUS,DECISIONS,HANDOFF,
INITIAL_PRODUCT_SPEC_AUDIT}.md`. This session's own log
  (`.claude-logs/…416301eb….md`) is local-only and gitignored; it is not part of the PR.
- Modified: `AGENTS.md`, `CLAUDE.md`, `docs/rules/secrets.md`, `.prettierignore`.
- `pnpm install` was run (it points `core.hooksPath` at `.githooks`, so the secret
  scan runs on commit).
- Per `AGENTS.md`, land this through a branch and PR (suggest
  `chore/phase-0-agent-setup`), not directly on `main`. Suggested commits: one for
  code/config/docs. Do not stage `.claude-logs/`: session logs are local-only (Phase 1C).

## In progress / claimed

Nobody has claimed anything. Add rows as `path or area — branch — who`.

| Area | Branch | Who |
| ---- | ------ | --- |
| —    | —      | —   |

## Exact remaining actions

**Developer 1 (whoever holds the working tree):**

1. Review `git diff` and the new files; `pnpm lint && pnpm typecheck &&
pnpm test`. On Windows expect the known failures in `docs/STATUS.md`; set
   `git config core.autocrlf input` first to remove the CRLF ones.
2. (Done locally: the branch and the two Conventional Commits with `Changelog:` lines
   exist, unpushed.) Move the branch to Linux/WSL, re-run `/local-review` there, push
   (the pre-push hook runs; logs stay local), open the PR (description last; a
   `## Production Watch List` is required).
3. Watch CI to green on Linux — this is the first Linux evidence for the logger
   tests and the standards checks. Fix anything it shows; do not weaken a check.
4. Do the Codex manual verification in `docs/SESSION_LOGGING.md` and record the
   result in `docs/STATUS.md`.

**Developer 2:**

1. `git pull` the branch/main, `pnpm install`, `cp .env.example .env.local`.
2. Do the Claude **and** Codex manual verification in `docs/SESSION_LOGGING.md`
   (Claude: accept workspace trust; Codex: `/hooks` trust). Record the result.
3. If you installed the guide's `~/.claude/extract-log.py` hooks, remove them.
4. Set `git config --global github.user <login>` if your logs say
   `github_user: unknown`.

**Both:** answer "Decisions needed", then run `template-setup` once on a branch;
only then start the landing page.

## Decisions needed (both developers)

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

## Moving this work to Linux for the first push (rehearsed on a Windows host, not on Linux)

The pre-push hook (`format:check`, `lint`, `typecheck`, `check:env`, `test`; `check:events` is
not defined here, so it is skipped) cannot pass on Windows, and `--no-verify` is not allowed. Push
from Linux or WSL (`wsl --install -d Ubuntu` is a human step; no distro is installed here).
A fresh clone plus copied files does **not** carry the index, so use one of these:

**A. Carry commits (cleanest; the two commits now exist locally).** They were made on Windows
(`pre-commit` and `commit-msg` ran there). Run
`git bundle create setup.bundle chore/phase-0-agent-setup` (a full-history bundle) and clone or
fetch it on Linux. The tree and the deletion travel in the commits. Rebuild the bundle after
any amend: the old one carries the old SHA.

**B. Carry the uncommitted state (rehearsed).** On Windows, in Git Bash at the repo root:

```bash
git rev-parse HEAD > base.txt                                   # expect 2f2f925…
git diff HEAD --binary > tracked.patch                          # tracked edits + the staged deletion, LF-normalised
git ls-files -o --exclude-standard | grep -v '^\.impeccable/' > untracked.txt
tar -cf untracked.tar -T untracked.txt                          # 15 new files; .impeccable and ignored files excluded
```

On Linux/WSL, with the four files copied over:

```bash
git clone https://github.com/faizan5002/Dojo.git && cd Dojo
git checkout "$(cat ../base.txt)" && git switch -c chore/phase-0-agent-setup
git apply --index ../tracked.patch && tar -xf ../untracked.tar
corepack enable && pnpm install --frozen-lockfile              # also sets core.hooksPath=.githooks
git diff --cached --name-status | grep '^D'                     # exactly the one historical log
git ls-files .claude-logs .codex-logs                           # only the two .gitkeep files
git ls-files -o --exclude-standard | wc -l                      # 15
```

What does not transfer, on purpose: the staged-versus-unstaged split (apply stages the
tracked edits too; harmless, they are committed anyway), ignored files (local session logs,
`node_modules`), `.impeccable/`, and local git config. New files are mode 100644; the
scripts are run through `node`, and the existing `.githooks/*` stay 100755 in the index.
Then run `docs/STATUS.md`'s gate list plus `check:rls` against a throwaway Postgres
(`docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`, then
`pnpm exec prisma migrate deploy` and `DATABASE_URL=… pnpm check:rls`), commit, and
`git push` so the hook runs. If the hook fails for a real reason, fix it; do not bypass it.

## How to run and test

```bash
pnpm install
cp .env.example .env.local
pnpm dev
pnpm lint && pnpm typecheck && pnpm check:secrets && pnpm test
node --test scripts/session-log.test.mjs     # just the logger tests
```

## Gotchas

- Windows: `pnpm format:check` and 18 tests fail on an untouched checkout; the
  causes are CRLF, no exec bit, `.bin` shims and an alias — not regressions
  (`docs/STATUS.md`). Linux CI is the reference.
- Pre-commit scans staged files for secrets; commit messages must be Conventional
  Commits with a `Changelog:` line.
- `agent-session-logs-setup.md` is the original spec and is Prettier-ignored.
- This machine's Codex: `~/.codex/config.toml` selects a model the account rejects
  and its Windows sandbox is half-provisioned (`codex doctor`); fix those before
  testing Codex here.
