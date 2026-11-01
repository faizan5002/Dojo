# Contributing to Dojo

Dojo is built by two developers, each working with their own coding agent (Claude Code or Codex). The same rules apply to people and to agents. This page is the short version; each section links to the document that holds the detail.

## Before you start

1. Read [`AGENTS.md`](AGENTS.md), then [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md), [`docs/STATUS.md`](docs/STATUS.md) and [`docs/HANDOFF.md`](docs/HANDOFF.md).
2. Inspect the Git state before you edit: `git status`, `git fetch`, `git log origin/main`. Never assume nobody else has changed things, and never overwrite uncommitted work you did not make.
3. Check `docs/HANDOFF.md` for files another developer has claimed.
4. Set up your environment: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

For a brand-new feature, propose the smallest useful slice and let the maintainers choose scope ([`docs/rules/feature-approach.md`](docs/rules/feature-approach.md)).

## Branches and pull requests

- Never push directly to `main`. Work on a branch (`feat/...`, `fix/...`, `docs/...`, `chore/...`) and open a pull request.
- One branch has one owner. Do not commit to someone else's branch without asking.
- Never force-push a shared branch, and never rewrite published history.
- Write the pull request title and description **last**, once the work is done, so they describe what actually shipped ([`docs/rules/pull-requests.md`](docs/rules/pull-requests.md)). A PR that changes what people see includes a `## Screenshots` section with Before and After.

## Commits

- [Conventional Commits](https://www.conventionalcommits.org/), checked by the `commit-msg` hook and by CI.
- The commit that changes something for users carries a `Changelog:` line: one plain sentence on one line, or `None`.
- Do not commit after every small step. Every push to an open PR is a paid CI run, so verify locally first ([`docs/rules/commits.md`](docs/rules/commits.md)).

```text
fix(landing): keep the home page's visible copy distinct from its metadata

Changelog: None
```

## Before you push

Run the local gates. The `pre-push` hook runs the same ones, and CI repeats them:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm check:env && pnpm check:secrets && pnpm test
pnpm build
```

Agents can run `/local-review` for these plus a review against the rules. Details: [`docs/TESTING.md`](docs/TESTING.md).

- **Never** use `--no-verify`, and never `git push --force` to a shared branch.
- **Wait for green CI before merging.** Do not merge while a check is pending or failing, and do not use `gh pr merge --auto` or `--admin` to skip the wait.

## Documentation

Documentation changes follow the same flow as code. When you change behaviour, update the document that describes it in the same pull request. The index is [`docs/README.md`](docs/README.md). Verify every command, path and variable name you write against the code, and do not document planned features as if they exist. Format Markdown with `pnpm exec prettier --write <file>`.

## Things that must never be committed

- Secrets, tokens or populated `.env` files ([`docs/rules/secrets.md`](docs/rules/secrets.md)).
- Agent session logs (`.claude-logs/`, `.codex-logs/`). They are local-only and gitignored; do not stage them, force-add them or share them ([`docs/SESSION_LOGGING.md`](docs/SESSION_LOGGING.md)).

## Reporting problems

Bugs and ideas: open a GitHub issue. Security problems: follow [`SECURITY.md`](SECURITY.md) instead, and do not file them publicly.
