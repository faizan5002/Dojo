# Product decisions review, privacy audit and tooling review

Phase 1B. Documentation and review only: no feature, logger behaviour, database,
authentication, provider, hook or settings change, no history rewrite, no commit.
Labels follow `docs/FIRST_PUBLIC_EXPERIENCE.md` section 0: **PRODUCT** (confirmed in
`PRODUCT.md`), **SHAPING** (the requester's Phase 1A answers, not yet in `PRODUCT.md`),
**REPO** (a constraint that exists today), **REC** (my recommendation), **OPEN**.
**Nothing marked REC below is approved.** `PRODUCT.md` is unchanged.

> **Update (Phase 1C).** The owner has since approved one policy: session logs are
> local-only, gitignored and never committed (`docs/DECISIONS.md`). That settles decision
> 1.6 for internal logs and the "committed by default" risk in sections 2.5–2.7, which
> describe the state _before_ it. Everything else here is still a recommendation.

## 1. Decision-by-decision review

Each entry: status, recommendation, reasoning, consequences, and the exact wording an
owner would need to approve. "Owner" means the product owner and both developers.

### 1.1 Four-stage release plan (landing + logger → invite-only upload → review → export/retention)

- **Status:** The requester chose "landing page + working app" (SHAPING). The four-stage
  slicing is REC; nothing is decided.
- **Recommendation:** Adopt the slices as the order of work, even if several ship together.
- **Reasoning:** `docs/rules/feature-approach.md` asks for an 80/20 slice to be offered for a
  new feature. Each slice adds a privacy surface (storage, then a provider), so the order
  lets the page promise only what exists. Slice 1 is the only one that needs no data
  decisions.
- **Consequences:** The landing copy describes the app as "invited preview" until Slice 2
  exists. If the owner wants Slices 1–3 as one release, copy waits for all three.
- **Owner approves:** "The first public release is built in the order Slice 1 → 2 → 3 → 4;
  page copy describes only the slices that are live, and anything later is labelled
  as coming."

### 1.2 Invited external developers as the initial audience

- **Status:** SHAPING (requester's answer). Not in `PRODUCT.md`.
- **Recommendation:** Confirm and record it in `PRODUCT.md` once approved.
- **Reasoning:** An invited audience tolerates "early" honestly, keeps support load small,
  and matches the data sensitivity (nobody uploads prompts anonymously).
- **Consequences:** Needs an invite mechanism (link, code or list) and someone to issue
  invites; copy can assume context the cold public lacks.
- **Owner approves:** "First audience is invited external working developers; invitations
  are issued by [mechanism] by [person]."

### 1.3 `noindex` during private beta

- **Status:** REC.
- **Recommendation:** Set `SITE.indexable: false` until copy, privacy statement and terms are
  final; flip it as a deliberate launch step.
- **Reasoning:** `docs/rules/seo.md`: `indexable: false` noindexes every page and disallows
  everything in `robots.txt`, production included. A page that promises privacy
  should not be crawlable before its privacy text exists.
- **Consequences:** No organic traffic; share links still work; the SEO work
  (`PUBLIC_PAGES`, `meta`) is still built so launch is a one-line change. Noindex is not
  access control: anyone with the URL can read it.
- **Owner approves:** "`SITE.indexable` stays `false` until [named condition]; the launch
  checklist includes flipping it."

### 1.4 No account for logger installation; invite-only authentication for the hosted app

- **Status:** REC (Slice 1 needs no account; accounts for the app are D-ACCOUNTS, open).
- **Recommendation:** The logger page and download need no sign-in; the hosted app uses
  Supabase Auth with invite-only signup (already in the template, `docs/rules/auth.md`).
- **Reasoning:** The logger runs on the learner's machine and sends nothing to Dojo, so an
  account adds friction and implies a data relationship that does not exist. Upload and
  stored digests need identity.
- **Consequences:** Keeps Supabase Auth (do not run the "remove auth" steps); needs an
  invite flow, RLS migrations for any new table, and authorization guards in the
  API layer. Installing the logger leaves no record at Dojo, so installs cannot be counted.
- **Owner approves:** "Logger install is public and account-free. The hosted app requires
  an invited account; Supabase Auth stays."

### 1.5 Explicit manual upload with local preview and redaction review

- **Status:** REC (D-INTAKE open).
- **Recommendation:** A learner chooses a digest file, sees exactly what will be sent
  (including what redaction removed), edits or excludes entries, then confirms. No
  background or automatic upload.
- **Reasoning:** The privacy audit (section 2) shows redaction catches 8 of 21 synthetic
  cases; only the person can judge private code, client names and emails. Consent should
  be per upload, informed, and revocable.
- **Consequences:** The preview runs in the browser, so redaction must be implemented
  client-side (the current logger redactor is Node, pattern-based and incomplete). More
  front-end work; slower to first value; far smaller liability.
- **Owner approves:** "Digests reach Dojo only by an explicit upload the user confirms
  after previewing the exact content; no automatic or background upload exists."

### 1.6 No automatic session-log commits

- **Status:** REC. Current behaviour differs between two cases (section 2.5).
- **Recommendation:** Product-facing: never commit or publish digests automatically.
  Internal logs: see section 3.
- **Reasoning:** Today nothing auto-commits, but the repo's own rule tells agents to stage
  `.claude-logs/` before every push, `.claude-logs/` is not gitignored, and the repo is
  public. For strangers' prompts that default would publish them.
- **Consequences:** The distributed logger must default to a gitignored or user-level
  folder and treat committing as opt-in. Our own repo policy then needs its own decision.
- **Owner approves:** "The logger shipped to users never stages, commits or pushes logs and
  defaults to [gitignored project folder | user-level folder]."

### 1.7 No third-party AI provider receives session data without informed consent

- **Status:** REC (D-PROVIDER open). Consistent with `PRODUCT.md` principle 3 (minimise
  session data) but not stated there as a rule.
- **Recommendation:** Default is no provider. If a provider is used (Slice 3), name it on
  the page, obtain consent at upload time, require no-retention/no-training terms, and
  record which provider handled which digest.
- **Reasoning:** Sending a developer's prompts to a third party is a disclosure the
  developer may not be allowed to make (employer code, client data).
- **Consequences:** Requires `ai-usage-setup` and provider wiring per `docs/rules/ai-usage.md`;
  consent copy and a stored consent record; possibly a bring-your-own-key option.
- **Owner approves:** "No digest content goes to any third-party AI provider unless the
  uploader has consented to that named provider for that digest; terms are verified
  before launch."

### 1.8 User inspection, export and deletion controls

- **Status:** REC (D-CONTROL open).
- **Recommendation:** At minimum: list your digests, view exactly what is stored, delete a
  digest (and derived reviews), delete the account; export in Slice 4.
- **Reasoning:** `PRODUCT.md` principle 3; also a public promise the page will make, so it
  must be built before it is stated.
- **Consequences:** Deletion must cover backups and any provider-held copies; a retention
  period must be chosen; audit of what "derived" data exists.
- **Owner approves:** "Users can view and delete every digest and review from Slice 2;
  retention is [N] days unless deleted earlier; export arrives in Slice 4."

### 1.9 Logger installation as the first meaningful product action

- **Status:** SHAPING (the CTA "Get the session logger").
- **Recommendation:** Keep it, provided the logger has a standalone install path and safe
  defaults (1.6) before the CTA goes live.
- **Reasoning:** It is the only part of the mechanism that exists, so the CTA leads somewhere
  real.
- **Consequences:** The logger is currently repo-internal (`scripts/session-log.mjs` imports
  `scripts/check-secrets.mjs`, hooks are in this repo's config); it needs packaging, docs, a
  licence statement (repo is MIT), and a verify step. See also section 3.
- **Owner approves:** "The CTA is 'Get the session logger'; it does not go live until the
  logger is installable outside this repo with the defaults from 1.6."

### 1.10 Discard generic enterprise AI-platform positioning

- **Status:** REC. `PRODUCT.md` already forbids invented claims (PRODUCT) but does not say
  the spec copy is discarded.
- **Recommendation:** Discard the spec's headline, subhead, trust row, stats and logos.
- **Reasoning:** It describes a different product and relies on unverifiable claims.
- **Consequences:** New copy must be written from `PRODUCT.md`; the spec is kept only as
  visual candidates.
- **Owner approves:** "The original spec's copy and claims are not used; Dojo's copy derives
  from `PRODUCT.md`."

### 1.11 Full-viewport hero with a normally scrolling page

- **Status:** REC (D-VIEWPORT open).
- **Recommendation:** Hero fills the first viewport; the page scrolls.
- **Reasoning:** The page must hold a mechanism, honest limits and privacy text; a clipped
  single viewport fails zoom/reflow (WCAG 1.4.4, 1.4.10) and hides the trust content.
- **Consequences:** Departs from the spec's literal requirement; nothing else changes.
- **Owner approves:** "The hero fills the first viewport at common desktop sizes; the page
  scrolls; `overflow: hidden` is not used on the page."

### 1.12 No unlicensed fonts, unverified metrics, fabricated testimonials or endorsement logos

- **Status:** The evidence rules (no invented customers, metrics, testimonials, or
  third-party logos implying customers) are **PRODUCT**. Font licensing is REC.
- **Recommendation:** Treat all as hard rules; add the font rule to `PRODUCT.md` on approval.
- **Reasoning:** Misrepresentation and licence breach are avoidable; the product's own
  principle is "never claim what has not been earned".
- **Consequences:** Typography is limited to fonts with a verified licence (open fonts
  self-hosted); no logo wall until real, permitted customers exist.
- **Owner approves:** "Only fonts with a recorded licence are used; no metric, testimonial,
  customer or logo appears unless it is real and its owner has agreed."

## 2. Session-log privacy audit

Scope: `scripts/session-log.mjs`, its tests, `docs/SESSION_LOGGING.md`, `.gitignore`,
`.prettierignore`, `.claude-logs/`, `.codex-logs/`, and git history. No content is
reproduced here; findings are categories and counts. Nothing was deleted or rewritten.

### 2.1 What is collected

Frontmatter (every log): session id (random UUID), agent, date, **git `user.name`**
(or `CLAUDE_AUTHOR`), **git `user.email`**, **GitHub login** (via `gh` or config), project
(folder name), status fields, UTC timestamps of the first and last prompt and of every
entry, and statistics. Body: **every prompt in full** (including anything pasted), and
the **final assistant answer** of each turn in full. Excluded by design: tool calls and
results, file reads, diffs, reasoning, subagent output, and harness-injected context.

### 2.2 Credentials and private code

Prompts and answers can contain both. Developers paste errors, config, logs and code, and
answers quote code, paths and hostnames. The logger cannot tell private from public
text. The only filter is the redactor in 2.3.

### 2.3 What redaction catches and misses

Probe: 21 synthetic inputs (assembled at runtime, none real). **8 were altered, 13 passed
through unchanged.**

| Caught                                                                                                                                                            | Missed                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub token, AWS access key id, labelled AWS secret, DB URL with password, JWT, bearer token, `api_key=` in a URL, quoted env secret (`SUPABASE_SECRET_KEY="…"`) | Email addresses; Windows/home paths with the account name; private IPs and internal hostnames; proprietary source code; customer names and phone numbers; passwords written in prose ("my password is …"); labelled passwords shorter than 8 characters or lower-case-only under 20; unlabelled high-entropy tokens (including a bare 40-character AWS secret and 32-hex ids); Slack incoming-webhook URLs; secrets split across lines; small base64 blobs |

Reading: the redactor is a good net for **credential formats**. It does nothing for
**personal data, business data or source code**, which is most of the risk. It is a
backstop, as `docs/rules/secrets.md` says, and cannot support a "your data is safe" claim.

### 2.4 Are author name, email and GitHub login necessary?

- **Internal logs:** The spec asks for attribution. A GitHub login alone identifies the
  author; the **email adds nothing** an engineering reader needs and is the most sensitive
  field. The display name is optional.
- **Product digests:** None is necessary. Dojo needs a pseudonymous account/digest id, not
  an identity pulled from git config.

### 2.5 Are logs auto-committed?

No hook stages, commits or pushes anything. Publishing happens by policy and by accident:
`CLAUDE.md` and `/cicd` tell agents to stage `.claude-logs/` before every push;
`.claude-logs/` is not in `.gitignore`, so `git add -A` or an IDE "commit all" picks it up;
the pre-commit scanner (`check:secrets --staged`) only looks for credential patterns. The
remote is **public** (`faizan5002/Dojo`). The practical default is therefore that every
session log on a branch is published when the branch is pushed.

### 2.6 Existing exposure

- **Published log** (`.claude-logs/2026-10-29_15-37-18_d2eb4960-….md`, commit `2f2f925`, a
  public repo): contains **1 personal email address** (`git_email`), **2 Windows
  profile paths** that include a local account name, the project folder name, the owner's
  GitHub handle, usage timing and the prompts and answers of one short session. The
  secret scanner reports **no credentials**. Severity: low-to-moderate, mainly the email.
- **Commit metadata, independent of the log:** the two public commits use two different
  author emails, one being the GitHub no-reply address and the other a personal address,
  so that address is already visible in `git log` and on GitHub whatever happens to the log.
- **Current working-tree log** (untracked, ~68 KB): 1 email, a Windows account name in
  paths, 6 URLs, and the full text of the Phase 0–1A prompts and reports. Not published
  unless someone stages it. Severity if published: moderate (email + account name +
  internal discussion).
- No evidence of a secret in any log. Absence of scanner findings is not proof.

### 2.7 Could the setup publish private session information by accident?

Yes. See 2.5. The risk is highest for a developer who talks about sensitive topics in a
session in this repo, and for any future contributor on a different machine.

### 2.8 Remediation plan (proposal; needs the owner's approval, none executed)

1. **Decide whether the existing exposure matters.** If not, record it and stop.
2. **Stop the identity leak going forward (config, no history change):** both developers
   set `git config user.email` to their GitHub no-reply address; enable GitHub "keep my
   email private" and "block command-line pushes that expose my email".
3. **Remove the email from future logs** (logger change, a later phase): drop `git_email`
   by default; make `author`/`github_user` optional; scrub account names from paths.
4. **Fix the default** for internal logs (section 3, A).
5. **Optional, destructive, owner-only:** to remove the published log and the email from
   history, rewrite history and force-push (only 2 commits exist, so it is feasible),
   then ask GitHub support to purge cached views. Costs: invalidates every clone and
   fork, cannot unpublish copies already taken, and conflicts with the "never
   force-push a shared branch" rule, so it needs explicit approval and coordination.
   A softer alternative is a normal commit that blanks the email in the file; it leaves
   history intact.
6. **Rotate nothing:** no credential was found.

## 3. Two kinds of logs, two policies

|                   | A. Internal engineering session logs                                                                                                                                                                       | B. Product-facing user session digests                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| What              | The developers' own sessions on this repo (today's `.claude-logs/`)                                                                                                                                        | Digests a learner chooses to give Dojo                                      |
| Purpose           | Handoff, review, dogfooding; reviewers see how a change was produced                                                                                                                                       | Coaching the learner (`PRODUCT.md`)                                         |
| Who owns the data | The team                                                                                                                                                                                                   | The learner                                                                 |
| Identity fields   | GitHub login; display name optional; **no email** (REC)                                                                                                                                                    | Pseudonymous account id only (REC)                                          |
| Where it lives    | Public repo today. REC: if the repo stays public, **do not commit**; keep logs gitignored locally and archive reviewed excerpts in a private place. If the repo becomes private, committing is acceptable. | Dojo storage, per-user, access-controlled; never in a git repo              |
| Consent           | Implicit among the two developers                                                                                                                                                                          | Explicit, per upload, after local preview (1.5)                             |
| Redaction         | Existing redactor + a human skim before any commit                                                                                                                                                         | Stronger and client-side, plus the user's own review; never relied on alone |
| Retention         | Until the PR is merged plus a review window, then dropped or archived privately (REC; length OPEN)                                                                                                         | A stated period (days) and deletable anytime (1.8); OPEN: the period        |
| Third parties     | None                                                                                                                                                                                                       | Only with named, informed consent (1.7)                                     |
| Opt-out           | A way to disable logging for a sensitive session is missing (REC: add one)                                                                                                                                 | User can delete everything                                                  |

The same logger can serve both, but their defaults must differ. Today only A exists and
its default (commit and push to a public repo) must not become B's default.

## 4. Hallmark skill review

Location: `~/.agents/skills/hallmark/` (symlinked for Claude Code). Read: `SKILL.md`
(fully) and a static scan of every script and reference. **No script was executed, no
component installed.** The installer's own assessment at install time was: Gen **High
Risk**, Socket 0 alerts, Snyk **Medium Risk**. I did not line-by-line audit the largest
scripts (`sloplint.mjs`, 4,424 lines), so "no malicious behaviour found" means none was
visible in the instructions, install and network code, not a guarantee.

**What it instructs.** A design skill for new pages: a "Floor" of hard rules (tokens for
all colour and fonts, no `transition: all`, focus-visible, reduced motion, no invented
metrics/testimonials/logos, hero text visible at 1280×800, about 80 words per screen), a
required "ask once" four-question message, a dealt theme and page shape chosen by a script,
a stamp in the first line of the CSS, a lint run before handing back, and a "fresh-context"
review whose prompt files the agent is told not to open.

**Executable content** (all Node `.mjs`): `sloplint*` (static linter, headless-browser
render), `theme.mjs` (draw/deal/scaffold/log; `photos --save` downloads from
`upload.wikimedia.org` only), `capture.mjs`/`picture.mjs` (puppeteer screenshots; can
attach to a Chrome DevTools endpoint on `127.0.0.1`), `imagegen.mjs` (calls
`api.together.xyz` only when `TOGETHER_API_KEY` is set; it is not set here),
`install.mjs` (copies/removes skill folders in harness directories),
`install-hook.mjs` (adds a PostToolUse hook to `.claude/settings.json`, project or
`--global`), `lint-hook.mjs` (the hook; runs `sloplint` on edited HTML/CSS/component files in
a Hallmark project), `refcheck.mjs` (self-test). Also runs `npm root -g`.

**Files it may ask to create or change:** `tokens.css`, `base.css`, `.hallmark/` (log,
preflight cache, brand spec), a stamp on line 1 of the project's CSS, `design.md`, shot
folders (and a `.gitignore` inside them), saved library photos, and imports added to the
project's stylesheet. It says existing stylesheets are append-only.

**Network/external dependencies:** Wikimedia Commons (stock photos, credit required in the
footer), Google Fonts and Fontshare (generated CSS links fonts from third-party hosts),
`cdn.simpleicons.org`, Together AI (opt-in image generation; the skill carries a
"Powered by Together AI" line). Built pages that link third-party font hosts send
visitors' requests to them, which a privacy-focused product should decide on deliberately.

**Prompt-injection and conflict risks.** I found no instruction to exfiltrate, disable
safeguards, or run destructive commands. Risks are about authority and opacity:
(1) it treats a root `DESIGN.md` as **a locked system that overrides everything**: this
repo's `DESIGN.md` is a template starter, so Hallmark would lock to it; (2) it has
`allow_implicit_invocation: true` and a description that matches "build or design something
new", so it can trigger on the landing page by itself, competing with Impeccable; (3) it
tells the agent to delegate to a reviewer whose prompt file it must not read, which is
opaque delegation; (4) its stamp/`tokens.css`/`base.css` conventions conflict with this
repo's `src/app/globals.css` `@theme` tokens and the Prettier Tailwind plugin; (5) its
random "draw" of a page shape and theme conflicts with the owner choosing the visual world
(D-VISUAL); (6) `install-hook.mjs` would edit `.claude/settings.json`, the file that holds
our logging hooks.

**Alignment.** Its Floor rules on invented metrics/testimonials/logo walls, focus states,
reduced motion and hero-in-first-viewport agree with `PRODUCT.md` and the Phase 1A
recommendations. Its "never use on an existing design unless named" is a good boundary.

**Versus Impeccable.** Both are full design pipelines with their own context loading, world
selection and finish review. Using both on one surface means two competing sets of
instructions. This repo already has Impeccable wired to `PRODUCT.md`.

**Recommendation (REC; I did not remove anything).** Retain the files installed but **do not
use Hallmark on Dojo** until the owner chooses one design pipeline. Never run
`install-hook.mjs` or `install.mjs` here. If the owner wants zero chance of implicit
triggering, remove it with the skills CLI (check `npx skills --help` for `remove`). If it is
kept, use it only by naming it explicitly, for a new surface, after D-VISUAL is decided.

## 5. Impeccable configuration review

State found: `.impeccable/config.json` = `hook.enabled: true` plus default limits;
`.impeccable/config.local.json` = `hook.consent: accepted`; the cache and pending files
and `config.local.json` are excluded through **`.git/info/exclude`** (a per-clone file, not
shared). The plugin (`impeccable@impeccable` 4.8.0, user scope, `enabledPlugins: true`)
registers the hook itself through its own `hooks/hooks.json` (SessionStart, PostToolUse on
Edit|Write, Stop). `npx impeccable install` was not run.

- **Does the detector work in a fresh session?** The detector engine works (`impeccable
detect` flagged a gradient-text sample). Whether the **hook** fires in a fresh session is
  **NOT VERIFIED**: several synthetic invocations of `impeccable hook` against a scratch
  project (PostToolUse and SessionStart payloads, with and without consent files)
  produced no output, which I cannot explain (it may require a real harness session or
  state I did not recreate). To verify safely: restart Claude Code in this repo, run
  `/hooks` to see the plugin's hooks listed, then edit any UI file and look for the
  "Checking UI changes" status line or a reminder.
- **Should `config.json` be in the repository?** REC: yes. It holds no personal data and
  makes the detector's on/off state and any future shared ignores part of the project,
  which is what the config is designed for. Each developer still needs the plugin; a
  `hook.enabled` flag without the plugin is inert.
- **Must `config.local.json` stay ignored?** Yes: it records one developer's consent.
  Today only a local, clone-specific exclude protects it. REC: add
  `.impeccable/config.local.json`, `.impeccable/hook.cache.json` and
  `.impeccable/hook.pending.json` to `.gitignore` so a second clone cannot commit them.
- **Prettier failures without weakening checks.** The tool writes 2-space JSON and
  rewrites it on each update, while the repo requires tabs; formatting by hand would be
  undone. REC: add a single narrow line `.impeccable/` to `.prettierignore` (the same
  pattern already used for the tool-owned `.claude-logs/`). That exempts one tool-owned
  directory and leaves every other check as it was.
- **Coexistence with session logging.** Claude Code: yes. Plugin hooks and project hooks
  are separate commands that run independently; our logger runs on `UserPromptSubmit`
  and `Stop`, writes a file and prints nothing; Impeccable's `Stop` hook can return
  context to the agent. Neither reads the other's state. Codex: Impeccable's plugin does
  not register for Codex. `npx impeccable install` would write `.codex/hooks.json`; if it
  rewrites the file, our logging hooks could be altered, and **any change to
  `.codex/hooks.json` invalidates Codex's hash-based trust**, forcing every developer to
  review it again in `/hooks`. Keep the two out of the same file or verify the merge in a
  scratch copy first.

## 6. Risks and required owner approvals

| Risk                                                                         | Where  | Needed from the owner                                                                  |
| ---------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Personal email already public in a log and in commit metadata                | 2.6    | Decide on 2.8 steps 1, 2, 5                                                            |
| Internal logs are published by default on a public repo                      | 2.5, 3 | Choose: private repo, or stop committing logs and archive privately                    |
| Redaction cannot protect personal or business data                           | 2.3    | Accept for internal use; require stronger client-side review for product digests (1.5) |
| Logger shipped to strangers would commit prompts                             | 1.6    | Approve the safe default                                                               |
| Two competing design pipelines                                               | 4      | Pick one for Dojo (Impeccable recommended, already wired)                              |
| Hallmark implicit invocation and `DESIGN.md` lock                            | 4      | Retain unused, or remove                                                               |
| `.impeccable/` shared config fails Prettier; local config not shared-ignored | 5      | Approve the `.prettierignore` and `.gitignore` lines                                   |
| Changing `.codex/hooks.json` re-triggers Codex trust review                  | 5      | Keep the Impeccable installer out of it                                                |
| Decisions 1.1–1.12                                                           | 1      | Approve, amend or reject each with the wording given                                   |

## 7. What was and was not verified in this phase

Verified: git history and ignore rules; category counts in both logs; redaction probe
results; Hallmark file inventory and static scan; Impeccable config contents and
exclusion state; the project hook files are unchanged. **Not verified:** the Impeccable
hook firing in a real fresh session; Hallmark's scripts' runtime behaviour (not
executed); the largest Hallmark script beyond a pattern scan; GitHub-side effects of the
remediation steps.
