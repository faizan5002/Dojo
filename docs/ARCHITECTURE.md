# Architecture

How the application is put together today. The engineering rules behind these choices are in [`../AGENTS.md`](../AGENTS.md) and [`rules/`](rules); this document describes what is in the code, and flags what is present but not yet used by the product.

## Overview

Dojo is a single Next.js 16 application (App Router, Turbopack, React 19 with the React Compiler) with one public page. Most of the surrounding structure comes from the template the repository started from and is dormant: it is wired and tested, but no product feature depends on it yet.

| Concern       | Choice                                                                                                           | Where                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Framework     | Next.js `^16.3`, React `^19.2`, React Compiler with `panicThreshold: 'all_errors'` (a bailout fails the build)   | `next.config.ts`                                      |
| Styling       | Tailwind CSS v4, CSS-first; tokens in `@theme`                                                                   | `src/app/globals.css`, [`../DESIGN.md`](../DESIGN.md) |
| i18n          | `next-intl`; English only, served unprefixed (`/en` redirects to `/`)                                            | `src/i18n/`, `messages/en.json`                       |
| Data          | Prisma 6 against Postgres. The only file that touches Prisma is the client wrapper                               | `prisma/schema/`, `src/server/db/client.ts`           |
| Auth          | Supabase Auth, sessions only. Application data never goes through Supabase                                       | `src/proxy.ts`, `src/lib/supabase/`                   |
| Server state  | TanStack Query, client created inside `useState`                                                                 | `src/components/query-provider.tsx`                   |
| Errors        | `AppError` for user-caused failures, `captureError` / `captureClientError` (Sentry, optional Slack) for the rest | `src/lib/errors/`, `src/lib/observability/`           |
| Logging       | Pino structured logger with redaction, server-only                                                               | `src/server/lib/logger/`                              |
| Analytics     | PostHog through a typed event taxonomy, plus Vercel Web Analytics                                                | `src/lib/analytics/`, `src/lib/posthog/`              |
| Feature flags | Typed registry resolved through an ordered chain (DB override, DB flag, PostHog, static default)                 | `src/lib/flags/`, `prisma/schema/flags.prisma`        |
| Authorization | Admin RBAC: a seat with a role tier plus permission grants                                                       | `src/lib/rbac/`, `prisma/schema/authz.prisma`         |
| AI usage      | Wrapper and cost-tracking scaffolding. No provider SDK is installed                                              | `src/server/ai/`, `src/server/lib/ai-usage/`          |

## Request flow

```text
request
  └─ src/proxy.ts
       1. refresh the Supabase session cookie (skipped when the Supabase env vars are unset)
       2. next-intl locale routing, copying the Supabase Set-Cookie headers onto its response
  └─ App Router
       ├─ src/app/[locale]/layout.tsx   providers, site footer, JSON-LD, Vercel Analytics
       │    └─ src/app/[locale]/page.tsx   the home page
       ├─ src/app/api/health/route.ts   database health check (200 or 503)
       └─ robots.ts, sitemap.ts, llms.txt, llms-full.txt, manifest.ts, icons, opengraph-image
```

The locale layout validates the `[locale]` segment and calls `notFound()` for anything outside `routing.locales`. Unknown paths are caught by `[...rest]/page.tsx` so they render the localised 404.

## Routes

| Route                                                         | What it is                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                           | The landing page                                                                                                                                                                                                                 |
| `/sessions`                                                   | Upload, the free metrics of a saved upload, and the upload list. `noindex`, signed in. Raw files stay in the browser; the redacted sessions are saved.                                                                           |
| `/assessment`                                                 | Rubric scoring of a saved upload, and the history of saved assessments: five skills, evidence, workflow profile, recommendations. `noindex`. Scored in the browser by `src/features/assessment/`; nothing is uploaded or stored. |
| `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` | Supabase Auth pages. `noindex`.                                                                                                                                                                                                  |
| `/account`                                                    | What is stored, the user's uploads, and account deletion. `noindex`, signed in.                                                                                                                                                  |
| `/api/auth/callback`                                          | Where Supabase email links land: exchanges the code for a session.                                                                                                                                                               |
| `/api/assessments/[id]/pdf`                                   | The PDF report of one of the signed-in user's assessments: 401 signed out, 404 for anyone else's. Built in memory with `@react-pdf/renderer`.                                                                                    |
| `/analytics-demo`                                             | Template reference page for the analytics taxonomy. `noindex`. Intended to be deleted once the taxonomy is understood.                                                                                                           |
| `/api/health`                                                 | `200` when every check passes, `503` otherwise. The body names a failing check but never the reason. Checks the database.                                                                                                        |
| `/robots.txt`, `/sitemap.xml`                                 | Generated. `robots.txt` disallows everything unless the deployment is indexable.                                                                                                                                                 |
| `/llms.txt`, `/llms-full.txt`                                 | Generated from the page registry. `404` unless the deployment is indexable.                                                                                                                                                      |
| `/manifest.webmanifest`, icons, share image                   | Generated.                                                                                                                                                                                                                       |

A deployment is **indexable** only when `SITE.indexable` is true and `VERCEL_ENV` is `production` (`src/lib/seo/site.ts`), so local builds and previews are always `noindex`. `src/app/[locale]/admin/layout.tsx` defines the admin console's providers and an auth gate, but there are no admin pages yet.

## Landing page

The home page is a thin shell around a generated HTML document.

