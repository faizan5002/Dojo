# Session logging

Every Claude Code and Codex session in this repo writes a clean digest of
itself to **`.claude-logs/`**. The logs are **local-only**: gitignored, never staged or
committed automatically, and not part of ordinary commits (see "Privacy policy" below).
One directory and one format for every agent. Source spec:
`agent-session-logs-setup.md`; implementation: `scripts/session-log.mjs`.

## What is and is not recorded

| Recorded                                                       | Never recorded                                        |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| Your prompts                                                   | Tool calls and tool results, file reads and diffs     |
| The agent's **final** answer for each turn                     | Narration between tool calls ("Let me look at…")      |
| Session id, date, project                                      | Thinking / reasoning, sidechain (subagent) output     |
| Git author name + email, GitHub login (when `gh` is signed in) | Injected context (`<system-reminder>`, IDE tags, env) |
| Session statistics (counts, lengths, durations)                | Credentials: redacted before the file is written      |

Files are named `<UTC first-prompt time>_<session-id>.md`. A session rewrites
its own file on every prompt and every stop, so there is one file per session
and no duplicates. Format: YAML frontmatter, then `[CLAUDE_LOG_ENTRY
type=PROMPT|RESPONSE num=N session=ID]` blocks. Claude and Codex logs share
the schema; the `agent:` field says which wrote it.

Logs go to the **git root** of the session (`$CLAUDE_PROJECT_DIR`, else the
nearest ancestor with `.git`), even if the agent was started in a subfolder.

## How it is wired

|        | Claude Code                                                      | Codex                                                                      |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Config | `.claude/settings.json` (tracked, project hooks)                 | `.codex/hooks.json` (tracked, project hooks)                               |
| Events | `UserPromptSubmit`, `Stop`                                       | `UserPromptSubmit`, `Stop`                                                 |
| Source | The transcript JSONL named in the hook's `transcript_path`       | The hook payloads (`prompt`, `last_assistant_message`) — see "Codex" below |
| Needs  | Trusting the workspace the first time Claude Code opens the repo | Trusting the project **and** reviewing the hooks once with `/hooks`        |

Both run `node scripts/session-log.mjs <agent>`: Node only (the repo already
requires Node >= 22.18), no Python, no per-user install. The hooks live in the
repo, so the second developer gets them from `git pull` — nothing to copy into
`~/.claude/`. The guide's user-level `~/.claude/extract-log.py` is
deliberately **not** used (see `docs/DECISIONS.md`). If you installed that
script and its user-level hooks on your machine, remove them or each prompt
is logged twice (harmlessly, to the same file, but wastefully).

The logger can never break your session: every failure is swallowed and the
process exits 0 (exit code 2 would block a prompt).

### Claude Code details

