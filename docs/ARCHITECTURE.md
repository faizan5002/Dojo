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

| Route                                       | What it is                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/`                                         | The landing page                                                                                                          |
| `/sessions`                                 | Session log intake and free metrics. `noindex`. Files are read in the browser; nothing is uploaded or stored.             |
| `/analytics-demo`                           | Template reference page for the analytics taxonomy. `noindex`. Intended to be deleted once the taxonomy is understood.    |
| `/api/health`                               | `200` when every check passes, `503` otherwise. The body names a failing check but never the reason. Checks the database. |
| `/robots.txt`, `/sitemap.xml`               | Generated. `robots.txt` disallows everything unless the deployment is indexable.                                          |
| `/llms.txt`, `/llms-full.txt`               | Generated from the page registry. `404` unless the deployment is indexable.                                               |
| `/manifest.webmanifest`, icons, share image | Generated.                                                                                                                |

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
- `KageLanding` renders the package component in a full-height container and corrects the iframe's accessible `title`, which the package hardcodes.
- `kage.html` is **generated**, not edited by hand: `scripts/adapt-kage-landing.mjs` takes the package's `kage.html`, verifies its SHA-256, and applies exact-once replacements. The script, the hashes and the full list of changes are in [`../public/landing-pages/ADAPTATION.md`](../public/landing-pages/ADAPTATION.md).
- Everything under `public/landing-pages/secret-pathways-assets/` is copied unmodified from the package. `fonts.css` embeds fonts as base64, so it is the one file on the secret scanner's allow-list (`.secretsallow`). ESLint and Prettier both ignore `public/landing-pages/`.
- The 3D word "DOJO" is set in Onest 700 because the package's embedded display font has no `D`, `O` or `J`.

## Data and migrations

Prisma schema files under `prisma/schema/` are the only thing edited by hand; CI generates and commits the migration for a schema diff. Models today: `User` (template example), `AdminMember` and `AdminRole`, `FeatureFlag` and `FeatureFlagOverride`, `AiUsage`, and `RunOnceSql`. None holds Dojo product data yet. Every table has row-level security enabled with no policies, which `pnpm check:rls` verifies in CI. One-off SQL goes in `prisma/run-once.sql`. Full rules: [`rules/migrations.md`](rules/migrations.md), [`rules/database.md`](rules/database.md).

## Session logger

`scripts/session-log.mjs` is invoked by Claude Code (`.claude/settings.json`) and Codex (`.codex/hooks.json`) hooks. It writes one markdown digest per session to `.claude-logs/`, keeping prompts and final answers and dropping tool calls, reasoning and injected context, and redacts credentials with the same scanner CI uses. It is local tooling and is not part of the web application. Details, limits and the privacy policy: [`SESSION_LOGGING.md`](SESSION_LOGGING.md).

## Security headers

`next.config.ts` sends HSTS, a CSP that only restricts framing, `<base>` and plugins, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff` and a strict referrer policy on every route, and adds `X-Robots-Tag: noindex` on the `*.vercel.app` host.

## Deployment shape

GitHub Actions runs CI and applies migrations; Vercel hosts the app. Nothing is deployed by hand. See [`CI_CD_SETUP.md`](CI_CD_SETUP.md) and [`rules/deployment.md`](rules/deployment.md).
