# First public experience — shaping brief

Output of `/impeccable shape landing` (Phase 1A). **Planning only: nothing is built,
no visual direction is chosen, no architecture is decided.** Review this, then decide
the items in section 10.

## 0. How to read this document

Every statement carries one of these labels. A recommendation never becomes a
decision by being written down here.

| Label       | Meaning                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| **PRODUCT** | Confirmed in `PRODUCT.md` (the approved product record).                                                             |
| **SHAPING** | Answered by the requester in the Phase 1A shaping round. Not yet in `PRODUCT.md`; needs owner sign-off (section 10). |
| **REPO**    | A constraint that exists in the repository today (`AGENTS.md`, `docs/rules/`, code).                                 |
| **REC**     | My recommendation. Open to rejection.                                                                                |
| **OPEN**    | Unresolved; a person must decide.                                                                                    |

Sources read: `PRODUCT.md`, `AGENTS.md`, `DESIGN.md` (the template starter, not a
brand), `docs/PROJECT_CONTEXT.md`, `docs/INITIAL_PRODUCT_SPEC_AUDIT.md`,
`docs/HANDOFF.md`, `docs/rules/{seo,auth,feature-approach,components,icons}.md`,
`docs/SESSION_LOGGING.md`, and the original landing-page specification (it exists
only in the Phase 0 brief, not in the repo; section 8 quotes what it needs to).

## 1. Starting facts

**PRODUCT**

- Platform: web.
- Users: working developers who use Claude Code / Codex and want to direct them better;
  short practice sessions alongside real work; the job is prompting, reviewing and
  steering, not learning to code.
- Purpose: developers who measurably change how they work with an agent.
- Positioning: coaching built on review of the learner's **own** agent sessions, using
  the log digests the repo already writes to `.claude-logs/`.
- No customers, metrics, testimonials or endorsements exist and none may be implied.
- Data path (upload, local tooling or repo access) and privacy model: **undecided**.