The parser was written against the transcript format of the installed
version, not the guide's example. Differences that matter: one JSONL line per
content block; narration before a tool call has `stop_reason: "tool_use"` and
is dropped; user prompts can be a string **or** a list of text blocks (the
guide's parser dropped list prompts, e.g. anything with a pasted image);
`isSidechain`/`isMeta` entries are skipped; the session is identified by the
hook's `session_id`/`transcript_path` rather than "newest file in the folder"
(which mis-attributes when two sessions run at once). If the transcript lags
behind the hook, the hook payload's `prompt` / `last_assistant_message` fill
the gap.

### Codex details

Codex's hooks docs say the transcript format "isn't a stable interface for
hooks and may change", and on the installed version (0.160) rollouts are
stored zstd-compressed under `~/.codex/sessions/`. So the hook path does not
parse the rollout; it accumulates prompts and final answers from the
documented hook payloads onto the session's own log file. The rollout reader
(`parseCodexRollout`) exists for **manual backfill**:

```bash
node scripts/session-log.mjs codex --transcript ~/.codex/sessions/2026/10/04/rollout-….jsonl.zst
```

It reads `UserMessage` items as prompts and `final_answer` messages (falling
back to `task_complete.last_agent_message`) as responses; `commentary`, tool
calls, tool outputs and reasoning are dropped.

Limits to know about:

- Codex has no session-end hook that is useful here, so a log is current as of
  the last `Stop`. An interrupted turn leaves a prompt with no response.
- Hook trust is per-machine and per-hook-hash: **each developer must run
  `/hooks` in Codex once** to review and trust the two hooks (and again if
  `.codex/hooks.json` changes). Until then Codex skips them. In `codex exec` no warning was shown
  (observed on 0.160); the docs say the interactive CLI prints a startup notice. Project hooks also require the project to be trusted.
- A session started on one machine and continued on another will only contain
  what the hooks saw.

## Secrets

`redact()` runs on every prompt and response before anything is written:

1. Span rewrites for known shapes — PEM private keys, AWS / GitHub / Slack /
   Stripe / OpenAI / Anthropic / Google / SendGrid / Supabase / PostHog / npm
   tokens, JWTs, `proto://user:PASSWORD@host`, `Bearer`/`Basic` values, and
   credential-named assignments (`API_KEY=…`, `"password": "…"`). References
   such as `$CRON_SECRET` or `process.env.X` are left alone.
2. The repo's own scanner (`scripts/check-secrets.mjs`, unchanged) is run over
   the result; any line it still flags is replaced wholesale with
   `[REDACTED LINE: possible <rule>]`. A log this script writes therefore cannot
   fail `pnpm check:secrets`.

The count is recorded as `redactions:` in the frontmatter. It is a backstop, as
`docs/rules/secrets.md` says: do not paste live credentials into a session.
The log carries attribution (name, email, GitHub login) because the spec asks for it.
That is one more reason a log is never published as it stands.

## Attribution

`author` = `$CLAUDE_AUTHOR`, else `git config user.name`. `git_email` =
`git config user.email`. `github_user` = `$GITHUB_USER`, else the login
already recorded in the session's log, else `git config github.user`, else
`gh api user`. Missing or signed-out `gh` yields `unknown` and nothing else
changes. If the hook shell cannot see `gh` (it happened in the Claude desktop
app), run `git config --global github.user <your-login>` once.

## Privacy policy (approved)

`.claude-logs/` and `.codex-logs/` are **local-only by default**.

- Both directories are in `.gitignore`, at the root and nested. New logs never show up
  in `git status`.
- Nothing stages, commits or pushes a log: not the hooks, not `/cicd`, not any skill.
  Agents must never stage one, never `git add -f` one, and never include one in an
  ordinary commit. If `git status` ever lists a log, stop and tell the developer.
- A log holds full prompts and answers. It can contain private code, names, emails,
  paths and hostnames. Redaction is a pattern backstop (it misses most of those) and
  **does not make a log private or safe to publish**.
- **Sharing is prohibited.** Not even a sanitized example may be shared until the
  owner documents an approval process (who approves, where reviewed examples live, what
  review is required). Until then a log never leaves the machine it was written on.
- Do not edit logs by hand.
- The `session-logs-tracked` standard (`pnpm check:standards`) enforces this: both
  directories must be gitignored (whether or not they exist yet), no actual log may be
  tracked (a `.gitkeep` placeholder may), and a directory that exists must be in
  `.prettierignore`.
- **Historical log.** The one log committed before this policy
  (`.claude-logs/2026-10-29_15-37-18_d2eb4960-….md`) was removed from the current Git
  tree with `git rm --cached`, in the same change as this policy. The file still exists
  locally and is unchanged. It is **still present in Git history** (commit `2f2f925`), and
  history has not been rewritten: see `docs/PUBLISHED_LOG_EXPOSURE.md`. The two
  `.gitkeep` placeholders stay tracked.
- Product-facing user digests are a different matter with their own rules
  (`docs/PRODUCT_DECISIONS_REVIEW.md`, section 3).

## Known limitations

- **Codex only logs what its hooks saw**, and only after the hooks are trusted
  (below). A session continued on another machine, or run before trust, is not
  back-filled automatically; use `--transcript` for that.
- **A Codex turn that stops more than once** (a Stop hook continues it) keeps the
  latest final message only.
- **Two hooks of the _same_ session running at the same instant** could lose one
  update (read-modify-write on the Codex path). The agents fire them
  sequentially, so this has not been observed. Different sessions never share a
  file.
- **`/resume` or `/clear` in Claude Code** can start a new session id; the
  earlier part of the conversation may then appear in two log files.
- **The hook runs through your shell.** Claude Code uses Git Bash on Windows (the
  default when Git for Windows is installed); `$CLAUDE_PROJECT_DIR` is not
  expanded by PowerShell, so a machine without Git Bash logs nothing (the hook
  fails visibly but does not block the prompt). Codex's command resolves the git
  root itself and works in PowerShell and POSIX shells.
- **`github_user` can be `unknown`** if the hook's shell cannot run `gh`. Fix:
  `git config --global github.user <your-login>`.
- First-prompt latency: the very first hook of a session may spend up to ~2 s
  asking `gh` who you are; later runs reuse the answer.
- Log files grow with the conversation and are rewritten each turn.

## Manual verification (each developer, once per machine)

The automated tests (`pnpm test`) prove the parsing, redaction and file handling
with fixtures; they cannot prove your agent actually calls the hooks. Do this
once after pulling.

Same test for either agent (about two minutes). Start the agent at the repo root:
starting it in a subfolder is covered by unit tests of the logger only, and whether
each agent still finds the project hooks from a subfolder has not been tested.

1. `git pull && pnpm install`, then `cd` to the repo root.
2. Start the agent there.
   - **Claude Code:** accept the workspace-trust prompt (project hooks are held back
     until you do).
   - **Codex:** accept the project-trust prompt, then run `/hooks` and review and
     trust the two hooks from `.codex/hooks.json` (`UserPromptSubmit`, `Stop`).
     Without this approval Codex skips the hooks and nothing is logged. Do not use
     `--dangerously-bypass-hook-trust`.
3. Turn 1: `Run echo hello in the shell, then reply with exactly: LOG OK 1`
4. Turn 2 (same session): `Reply with exactly: LOG OK 2. My test token is ghp_`
   followed by 36 random letters and digits you type yourself.
5. Check the newest file in **`<repo root>`/.claude-logs/** (and that no other
   `.claude-logs/` or `.codex-logs/` file appeared):
   - exactly one new file for the session, with 2 `PROMPT` and 2 `RESPONSE`
     entries, `agent: claude` or `codex`, your own author and login;
   - the responses are only `LOG OK 1` and `LOG OK 2` — no `hello` command output, no
     "let me run…" narration, no tool call text;
   - your token appears nowhere; the prompt shows `[REDACTED:github-token]` and
     `redactions:` is at least 1;
   - `node scripts/check-secrets.mjs .claude-logs/*.md` prints nothing.
6. The test log stays local (it is gitignored); delete it if you like. It is never committed.

On the machine that did Phase 0, `codex exec` could not complete this test:
the model in `~/.codex/config.toml` (`gpt-6.1-sol`) is rejected for the
signed-in ChatGPT account, and shell tool execution failed in the Windows
sandbox (`CreateProcessWithLogonW failed: 267`; `codex doctor` reports the
elevated sandbox as incompletely provisioned). Those are local Codex setup
issues, not logger issues.

## Run the automated checks

```bash
node --test scripts/session-log.test.mjs     # 31 logger tests
pnpm test                                    # whole suite
node scripts/check-secrets.mjs .claude-logs/*.md
```