```text
src/app/[locale]/page.tsx
  ├─ <h1> and <p> (screen-reader only), from messages/en.json → HomePage
  └─ <KageLanding />                      src/features/landing/kage-landing.tsx   (client component)
       └─ <KageLandingPage />             @designcodeio/threeui
            └─ iframe → /landing-pages/kage.html      public/landing-pages/kage.html
                         └─ secret-pathways-assets/   Three.js, fonts, 14 WebP textures
```

- The visible experience (hero, Sessions, Evidence, Skills, Practice, footer) lives **inside the iframe document**. Its copy is therefore in `public/landing-pages/kage.html`, not in `messages/en.json`. The messages namespace supplies the page metadata (`meta.title`, `meta.description`) and the visually hidden `h1` and description that give the page a heading for assistive technology and crawlers.
- The package's iframe sandbox blocks top-level navigation, so a link in `kage.html` cannot leave the frame by itself. `KageLanding` follows links marked `target="_top"` from the parent page; "Why evidence matters" opens `/sessions` this way.
- `KageLanding` renders the package component in a full-height container and corrects the iframe's accessible `title`, which the package hardcodes.
- `kage.html` is **generated**, not edited by hand: `scripts/adapt-kage-landing.mjs` takes the package's `kage.html`, verifies its SHA-256, and applies exact-once replacements. The script, the hashes and the full list of changes are in [`../public/landing-pages/ADAPTATION.md`](../public/landing-pages/ADAPTATION.md).
- Everything under `public/landing-pages/secret-pathways-assets/` is copied unmodified from the package. `fonts.css` embeds fonts as base64, so it is the one file on the secret scanner's allow-list (`.secretsallow`). ESLint and Prettier both ignore `public/landing-pages/`.
- The 3D word "DOJO" is set in Onest 700 because the package's embedded display font has no `D`, `O` or `J`.

## Data and migrations

Prisma schema files under `prisma/schema/` are the only thing edited by hand; CI generates and commits the migration for a schema diff. Models today: `User` (template example), `AdminMember` and `AdminRole`, `FeatureFlag` and `FeatureFlagOverride`, `AiUsage`, and `RunOnceSql`. None holds Dojo product data yet. Every table has row-level security enabled with no policies, which `pnpm check:rls` verifies in CI. One-off SQL goes in `prisma/run-once.sql`. Full rules: [`rules/migrations.md`](rules/migrations.md), [`rules/database.md`](rules/database.md).

## Sessions and assessment

Each signed-in user has a private workspace in PostgreSQL (`prisma/schema/workspace.prisma`):
`uploads`, `agent_sessions` (the redacted conversation, JSONB), `upload_metrics`,
`assessments` and `skill_assessments`. Every table carries `user_id` and cascades from
`users`. `src/features/workspace/repository.ts` is the only code that reads or writes
them, and scopes every query to the caller's user id; it takes the Prisma client as an
argument so `repository.test.mts` runs it against a test database.

The upload path: `SessionIntake` reads and parses the chosen files in the browser,
redacts them (`src/features/workspace/redact-sessions.ts`), and sends only the redacted
sessions to `saveUploadAction`. The server validates them with Zod
(`src/features/workspace/stored.ts`), redacts again, computes the free metrics and saves
the upload, its sessions and its metrics in one transaction. `runAssessmentAction` loads
the stored sessions, scores them with the rules engine and saves a new assessment; old
ones are never rewritten. `/sessions` and `/assessment` are server-rendered from the
database. Auth is Supabase (`src/server/auth/current-user.ts`, `src/server/actions/auth.ts`,
`/api/auth/callback` for email links); `/account` has the privacy notice and deletion.

`src/features/assessment/` is the rubric engine, independent of the UI:

- `rubric.ts`: the version, the five skills and their criteria, score bands, evidence
  thresholds and the overall-score rule. Change these and bump `RUBRIC_VERSION`.
- `interactions.ts` cleans and redacts each prompt (`redact.ts`) and classifies it in
  context (task, question, follow-up, approval).
- `skills/*.ts`: one evaluator per skill. Each turns prompts into observations (a 0–1
  value plus the signals that justify it); `signals.ts` holds the shared patterns.
- `observation.ts` turns observations into a score, a confidence and quoted evidence;
  `assess.ts` aggregates, drops any quote that is not an exact slice of the prompt it
  cites, and builds the profile (`profile.ts`) and recommendations (`recommendations.ts`).

`src/features/assessment/report/` turns a saved assessment into a PDF: `report-model.ts`
builds every string and number from the stored assessment and the app's own copy (no
scoring), `report-document.ts` lays it out with `@react-pdf/renderer` (written with
`createElement`, not JSX, so `node --test` can render it), and `render-report.ts` renders
it to a buffer. `report.test.mts` reads the generated PDFs back with `pdfjs-dist`.

## Session logger

`scripts/session-log.mjs` is invoked by Claude Code (`.claude/settings.json`) and Codex (`.codex/hooks.json`) hooks. It writes one markdown digest per session to `.claude-logs/`, keeping prompts and final answers and dropping tool calls, reasoning and injected context, and redacts credentials with the same scanner CI uses. It is local tooling and is not part of the web application. Details, limits and the commit policy: [`SESSION_LOGGING.md`](SESSION_LOGGING.md).

## Security headers

`next.config.ts` sends HSTS, a CSP that only restricts framing, `<base>` and plugins, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff` and a strict referrer policy on every route, and adds `X-Robots-Tag: noindex` on the `*.vercel.app` host.

## Deployment shape

GitHub Actions runs CI and applies migrations; Vercel hosts the app. Nothing is deployed by hand. See [`CI_CD_SETUP.md`](CI_CD_SETUP.md) and [`rules/deployment.md`](rules/deployment.md).