**SHAPING (requester's answers, Phase 1A)**

- First release is **landing page + working app**. (I recommended a smaller first
  release; this was the chosen option. Its consequences are in section 6.)
- First audience: **invited external developers**.
- Primary CTA: **Get the session logger**.

**REPO**

- Next.js 16 / React 19 / Tailwind v4 / next-intl / Supabase Auth / Prisma; page copy
  lives in `messages/en.json`; icons only via `@/components/ui/icons`; every public
  page needs a `PUBLIC_PAGES` entry and `meta` strings; title must differ from the H1.
- `docs/rules/feature-approach.md`: a brand-new feature is offered as an 80/20 slice
  and the developers choose; it is not built maximal by default.
- The repo is still the un-customised template; `template-setup` has not been run.

## 2. Who the page speaks to, and the problem

**Audience (PRODUCT + SHAPING).** An external working developer who is already using a
coding agent most days, has a feeling they could be getting more out of it, and has no
way to see how they actually work with it. Arrives by invitation, so they have context
and a reason to be sceptical-but-curious, not cold traffic.

**Problem (REC, derived from PRODUCT).** Developers get better at agents by feel. Nobody
shows them their own habits: what they ask for, how they phrase it, whether they check
the answer. Generic prompt-engineering advice is not about them.

**Core promise (REC).** _See how you actually work with your coding agent, and get
specific coaching on it — from your own sessions._ The word "own" is the position a
curriculum product cannot copy (PRODUCT). The promise must stay at what the product can
truthfully deliver: see section 5.

**What the page must not promise (REC).** Measurable productivity gains, speed-ups,
or outcomes for anyone, until Dojo has data. PRODUCT's success measure ("measurably
changes how they work") is the product's goal, not a claim to make on day one.

## 3. How the session-log mechanism is explained

REC: explain it as three plain steps, each true today or marked as coming.

1. **Capture** — a small logger, installed in your repo, writes a digest of each
   Claude Code / Codex session: your prompts and the agent's final answers. _True today
   (`scripts/session-log.mjs`)._
2. **Review** — you give Dojo those digests and it reviews how you worked. _Not built.
   Describe as what the app will do, in the invited-preview framing._
3. **Practice** — coaching points you can try in your next sessions. _Not built._

Honest limits that belong on the page, because they are real and a developer will
check (REC; facts from `docs/SESSION_LOGGING.md`):

- The digest holds **prompts and final answers only**: no tool calls, tool results,
  file reads, diffs or reasoning. So Dojo can coach on how you ask and how you
  respond, **not** on what the agent did in your files. Do not imply otherwise.
- Secrets are redacted before the file is written, as a best-effort safeguard that
  also runs a secret scanner; it is **not** a guarantee. Say "we try to remove
  secrets", never "your secrets are safe".
- Digests include your git name, email and GitHub login.
- The repo currently _commits_ logs to git (`CLAUDE.md`). That is the right policy for
  this team and the wrong default for strangers: a learner committing prompts to a
  public repo publishes them. See decision D-LOG.

## 4. Primary call to action and the flow after it

**CTA (SHAPING): "Get the session logger".** Fit with the product: the logger is the
on-ramp, because the whole mechanism starts with having digests. It is also the only
part that exists today, so the CTA leads to something real.

**What "get" must mean (OPEN, REC below).** Today the logger is
`scripts/session-log.mjs` plus hook config inside this repo and depends on
`scripts/check-secrets.mjs`; there is no install path for someone else's repo.

REC flow, smallest honest version:

1. CTA → a "Set up the logger" page (not a modal, not a signup wall).
2. States prerequisites (Node ≥ 22.18, Claude Code and/or Codex, git) and exactly what
   it writes and where; shows a **synthetic** sample digest.
3. Install steps (copy two files + hook snippet, or a package once one exists), then
   a **verify** step (send a prompt, see the file) — the same check as
   `docs/SESSION_LOGGING.md`.
4. "Choose where logs go" with the safe default (not committed; see D-LOG).
5. Next action: "Come back when you have a few sessions" → access to the app for
   invited users (or a waitlist email if the app is not ready). **First meaningful
   action after the CTA = a working logger in the user's own repo.**

Secondary CTA (REC): "See how a review works" scrolls to a worked example built from a
clearly labelled sample session.

## 5. Information hierarchy (section by section)

Persuade-mode surface (REC). One H1; headings descend one level at a time; all copy in
`messages/en.json`, server-rendered.

| #   | Section                         | Job                                   | Content (REC)                                                                                                                     | Evidence needed / forbidden                                                                                                                         |
| --- | ------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Header                          | Orient; one action                    | Wordmark "Dojo", sign-in only if accounts exist, CTA                                                                              | A real logo does not exist; text wordmark until one does.                                                                                           |
| 2   | Hero                            | Say what Dojo is and the one action   | H1 stating the promise in plain words; one sentence on the mechanism; primary CTA; secondary "see a review"                       | No metric, no "trusted by". An **early-access** label is honest.                                                                                    |
| 3   | The problem                     | Make the visitor recognise themselves | 2–3 concrete moments (accepting an answer unread, re-prompting the same way, losing context)                                      | Must be recognisable, not invented statistics. Prefer examples written by the team from real sessions.                                              |
| 4   | How it works                    | The three steps in section 3          | Capture → Review → Practice, with "available now" vs "coming" marked                                                              | Step 1 can be demonstrated; steps 2–3 stay labelled until built.                                                                                    |
| 5   | A worked review                 | Prove the mechanism without users     | A sample session digest beside the coaching it would produce                                                                      | **Must be labelled synthetic or sample**, authored by the team. No real user, no fake name or quote. Needs the review output to exist in some form. |
| 6   | What we keep, and what we don't | Earn trust                            | Plain statement of what the logger records, excludes, redacts, where it is stored, what you can delete (all subject to D-PRIVACY) | Only claims the architecture guarantees. Link to the logger source.                                                                                 |
| 7   | Who it is for / not for         | Qualify                               | Working developers using agents; not a coding tutorial                                                                            | Honest; reduces wrong-fit invites.                                                                                                                  |
| 8   | Final CTA + FAQ                 | Close                                 | Repeat CTA; FAQ on data, agents supported (Claude Code, Codex), cost (if undecided, say "early access")                           | Do not state pricing, licensing or deployment facts that are not decided.                                                                           |
| 9   | Footer                          | Trust basics                          | Contact, privacy and terms links (repo `SITE` config requires real pages)                                                         | `privacyHref`/`termsHref` must point at pages that exist.                                                                                           |

What to show **before there are users or metrics** (REC): the logger working (a real
screen recording or terminal capture of a real install by the team), a synthetic
sample digest, a synthetic worked review, and the open-source code. Do not show:
customer logos, counts, testimonials, uptime, latency or any "powered by Microsoft /
Amazon / Google" marks.

## 6. Consequence of "landing page + working app" (SHAPING)

This is a much larger first release than a landing page. The CTA works end to end only
if the app can accept, process and show a review of a developer's digest. That pulls in
the decisions in section 10 (accounts, storage, provider, privacy) **before** the
landing page can promise the app. Under `docs/rules/feature-approach.md` this should be
offered as an 80/20 slice. REC slicing, for the owner to accept or reshape:

- **Slice 1 (ships the page honestly):** landing page + logger distribution page. The
  CTA is real. The app is described as "invited preview, coming".
- **Slice 2:** invite-only accounts + upload of a digest + a stored list of the user's
  digests, with delete. No analysis yet.
- **Slice 3:** the review itself (the only slice that may involve an AI provider).
- **Slice 4:** export, retention controls, team features if wanted.

Choosing "both at once" is allowed; it simply means Slices 1–3 are one release, and
the landing page copy must wait for what that release does.

## 7. Privacy and evidence constraints

**Evidence rules (PRODUCT + REPO):** no fabricated counts, no endorsements, no
unverified enterprise adoption, no third-party logos implying customers, no fake
testimonials or invented user outcomes, no uptime or performance figures. Anything
illustrative is labelled as such where the reader sees it.

**Data-handling claims — only what is decided.** Today **no** claim about where logs
are processed or stored is permitted, because the architecture does not exist. In
particular the page must not say logs are "processed locally" unless the design
guarantees it (a local-only analysis is possible but is a decision, D-PROCESS).
The only data statements that are true now are about the **logger**: what it
records and excludes, that it redacts best-effort, and that it writes to a folder on
the user's own machine.

**Privacy risks to resolve before any upload exists (REC):** digests contain prompts
that can include proprietary code and names; redaction is a pattern backstop;
author name/email/login are included; the logger's repo-commit default publishes data
on a public repo. The owner's own earlier digest in this public repo already shows the
last point.

## 8. The original landing-page specification

Kept or dropped as candidates only — the visual world is chosen later, in a separate
step, not here.

| Spec element                                                                                                                                     | Verdict                       | Why                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dark, full-bleed, minimal-chrome hero                                                                                                            | Candidate                     | Plausible for a developer tool; not decided.                                                                                                      |
| Dot-matrix display type                                                                                                                          | Candidate, licence unverified | Terminal-flavoured; BubbledotICG-FinePos licence is unchecked; Geist Pixel file is missing.                                                       |
| Looping CloudFront background video                                                                                                              | Drop                          | Third-party URL with no ownership or retention guarantee; no relation to the product; motion needs a pause control (WCAG 2.2.2); heavy on mobile. |
| "Intelligence Designed To Evolve" headline, "Trusted by 2000+ Enterprises", Microsoft/Amazon/Google marks, 120 ms / 99.99 % / 24/7 / 2.4 M stats | Drop                          | Generic AI-platform messaging; unsupported claims; implied endorsement.                                                                           |
| "Build applications that reason, adapt and collaborate…" subhead                                                                                 | Drop                          | Describes a different product.                                                                                                                    |
| Font Awesome CDN                                                                                                                                 | Drop                          | `docs/rules/icons.md`; also unneeded once logos go.                                                                                               |
| Single viewport, `overflow: hidden`, no scroll                                                                                                   | **Recommend against**         | See below.                                                                                                                                        |
| Count-up stats                                                                                                                                   | Drop                          | There are no stats.                                                                                                                               |
| Mobile burger/sheet menu                                                                                                                         | Rework                        | A 2–3 link header needs no hidden menu; if one is kept use Radix (`docs/rules/components.md`).                                                    |
| Reduced-motion handling, entrance animations                                                                                                     | Candidate                     | Fine in moderation; must respect `prefers-reduced-motion`.                                                                                        |

**Single-viewport, non-scrolling — the trade-off, not a mandate.**

- For: a striking, memorable first impression when the content is one line and a button.
- Against: Dojo's page must carry a mechanism, honest limits and a privacy statement
  (sections 3–7) — that is several screens of content. `overflow: hidden` clips it at
  200 % zoom, large text and landscape phones (WCAG 1.4.4 / 1.4.10 reflow), and hides
  exactly the trust content this product depends on. It also forces every claim into
  a few words.
- REC: make the **hero** fill the first viewport (the composition the spec wants),
  then let the page scroll normally. This keeps the spec's intent and drops the
  hazard. OPEN: owner decides.

**Other conflicts** (carried from `docs/INITIAL_PRODUCT_SPEC_AUDIT.md`): title vs H1 (SEO
rule); copy in `messages/en.json`; `next/image` for the logo; design tokens not
hardcoded; assets unlicensed or missing (`logo.webp`, `GeistPixel-Circle.woff2`);
nav contrast ≈ 2.9 : 1 for inactive links; no reference screenshot.

## 9. Accessibility and SEO

- WCAG AA contrast, visible `:focus-visible`, reduced motion, labelled controls
  (`DESIGN.md`). No decorative motion that cannot be paused if it lasts > 5 s.
- One H1, ordered headings; icons `aria-hidden`; any menu keyboard-operable.
- Content is server-rendered; copy in `messages/en.json`; breadcrumbs only below home.
- SEO: `PUBLIC_PAGES` entry, `meta.title` 30–60 chars and **not the H1**,
  `meta.description` 70–160. `SITE.indexable` is a decision (D-AUDIENCE): invited
  audience suggests `false` until the claims and privacy copy are final.
- Sample/synthetic content is labelled in text, not only visually.

## 10. Decisions

Status of each: nothing below is decided unless marked SHAPING. "Owner" = the product
owner / both developers.

**D-SCOPE — Is the first release a landing page, a working app, or both?**

- _Why it matters:_ it sets what the CTA can honestly promise and how much must exist
  first.
- _Options:_ (a) landing page only; (b) landing page + logger distribution; (c) landing
  page + invite-only app (upload, store, review); (d) all at once.
- _SHAPING:_ requester chose "landing page + working app".
- _REC:_ ship (b) first as Slice 1 and treat (c) as Slices 2–3, whatever the calendar.
- _Owner confirms:_ the scope, and that landing copy about the app waits for the app.

**D-AUDIENCE — Internal testers or external developers; public or invited?**

- _Why:_ governs SEO (`indexable`), tone, claims scrutiny and support burden.
- _Options:_ internal only; invited external; public.
- _SHAPING:_ invited external developers.
- _REC:_ invited, `noindex` until copy and privacy statement are final.
- _Owner confirms:_ invite mechanism (link, code, list) and indexability.

**D-ACCOUNTS — Are accounts required for the first release?**

- _Why:_ decides whether Supabase Auth stays (`docs/rules/auth.md`) and how invites work.
- _Options:_ none (landing + logger only); email-link invites; Supabase Auth with
  invite-only signup.
- _REC:_ none for Slice 1; Supabase Auth, invite-only, from Slice 2 (it is already in
  the template). Note the "working app" choice implies accounts.
- _Owner confirms:_ yes/no and invite policy.

**D-INTAKE — How do users provide their session logs?**

- _Why:_ it is the product's front door and its biggest privacy surface.
- _Options:_ (a) manual file upload of digests; (b) an upload command in the logger
  (`dojo push`); (c) a GitHub integration reading committed `.claude-logs/`; (d) fully
  local analysis, nothing uploaded.
- _REC:_ (a) for the first app slice (visible, user-initiated, easy to explain);
  defer (b)/(c).
- _Owner confirms:_ the mechanism and that users review a digest before sending it.

**D-LOG — Where does the user's logger write, and is it committed?**

- _Why:_ this repo commits logs; that default would publish strangers' prompts.
- _Options:_ project-local `.claude-logs/` committed; project-local and gitignored;
  user-level directory outside any repo.
- _REC:_ gitignored or user-level by default, documented, committing opt-in.
- _Owner confirms:_ the default and the setup instructions on the CTA page.

**D-PROCESS / D-STORE — Where are logs processed and stored?**

- _Why:_ determines every privacy statement the page may make.
- _Options:_ processed in the browser/local only; on Dojo's servers (database, retention
  period) ; third-party processors.
