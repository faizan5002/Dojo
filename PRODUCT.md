# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Working developers who use AI coding agents (Claude Code, Codex) in their day job and want to get better at directing them. They practise in short sessions alongside real work; the job is improving how they prompt, review and steer an agent, not learning to code.

The two-person team building Dojo are also its first users: both build it with those same agents.

## Product Purpose

Dojo trains developers to work effectively with AI coding agents. Success is a developer who measurably changes how they work with an agent after using it.

## Positioning

Dojo's coaching is built on review of the learner's own agent sessions, not generic lessons. The session log digests this repo already writes to `.claude-logs/` (prompts and final answers only, secrets redacted, same format for Claude Code and Codex) are the raw material for that review. A curriculum product with no access to how a person actually works cannot truthfully make that claim.

How session data would reach Dojo (upload, local tooling, or repo access), and its privacy model, are **undecided**.

## Operating Context

- Built by two developers, each with their own agent (Claude Code or Codex), sharing one `main`; rules and handoff live in `AGENTS.md` and `docs/`.
- Learners' material is their own session logs: conversation digests with prompts and final answers, author and GitHub login, and statistics. Tool calls and results are deliberately excluded.

## Capabilities and Constraints

- Only the public landing page is built. The repo is otherwise the un-customised `template-web` (Next.js 16, React 19, Tailwind v4, Prisma, Supabase Auth, next-intl); the architecture and the rules in `AGENTS.md` and `docs/rules/` stay.
- **Undecided product facts:** whether Dojo has user accounts at launch (keep or remove Supabase Auth), internal or external facing, any AI provider calls, project name in code, and the first public surface. Recorded in `docs/HANDOFF.md`.
- A landing-page specification was supplied as a first proposal and audited in `docs/INITIAL_PRODUCT_SPEC_AUDIT.md`. It describes a generic "AI platform", not this product; whether it is the real positioning is undecided.

## Brand Commitments

The name is "Dojo". No logo, voice or identity has been decided beyond it.

## Evidence on Hand

- **None for adoption or performance.** There are no customers, case studies, testimonials, usage numbers, uptime or latency figures. Future work must not invent them, and must not use third-party company logos to imply customers (the supplied spec's "Trusted by 2000+ Enterprises", Microsoft/Amazon/Google marks and its 120 ms / 99.99 % / 2.4 M stats are unverified placeholders).
- Real material that does exist: one prior session log from the repo owner (`.claude-logs/2026-10-29_15-37-18_d2eb4960-aee9-437f-866f-e67e47fcbacb.md`) and the session logger itself.

## Product Principles

1. Coach from what the developer actually did, not from abstract advice.
2. Never claim what has not been measured or earned: no invented customers, metrics or endorsements.
3. A developer's session data is sensitive: minimise what is kept and keep secrets out by construction.
4. Work the same for Claude Code and Codex users; no single-agent assumptions.

## Accessibility & Inclusion

No product-specific requirement has been stated. The repository's baseline stands: `DESIGN.md` requires WCAG AA contrast, visible focus states, reduced-motion support and labelled controls.
