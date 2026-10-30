# Development workflow — two developers, two agents

Applies to both developers and to whichever agent they use (Claude Code or
Codex). The agent rules in `AGENTS.md` still govern commits, PRs and CI; this
file is only about not stepping on each other.

## Before you change anything (agents: mandatory)

1. Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/STATUS.md`, `docs/HANDOFF.md`.
2. **Inspect the git state — never assume the other developer has not made
   changes.**

   ```bash
   git status
   git branch --show-current
   git fetch origin && git log --oneline -10 origin/main
   git log --oneline -10
   git diff HEAD..origin/main --stat      # what you would pull in
   ```

3. If `origin/main` or your branch has moved, read what changed before you
   rebase or merge. Pull before starting new work.
4. Check `docs/HANDOFF.md` ("In progress") for who owns which files.

## Branching

- `main` is shared and is where releases come from. It has **no branch
  protection** (verified via the GitHub API on 2026-10-30), so the rules below are
  discipline, not enforcement: nobody pushes a red `main`.
- Work lands through a **branch and a PR** (`feat/…`, `fix/…`, `docs/…`), as
  `AGENTS.md` ("PR workflow") requires — agents open and push these PRs. Do not
  push straight to `main`, including for docs.
- One branch, one owner. Don't commit to the other developer's branch without
  asking.

## Avoiding simultaneous edits

- Claim files/areas in `docs/HANDOFF.md` under "In progress" before starting
  (path + branch + who). Remove the claim when the PR merges.
- Shared hotspots — `package.json`, `pnpm-lock.yaml`, `messages/en.json`,
  `src/app/globals.css`, `prisma/schema/*`, `AGENTS.md`, `docs/STATUS.md` — get
  small, quick PRs; tell the other developer before you start.
- Never overwrite another developer's uncommitted work. If `git status` shows
  changes you did not make, stop and ask.

## Git safety

- **Never force-push a shared branch.** (`--force-with-lease` on your own
  private feature branch is fine.)
- Rebase only your own unpushed commits; otherwise merge. Look at the
  upstream diff first.
- Focused, descriptive commits in Conventional Commit format with a
  `Changelog:` line (`docs/rules/commits.md`). Don't commit once per fix.
- No `--no-verify` except for a check that can only run in CI.

## Before you push

1. Run `/local-review` (or: `pnpm lint`, `typecheck`, `format:check`,
   `check:env`, `check:secrets`, `check:standards`, `test`, then `pnpm build`;
   `check:rls` needs a local Postgres). CI confirms; it is not your dev loop.
2. One feature commit (plus at most one consolidated fix), Conventional Commits,
   with a `Changelog:` line (`docs/rules/commits.md`). The `pre-commit` hook scans
   staged files for secrets; never `--no-verify` it.
3. Do **not** stage or commit session logs: `.claude-logs/` and `.codex-logs/` are
   local-only and gitignored (`docs/SESSION_LOGGING.md`). If `git status` shows one,
   stop. Sharing a log, even a sanitized example, is prohibited until the owner
   documents an approval process; redaction does not guarantee privacy.
4. Update `docs/STATUS.md` and `docs/HANDOFF.md` if state changed.
5. Write the PR title/description last (`docs/rules/pull-requests.md`); open it
   as a draft only if it must exist early. `/cicd` (`.claude/commands/cicd.md`,
   mirrored for Codex in `.codex/commands/cicd.md`) is the full path: it requires
   a `## Production Watch List` in every PR body and `## Screenshots` for UI
   changes, and it forbids `git reset --hard` and reading `.env*` values. (Its
   "never `--draft` unless asked" line differs slightly from the PR rule above;
   when they disagree, ask the developer.)
6. Wait for green CI before merging; never `--auto`/`--admin`
   (`AGENTS.md`, "Merging").

## Handing work to the other developer

Whether they use Claude Code or Codex, the handoff is the same files:

1. Commit (or stash with a name, and say so) — leave no unexplained dirty tree.
2. Fill in `docs/HANDOFF.md`: branch, what's done, what's next, how to run it,
   gotchas, decisions needed.
3. Update `docs/STATUS.md` and add anything non-obvious to `docs/DECISIONS.md`.
4. Push the branch (without force) and tell the other developer.

The receiving agent starts from "Before you change anything" above; nothing
needs to be explained in chat.

## Session logs

Automatic; see `docs/SESSION_LOGGING.md`. Each developer's Codex needs a
one-time `/hooks` trust review on their own machine.