- _REC:_ decide before building Slice 2; state retention in days; one region.
- _Owner confirms:_ location, retention, and who can access stored digests.

**D-PROVIDER — Which AI providers, if any, receive session data?**

- _Why:_ sending prompts to a provider is a disclosure the user must be told about and
  consent to; the repo also requires the AI-usage tracking wiring (`docs/rules/ai-usage.md`)
  and an `ai-usage-setup` decision.
- _Options:_ none (rule-based analysis only); one provider under a zero-retention
  agreement; user-supplied key.
- _REC:_ Slice 3 only; named provider(s) listed on the page; zero-retention terms
  confirmed before launch.
- _Owner confirms:_ provider, terms, and consent wording.

**D-CONTROL — What can users delete, export or inspect?**

- _Why:_ trust and legal expectation; also easier to build in at the start.
- _Options:_ delete only; delete + export; delete + export + view exactly what was sent.
- _REC:_ at minimum delete and "see what was uploaded" in Slice 2.
- _Owner confirms:_ the commitment, which becomes a public promise.

**D-FIRSTACTION — What is the first meaningful action after the CTA?**

- _SHAPING:_ CTA is "Get the session logger".
- _REC:_ a working logger in the user's own repo (section 4), then access to the app.
- _Owner confirms:_ the logger's distribution (copy-in files vs published package) and
  its licence; the repo is MIT (`LICENSE`).

