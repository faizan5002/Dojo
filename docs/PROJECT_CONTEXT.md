# Project context

Read this first in a fresh session, then `AGENTS.md`, `docs/STATUS.md` and
`docs/HANDOFF.md`. Facts here are either from the repo or from the team's
brief; anything unconfirmed is marked **open**.

## What Dojo is

Dojo is a platform that trains developers to work effectively with AI coding
agents (Claude Code, Codex). A two-person team builds it, and both use those
agents to build it. (Source: the Phase 0 brief. No product spec, user
research or roadmap is in the repo yet — **open**.)

## What exists today

- A repo created from the `8xsocial/template-web` template, **not yet
  customized**: `package.json` is still named `template-web`, the home page is
  the template's placeholder, `README.md` still describes the template.
  `template-setup` (the one-time bootstrap skill) has not been run.
- The shared engineering rules (`AGENTS.md`, `docs/rules/*`), CI, git hooks and
  agent skills that come with the template.
- Session logging for Claude Code and Codex (`docs/SESSION_LOGGING.md`): local-only,
  gitignored, never committed automatically.
- **Nothing product-specific is implemented.** No landing page, no Dojo
  features, no database models beyond the template's example.

## Architecture (the existing one — do not replace it)

| Layer           | Choice                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack, React Compiler `panicThreshold: all_errors`) + React 19                |
| Styling         | Tailwind CSS v4, CSS-first; tokens in `src/app/globals.css`; conventions in `DESIGN.md`                   |
| Data            | Prisma 6 only (`src/server/db/client.ts`); CI generates migrations from schema diffs                      |
| Auth            | Supabase Auth (auth/session only), RLS enabled with no policies; removable for a no-accounts landing page |
| Server state    | TanStack Query                                                                                            |
| i18n            | next-intl, copy in `messages/en.json`                                                                     |
| Observability   | Sentry (`captureError`), Pino (`src/server/lib/logger`), PostHog taxonomy                                 |
| Tests           | `node --test` (`scripts/*.test.mjs`, `src/**/*.test.mts`) + Playwright (`e2e/`)                           |
| Package manager | pnpm 10.6.2, Node >= 22.18                                                                                |
| Hosting/CI      | GitHub Actions (`.github/workflows/ci.yml`), Vercel; never deploy by hand                                 |

Key entry points: `src/app/[locale]/page.tsx` (home), `src/app/[locale]/layout.tsx`,
`src/proxy.ts` (session refresh + locale routing), `src/lib/env.ts` (env
schema), `src/app/globals.css` (tokens).

## Conventions that bite

The rules are in `AGENTS.md` and `docs/rules/`; read the linked file before
touching its area. The ones people trip over: Prisma only; never hand-write a
migration; icons only through `@/components/ui/icons`; adding a page means a
`PUBLIC_PAGES` entry and `meta` strings; commits are Conventional Commits with
a `Changelog:` line; **don't commit per fix — run `local-review` first**; PRs
are written last; secrets never in transcripts (`docs/rules/secrets.md`).
Next 16 differs from what you remember: read `node_modules/next/dist/docs/`
before routing/caching/data-fetching code.

## How to run and test

```bash
pnpm install                     # installs git hooks (core.hooksPath) + prisma generate
cp .env.example .env.local       # DATABASE_URL / DIRECT_URL at minimum
pnpm dev
pnpm lint && pnpm typecheck && pnpm format:check && pnpm check:env
pnpm check:secrets && pnpm check:standards && pnpm test
pnpm test:e2e                    # Playwright
```

`/local-review` runs the full gate plus a rules review before a push; `/cicd`
runs review, PR, CI watch and review comments (`.claude/commands/cicd.md`,
`.codex/commands/cicd.md`). `check:rls` needs a local Postgres.

## Where the supplied first deliverable stands

A landing-page spec (static HTML/CSS/JS, video background) was supplied as the
first proposed implementation. It has been **audited, not built**:
`docs/INITIAL_PRODUCT_SPEC_AUDIT.md`. It conflicts with the Next.js stack in
several ways and needs product decisions first.

## Open questions

See `docs/HANDOFF.md` ("Decisions needed").
