# Initial product spec audit — landing page

Audit of the landing-page specification handed over with the Phase 0 brief
("single-viewport, full-bleed video-background landing page… static HTML +
CSS + vanilla JS"). **Nothing here is implemented.** The spec is quoted as
given; where it cannot be met exactly, or needs a decision, it is listed under
"Needs a decision" rather than silently changed. The spec text itself was not
saved in the repo; treat the brief as the source until someone commits it.

## 1. Architecture conflict

|                  | Spec                                                         | Repo (`README.md`, `AGENTS.md`)                                                                                            |
| ---------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Stack            | `index.html` + `styles.css` + `main.js`, no framework        | Next.js 16 App Router, React 19, React Compiler, Tailwind v4                                                               |
| Styling          | Own `:root` variables in `styles.css`                        | Tokens in `src/app/globals.css` `@theme`, `DESIGN.md`, no hardcoded hex                                                    |
| Fonts            | `<link>` to Google Fonts, OnlineWebFonts, local `@font-face` | `next/font` is the idiomatic path; ESLint (`eslint-config-next`) warns on custom-font `<link>`s                            |
| Icons            | Font Awesome 6.5.2 CSS from cdnjs                            | `docs/rules/icons.md`: every icon via `@/components/ui/icons` (Phosphor); ESLint fails the build on provider imports       |
| Copy             | Hard-coded in HTML                                           | `messages/en.json` via next-intl; SEO rule needs `meta.title` 30–60 / `meta.description` 70–160 and a `PUBLIC_PAGES` entry |
| Behaviour        | Vanilla JS (`main.js`)                                       | Keep Client Components small; React Compiler `panicThreshold: 'all_errors'`                                                |
| Analytics/errors | None                                                         | PostHog taxonomy, Sentry, Pino wired in                                                                                    |

**Options**

1. **Port into Next.js (recommended).** `src/app/[locale]/page.tsx` as a Server
   Component; tokens added to `@theme` (or scoped CSS custom properties in a
   CSS module, since several values are spec-exact one-offs); two client
   islands: mobile menu (`aria-expanded`, Escape, overlay, resize) and the
   count-up (IntersectionObserver). The video, header, hero and stats are
   static markup. Fonts through `next/font/local` where files can be committed.
   Visual output stays identical; only the packaging changes. Least
   disruptive: keeps routing, i18n, SEO files, analytics, CI and the e2e
   harness working.
2. **Static files in `public/`.** Fastest literal match, but bypasses i18n,
   the SEO pipeline (`sitemap`, `llms.txt`, metadata), analytics, CSP/Sentry
   wiring and `check:standards`, and `/` is owned by the `[locale]` route
   anyway. Not recommended.
3. **Rewrite the repo as static.** Rejected: deletes working infrastructure
   the brief says to keep.

Whichever is chosen, the visuals below are the contract; the framework choice
must not change a pixel.

## 2. Exact visual requirements (as specified)

- Page: black `#000`, `overflow: hidden`, `100vh`/`100dvh`; one viewport,
  flex column: header (shrink 0), hero (flex 1, centred), stats (shrink 0).
  Padding `clamp(16px, 2.4vh, 28px) clamp(14px, 3vw, 32px)`.
- Video: full-bleed `object-fit: cover`, `autoplay muted loop playsinline`,
  `pointer-events: none`, `z-index: 0`; parent `.bg` black.
- Tokens: `--bg #000000`, `--text #fff`, `--muted #8e8e8e`, `--nav-text #2e2e2e`,
  `--pill-dark #28282a`, `--sign-in-text #c8c8c8`, `--trust-bg #28282a`,
  `--trust-border rgba(255,255,255,.4)`, `--trust-text #c4c2c3`,
  `--nav-shadow 0 4px 14px rgba(0,0,0,.16)`.
- Header (max 720px): white circular logo (`clamp(40px,4.4vw,46px)`, logo image
  at 72%), white nav pill (Home/Product/Case Studies/Contact, active = three
  3px dots), dark "Sign in" pill.
- Hero: trust row (three overlapping ringed avatars + pill "Trusted by 2000+
  Enterprises"), two-line headline "Intelligence / Designed To Evolve" in the
  dot-matrix display font, solid white, per-breakpoint tracking
  (`-0.04em` / `-0.08em` ≤720px / `-0.09em` ≤420px), subhead, white glowing
  "Get Started" pill.
- Stats: 4 columns (2×2 ≤720px): `<` 120 ms Inference Time, `%` 99.99 % Platform
  Uptime, `*` 24 /7 Autonomous Runtime, `#` 2.4 M Context Windows.
- Mobile ≤720px: nav and Sign in hidden; 48px logo + circular burger; blurred
  overlay and white sheet menu with staggered links.

## 3. Assets and external dependencies

| Item                            | Source                                                                                                    | Status                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Background video                | `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-….mp4` | Third-party URL under someone's user id; no ownership or retention guarantee. Size/duration/codec unknown.                  |
| `assets/logo.webp`              | local                                                                                                     | **Not in the repo** (`public/` has only `indexnow.txt`). Needed from the design owner.                                      |
| `fonts/GeistPixel-Circle.woff2` | local                                                                                                     | **Not in the repo.** Needed; confirm licence.                                                                               |
| BubbledotICG-FinePos            | `db.onlinewebfonts.com` stylesheet                                                                        | Third-party CSS; **licence not verified** — OnlineWebFonts hosts fonts under varying licences, some not for commercial use. |
| Inter 400/500/600               | Google Fonts                                                                                              | Fine; `next/font/google` self-hosts it.                                                                                     |
| Font Awesome 6.5.2              | cdnjs CSS (with SRI)                                                                                      | Whole icon CSS (~tens of KB + webfonts) to draw three brand glyphs.                                                         |

CSP: the repo sets none today; if one is added, `media-src`, `style-src` and
`font-src` need these hosts. Also note the SRI hash is supplied in the brief
and was not verified against the file.

## 4. Responsive behaviour

Breakpoints: ≤720px (mobile menu, 2×2 stats, tighter tracking), ≤420px (smaller
trust size, tighter tracking), height ≤700px (tighter hero spacing). Fluid
`clamp()` sizing elsewhere. Everything is clamped to one viewport with
`overflow: hidden`.

## 5. Animation requirements

Entrance: header `slideDown .7s`, `.anim` reveal (`translateY(22px) scale(.98)`

- `blur(6px)` → rest, `.85s cubic-bezier(.22,1,.36,1)`, per-element `--d`
  delays `0.05s…0.74s`), headline lines `headlineFade` (`.12s`, `.3s`), CTA
  `revealPulse`, burger/overlay/menu `overlayIn .28s` / `menuIn .38s` / `linkIn`.
  Hover: logo scale 1.04, avatars lift 2/4/2px, sign-in lift, CTA lift + glow.
  Stats count-up: easeOutCubic, `1500 + i*80` ms, start `480 + i*90` ms, once,
  IntersectionObserver threshold 0.25. `prefers-reduced-motion`: animations
  killed, final state shown. Not specified: the exact keyframes of `revealPulse`
  and `headlineFade` end states, the burger X easing, and the `linkIn` stagger.

## 6. Accessibility implications

- **Single non-scrolling viewport.** `overflow: hidden` + `100vh` clips content
  at 200 % zoom, small landscape phones, and large text settings — fails WCAG
  1.4.4 / 1.4.10 (reflow) unless the content genuinely fits. Needs a decision
  (see §9).
- **Contrast.** Nav text `#2e2e2e` at `opacity .5` on white ≈ `#979797` ≈ 2.9:1
  (below 4.5:1); inactive links are the primary navigation. Subhead `#d0d0d0` at
  0.8 opacity and `--muted #8e8e8e` sit on a moving video of unknown luminance;
  needs a measured check or a scrim. (`DESIGN.md` §4 requires AA.)
- **Moving background.** Autoplaying video longer than 5 s needs a pause control
  (WCAG 2.2.2); reduced-motion should pause or swap for a poster, not only
  stop CSS animation. No `poster` is specified.
- **Semantics.** The logo button needs an accessible name (its `alt` is empty);
  the burger needs `aria-label`, `aria-expanded`, `aria-controls`; the active
  link needs `aria-current="page"` (three dots are decorative); stat glyphs
  `< % * #` are decoration and must be `aria-hidden`; the two headline `<span>`s
  belong in one `<h1>`; count-up must not be announced digit by digit; the mobile
  menu needs focus management and Escape/overlay close (specified) plus scroll
  lock (`body.menu-open`).
- **Focus.** No `:focus-visible` styles are specified; `DESIGN.md` requires them.
- **Dot-matrix headline** at `-0.09em` tracking may be hard to read for some
  users; verify legibility at 320px.

## 7. Performance considerations

- LCP will be the headline or the video poster; with no poster, the first frame
  waits on a cross-origin MP4. Add `preload="metadata"`/poster and compress.
- Four render-blocking third-party stylesheets (Inter, OnlineWebFonts, Font
  Awesome, plus local `@font-face`); `display=swap` mitigates FOUT only.
- Animating `filter: blur()` on many elements is paint-heavy on low-end phones.
- Video autoplay on mobile data; consider not loading it ≤720px or under
  `prefers-reduced-data`.
- `100dvh` and `backdrop-filter` (menu overlay) need fallbacks on older browsers.

## 8. Browser interactions

Mobile menu (toggle, overlay click, Escape, link click, resize >720px),
IntersectionObserver count-up, hover transforms, video autoplay (requires
`muted` + `playsinline`; blocked autoplay must degrade to the black `.bg`).

## 9. Needs a decision before implementation

1. **Is this the product?** The spec markets a generic "AI platform"
   (_Intelligence Designed To Evolve_). Dojo trains developers to work with
   coding agents (`docs/PROJECT_CONTEXT.md`). Headline, subhead and CTA copy do
   not describe Dojo. Is this a placeholder shell, or the real positioning?
2. **Unverifiable claims.** "Trusted by 2000+ Enterprises" with Microsoft,
   Amazon and Google marks, and 120 ms / 99.99 % / 2.4 M stats, are not facts
   about a product that does not exist yet. Using third-party logos to imply
   customers is a trademark and misrepresentation risk. Keep as visibly
   placeholder, replace, or drop?
3. **Missing files:** `logo.webp`, `GeistPixel-Circle.woff2`; and font licences
   (BubbledotICG-FinePos, Geist Pixel, the CloudFront video).
4. **Where do the links go?** Home, Product, Case Studies, Contact, Sign in and
   Get Started have no targets. Sign in/Get Started collide with the Supabase
   auth question in §10.
5. **Single-viewport vs accessibility** (§6): accept clipping, or allow the page
   to scroll at small heights / large text while keeping the composition on
   typical desktops?
6. **Contrast fixes** that alter specified values (§6) — allowed or not?
7. **Icons:** is a documented exception to `docs/rules/icons.md` acceptable
   (Font Awesome), or should the three brand marks be Phosphor equivalents or
   inline SVG through `@/components/ui/icons`? Phosphor has no generic Microsoft
   mark — verify before choosing.
8. **No reference screenshot or design file** was provided, so "match exactly"
   cannot be verified visually. Provide one before implementation.
9. **Self-host the video and fonts?** Strongly advised if licences permit.
10. **Meta description and share image** for SEO (title "Intelligence Designed To
    Evolve" is 31 chars; the 70–160 char description is not given).

## 9b. Repo rules the spec collides with (found in the Phase 0.5 rules audit)

- **Title vs H1** (`docs/rules/seo.md`, `content.title.distinct`): `meta.title`
  must not be a copy of the page's H1. The spec makes the document title
  "Intelligence Designed To Evolve" _and_ the headline; one of them has to change.
- **Copy lives in `messages/en.json`**, not JSX, and the page must be
  server-rendered: `llms-full.txt` publishes those strings and crawlers read the
  HTML. The client-only `main.js` pattern (and any text injected by script, such
  as the stat values) conflicts; the count-up must render the final number
  server-side and animate it in a client island.
- **Images** must use `next/image` with `alt`, `priority` on the first
  (`logo.webp`); one `<h1>`; headings descend one level at a time.
- **Design tokens**: no hardcoded hex or pixel radii in component code
  (`DESIGN.md`, `docs/rules/components.md`). The spec's exact values need to
  become `@theme` tokens or scoped CSS custom properties first.
- **Client Component boundaries** stay small and the React Compiler fails the
  build on a bailout (`AGENTS.md`); `docs/rules/state-management.md` forbids a
  global store for the menu state — local `useState` is enough.
- **Process**: UI PRs need before/after screenshots under `.pr-screenshots/`,
  and `e2e-review` (`.claude/commands/cicd.md`, `docs/rules/pull-requests.md`);
  `e2e/smoke.spec.ts` must be updated if the home page changes.
- **Feature approach** (`docs/rules/feature-approach.md`): a brand-new feature
  should be offered as an 80/20 slice for the developers to choose from before
  the full spec is built.

## 10. Integration conflicts with the template (independent of the spec)

- `template-setup` has not been run (`package.json` is `template-web`); its
  accounts-vs-landing-page answer decides whether Supabase Auth is deleted
  (`docs/rules/auth.md`). That decision precedes any landing-page work.
- The current `/` is the template page; replacing it changes `HomePage` copy,
  `PUBLIC_PAGES`, the sitemap and the smoke e2e spec (`e2e/smoke.spec.ts`).
- Visual changes need a `## Screenshots` (before/after) section in the PR
  (`docs/rules/pull-requests.md`) and `e2e-review`.