**D-POSITION — Is the generic spec copy discarded?**

- _REC:_ yes (section 8). _Owner confirms._

**D-VIEWPORT — Hero-only full viewport (REC) or strictly single viewport?** _Owner decides._

**D-ASSETS — who supplies:** a logo (or approve a text wordmark), font choices and
their licences, a reference screenshot if the spec look is still wanted. REC: no
third-party video; no logo marks of other companies.

**D-VISUAL — visual world.** Not chosen. Needs the next Impeccable step (new-work) after
the scope above is settled; `DESIGN.md` is still the template starter.

**D-SETUP — template-setup answers** (name, accounts, internal/external, AI calls, icon
provider) overlap D-ACCOUNTS, D-AUDIENCE and D-PROVIDER and should be answered once.

## 11. Required assets

| Asset                                                   | Status                                                               | Notes                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Logger distribution (files or package), README, licence | Partly exists (`scripts/session-log.mjs`, `docs/SESSION_LOGGING.md`) | Needs the setup PR merged, a standalone install story, and D-LOG. |
| Synthetic sample digest                                 | To write                                                             | Team-authored, labelled sample.                                   |
| Worked review of the sample                             | To write; needs review output to exist                               | Labelled sample.                                                  |
| Screen recording / capture of a real logger install     | To record                                                            | By the team.                                                      |
| Product screenshots of the app                          | Do not exist                                                         | Not before the app does; never mock them up as real.              |
| Logo / wordmark                                         | Does not exist                                                       | Text wordmark meanwhile.                                          |
| Privacy statement, terms, contact                       | Do not exist                                                         | `SITE` requires real pages.                                       |
| Fonts                                                   | Undecided; licences unverified                                       | See section 8.                                                    |
| Share image / favicon                                   | Template placeholders                                                | Brand-owned later.                                                |

