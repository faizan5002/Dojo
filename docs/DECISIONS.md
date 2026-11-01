# Decisions

Newest first. Add an entry when you make a choice a future agent could not
infer from the code. One paragraph each: what, why, what would change it.

## 2026-11-01 — Git-using tests ignore hook-exported `GIT_*` variables

**Decision.** Tests that run git against a temporary repository take their environment
from `scripts/test-git-env.mjs` (`cleanGitEnv`, `withoutGitEnv`), which removes `GIT_*`.
`.githooks/pre-push` is unchanged and does not unset them.
**Why.** Git exports `GIT_DIR` to hooks when pushing from a linked worktree. The
session-log and check-standards tests ran `git init` and `git config` in temp directories
with that environment, so they rewrote the real repository's `core.bare`, `[user]` and
index. Fixing the tests keeps the hook's environment honest for commands that target the
real repo, and `scripts/test-git-env.test.mjs` fails if the isolation regresses.
**Revisit if** a test needs the inherited git environment on purpose.

## 2026-11-01 — LF line endings are enforced by `.gitattributes`

**Decision.** `.gitattributes` contains `* text=auto eol=lf`, and the tree was renormalised.
`core.autocrlf` is deliberately not changed in the shared repository config.
**Why.** On Windows with `core.autocrlf=true`, Prettier and the standards tests failed on
CRLF working files. A repository-level policy fixes it for everyone without a per-machine
setting. **Revisit if** a tool needs CRLF for a tracked file (add a per-path override).

## 2026-11-01 — The landing page is an adapted Kage page, not a port of the spec

**Decision.** The first public page embeds the Kage landing page from
`@designcodeio/threeui` 1.2.0, adapted by `scripts/adapt-kage-landing.mjs` (hash-checked,
exact-once replacements) with Dojo's copy, a dot mark and six skills. It is shown in an
iframe by `src/features/landing/kage-landing.tsx`. This supersedes the 2026-10-30 entry
"Landing page: build it inside Next.js, not as static HTML".
**Why.** The team chose that visual direction; adapting a verified source with a
reproducible script keeps provenance and avoids hand-editing vendored code. The copy says
the coaching loop is still being built and invents no customers, numbers or logos.
**Revisit if** the page needs real interactivity with the app (the iframe isolates it).

## 2026-11-01 — The historical session-log deletion is intentional

**Decision (owner-approved).** `af75f14` removes the one historical log from tracking and it
stays removed. The history decision (rewrite or recreate) remains open
(`docs/PUBLISHED_LOG_EXPOSURE.md`).

## 2026-10-30 (Phase 1D) — Standard aligned; historical log untracked; sharing prohibited (owner-approved)

**Decision (approved by the product owner).**

1. The `session-logs-tracked` standard enforces local-only logs: both `.claude-logs/` and
   `.codex-logs/` must be gitignored (checked even when the directory does not exist), no
   actual log may be tracked, `.gitkeep` placeholders may stay tracked, a directory that
   exists must be in `.prettierignore`, and neither directory is required to exist. The
   check id is unchanged for continuity.
2. The historical log (`.claude-logs/2026-10-29_15-37-18_d2eb4960-….md`, added in
   `2f2f925`) is removed from the current Git tree with `git rm --cached` on that one path.
   Its local copy is preserved and unchanged. Git history is **not** rewritten.
3. No session log is staged or committed automatically.
4. **Sharing a log, even a sanitized example, is prohibited until an approval process is
   documented.** This **supersedes the Phase 1C wording** that allowed an approved, sanitized
   example; that wording was replaced in every instruction file.
   **Status of the public exposure.** Not resolved. The deletion is staged locally, not yet
   merged; the commit stays reachable in history; copies may exist
   (`docs/PUBLISHED_LOG_EXPOSURE.md`, section 0). The history-rewrite / recreate decision is open.
   **Supersedes.** HANDOFF item 21 (the proposed patch is applied) and item 22 (answered: untrack).

## 2026-10-30 (Phase 1C) — Session logs are local-only (owner-approved)

