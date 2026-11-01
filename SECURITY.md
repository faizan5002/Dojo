# Security policy

## Reporting a vulnerability

Please do not open a public issue or pull request for a security problem, and do not paste credentials, tokens or session logs into one.

Report it privately to the repository owner:

1. If the repository's **Security** tab offers **Report a vulnerability**, use it. This creates a private advisory visible only to the maintainers.
2. Otherwise, contact the repository owner, [`faizan5002`](https://github.com/faizan5002), through GitHub and ask for a private channel before sharing details.

Include what you found, where (file, route or workflow), how to reproduce it, and the impact you expect. Do not test against anyone else's data or against a deployment you do not own.

There is no published response-time commitment and no bug bounty. This is an early-stage project built by two developers.

## Scope

Dojo currently ships a public landing page and developer tooling. It has no sign-in flow, no uploaded user data and no AI provider calls. The areas most likely to matter are:

- The web application in `src/` and its security headers (`next.config.ts`).
- The landing-page assets in `public/landing-pages/`, which load third-party-derived code in an iframe.
- CI workflows and Git hooks (`.github/workflows/`, `.githooks/`), including how secrets are used.
- The session logger (`scripts/session-log.mjs`), which handles prompts and answers that can contain private material.

There are no tagged releases yet; only the default branch is considered supported.

## How this repository handles secrets and sensitive data

- Credentials live in environment variables read through `src/lib/env.ts`, never in source. `.env*` files other than `.env.example` are gitignored. See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) and [`docs/rules/secrets.md`](docs/rules/secrets.md).
- A secret scanner runs on staged files in the `pre-commit` hook and again over every tracked file in CI (`pnpm check:secrets`). Passing it is a backstop, not a guarantee.
- Agent session logs (`.claude-logs/`, `.codex-logs/`) can contain private code, names and paths. They are committed to this public repository, so a pushed log is published; redaction does not make a log safe to publish, so each one is read before it is committed. See [`docs/SESSION_LOGGING.md`](docs/SESSION_LOGGING.md).
- The Supabase Data API is meant to stay off, and every table has row-level security enabled with no policies, so no anonymous or authenticated role can read a row directly. `pnpm check:rls` verifies this in CI. See [`docs/rules/auth.md`](docs/rules/auth.md).

A known past exposure of a session log in this repository's Git history is documented in [`docs/PUBLISHED_LOG_EXPOSURE.md`](docs/PUBLISHED_LOG_EXPOSURE.md).