## 12. Impeccable design-hook verification (read-only investigation)

Findings, not changes:

- **Where the implementation comes from.** The Impeccable plugin (`impeccable@impeccable`
  4.8.0, installed at user scope on 2026-10-30, `enabledPlugins: true` in
  `~/.claude/settings.json`). The hook is the plugin's own `hooks/hooks.json`:
  `SessionStart`, `PostToolUse` on `Edit|Write`, and `Stop`, each calling the bundled
  `scripts/impeccable hook`.
- **Does the plugin already register it?** Yes, for Claude Code. `/impeccable hooks on`
  therefore only wrote `.impeccable/config.json` (`hook.enabled: true`) and a local
  consent file; it did not need to write any manifest, which matches its report that
  it found no installed provider skill folders.
- **Operational?** The detector engine works (it flagged a gradient-text sample in a
  scratch file). Whether the hook fires **in a session** is **NOT VERIFIED**: the
  plugin was installed mid-session, plugin hooks normally load at session start, and
  no `.impeccable/hook.cache.json` exists yet. Verify by editing a UI file in a fresh
  Claude Code session and watching for the reminder (there are no UI files to edit
  yet, so this waits for Phase 1C).
- **What `npx impeccable install` would modify.** From its help: it installs compiled
  skills into project or user harness folders and, unless `--no-hooks`, "provider hook
  manifests". The hooks reference lists those as `.claude/settings.local.json`,
  `.codex/hooks.json`, `.cursor/hooks.json`, `.github/hooks/impeccable.json` and
  `.gemini/settings.json`.