**Decision (approved by the product owner).** `.claude-logs/` and `.codex-logs/` are
local-only by default. They are excluded through `.gitignore` (root and nested), never
automatically staged or committed, and never part of an ordinary commit. Only an
explicitly requested, fully read and sanitized example may be shared, as a separate file.
Redaction is not a privacy guarantee. Existing Git history is **not** rewritten without a
separate approval.
**Why.** Logs hold full prompts and answers plus name, email and GitHub login; the redactor
misses most personal and business data (`docs/PRODUCT_DECISIONS_REVIEW.md`), and the remote
is public. One log was already published (`docs/PUBLISHED_LOG_EXPOSURE.md`).
**What it supersedes.** The Phase 0 statements and the original guide's instruction that
logs are committed with the work, and `CLAUDE.md`'s "stage `.claude-logs/` before every push".
Agents of every kind (Claude Code, Codex, Cursor, Gemini, Qwen) follow the same rule.
**What it does not change.** Logger capture behaviour; the two `.gitkeep` files and the one
historical log stay tracked and unmodified; `.codex-logs/` and the Prettier ignore stay.
**Open consequence (needs an approval).** The template's `session-logs-tracked` standard
(`scripts/check-standards.mjs`, its tests and `docs/STANDARDS.md`) requires these directories
to be _not_ gitignored, so `pnpm check:standards` and one `check-standards` test now fail
on this policy. It is a CI gate, so it was not changed without approval; the proposed patch
is in `docs/HANDOFF.md` item 21.

## 2026-10-30 (Phase 0.5) — Review fixes to the logger

- **Repeated prompts**: an identical prompt after an answered turn ("continue")
  is a new turn; only a redelivery of an _unanswered_ prompt is dropped.
- **Codex multiple stops**: the latest `last_assistant_message` replaces the
  turn's response (Claude's transcript already holds the full answer, so there
  the payload only fills a gap).
- **`CLAUDE_PROJECT_DIR` is honoured for Claude only**: a Codex started inside a
  Claude Code terminal inherits it for another project and would write there.
- **`redactions:` is counted from the `[REDACTED…]` markers**, so a log grown
  across Codex hook runs keeps its total.
- **Redaction is linear-time**: the credential-name pattern caps its name length (a
  300 KB run of `key…` took 21 s before, 67 ms after; regression test added).
- **zstd is imported defensively** so a Node without it cannot stop the whole
  logger loading (Codex backfill then errors instead).
- Hook payloads are no longer mutated; multi-argument helpers take one object.

## 2026-10-30 (Phase 0.5) — Verification posture

Live evidence is claimed only where a real agent session produced it (Claude:
yes; Codex: no). Windows-only failures were classified, not suppressed; no check
was changed. Docker/WSL were unavailable, so Linux results remain pending.

## 2026-10-30 — Session logging is repo-local Node, not a per-user Python script

**Decision.** The logger is `scripts/session-log.mjs`, wired by tracked
`.claude/settings.json` and `.codex/hooks.json`. We did not install the
guide's `~/.claude/extract-log.py` or touch `~/.claude/settings.json`.
**Why.** The goal is that either developer's fresh agent logs identically
with no manual install. A user-level script needs per-machine setup (and on
Windows `python3` is often the Store stub). Node is already required, the
repo's tests are `node --test`, and the module can import
`scripts/check-secrets.mjs` so redaction is checked by the same rules CI uses.
**Revisit if** a developer wants logs for repos that do not carry the script.

## 2026-10-30 — `.claude-logs/` is the only log directory; `.codex-logs/` is vestigial

**Decision.** Codex also writes to `.claude-logs/`. `.codex-logs/.gitkeep` and
the template's references to `.codex-logs/` (`docs/rules/secrets.md`,
`scripts/check-secrets.mjs`, `scripts/check-standards.mjs`, `.prettierignore`)
are left in place: they are harmless, and `check:standards` accepts either.
**Why.** The team asked for one location (and the guide says so). The scanner
and Prettier ignore cover both directories, so nothing is unprotected.
**Revisit if** the template is re-synced; then drop `.codex-logs/` upstream.

## 2026-10-30 — Codex logs come from hook payloads, not the rollout file

**Decision.** In hook mode the Codex adapter uses `prompt` and
`last_assistant_message`; rollout parsing is manual backfill only.
**Why.** Codex documents the payloads and says the transcript format is not a
stable interface; 0.160 stores rollouts zstd-compressed. **Revisit if** Codex
documents a stable transcript contract.

## 2026-10-30 — `template-setup` has NOT been run; do not run it blindly

**State.** `package.json` is still `template-web`, `README.md` and
`messages/en.json` are still template copy, and `src/app/[locale]/page.tsx` is
the template page. The repo is an un-customized template with the first
logging commit on top.
**Decision.** Phase 0 did not run the skill: it renames the project and asks
product questions (internal vs external, accounts vs landing page, AI calls,
icon provider) that the two developers must answer first. **Next step:**
answer those in `docs/HANDOFF.md`, then run `template-setup` once, on a branch.

## 2026-10-30 — Landing page: build it inside Next.js, not as static HTML

**Decision (recommended, not yet implemented).** Port the supplied spec into
the existing Next 16 app as a Server Component page with two small client
islands (mobile menu, count-up). Full reasoning and open questions:
`docs/INITIAL_PRODUCT_SPEC_AUDIT.md`. No implementation has started.