- **Conflict risk.** (1) For Claude Code it would be redundant with the plugin and could
  double-fire. (2) `.codex/hooks.json` already holds this repo's session-logging hooks;
  whether the installer merges or replaces is **not verified** and I did not run it.
  (3) A committed `.github/hooks/impeccable.json` would apply to every collaborator.
- **REC:** do not run the installer. If Codex coverage is wanted, try
  `--providers=codex` in a scratch copy of the repo first and diff `.codex/hooks.json`,
  or add the Codex hook by hand alongside the logging hooks after reviewing it.
  `.impeccable/config.json` is untracked: OPEN whether it is committed (shared hook
  switch) or kept local.
- `.claude/settings.json`, `.codex/hooks.json` and personal settings were not touched.

## 13. Recommended next phase

**Phase 1B — Decide, then design (no code).**

1. Owner answers section 10, starting with D-SCOPE, D-LOG, D-PROCESS/STORE, D-PROVIDER;
   record the outcomes in `PRODUCT.md` (via `/impeccable init` update) and
   `docs/DECISIONS.md`.
2. Land the Phase 0 setup PR (needs a Linux or WSL push; see `docs/HANDOFF.md`).
3. Run `/impeccable` new-work to choose the visual world, with `DESIGN.md` then
   documented.

**Phase 1C — Slice 1 build:** landing page + logger distribution page, in the existing
Next.js architecture, copy in `messages/en.json`, SEO entry, tests, screenshots.
Slices 2–3 follow once the privacy decisions are made.
