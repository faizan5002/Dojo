# Secrets

A credential belongs in an environment variable, read once through
`src/lib/env.ts` — never hardcoded in source, and never committed. `.gitignore`
blocks every `.env*` file except `.env.example`, so the files themselves can't
land in git. The hole this rule closes is the one an agent opens: a session
transcript is committed verbatim to `.claude-logs/` or `.codex-logs/` (see
below), and a real `DATABASE_URL`, Supabase secret key or `Authorization`
header that scrolled past during the session rides along into history.

## The scanner is a backstop, not a licence

`scripts/check-secrets.mjs` greps text for credential shapes and refuses the
commit. Two enforcement points, one implementation — the same shape as
`scripts/check-commit-message.mjs`:

- **`.githooks/pre-commit`** runs it over the staged blobs of every commit, so
  a secret is caught before it is even written to history.
- **CI's `check:secrets` job** re-runs it over every tracked file, so a secret
  committed with `git commit --no-verify`, or one that landed before the hook
  existed, still fails the branch.

It flags connection strings with an inline password, provider-format keys
(AWS, GitHub, Slack, Stripe, Google, OpenAI/Anthropic, SendGrid), Supabase
`sb_secret_…` keys, JWTs (a legacy Supabase anon or service-role key is one),
`Authorization` header values, PEM
private keys, and a high-entropy value assigned to a credential-named key
(`API_KEY=…`). It deliberately allows the placeholder shapes the repo carries
on purpose — `postgresql://user:password@host`, `Bearer $CRON_SECRET`,
`sk-…` written as prose, a path assigned to a field that names a storage
location (`videoObjectKey = 'clips/123.mp4'` — a credential-named field like
`API_KEY` never gets that exemption, whatever its value looks like), and a
presigned `X-Amz-Signature` (a per-request HMAC, not a reusable credential —
the access key id beside it in `X-Amz-Credential` is still flagged). It does
not try to infer a fixture from words like `test`, `fake` or `value` in the
value: a staging password reads that way too. A deliberate fake says so with
`allowlist secret` on the line.

This is a backstop, exactly like `redact()` in the logger
(`docs/rules/logging.md`) — that one scrubs the same shapes out of structured
log fields at runtime; this one scans file text at commit time. Neither is
permission to handle a secret carelessly. Don't paste a live credential into a
transcript, a comment, a test fixture or a commit and lean on the scanner to
catch it. If one scrolled through a session you're about to log, redact it in
the transcript first — a transcript never needs the real value.

## When it fires on something that isn't a secret

Precision is tuned high (a false positive blocks a commit), but no scanner is
perfect. Two escape hatches, in order of preference:

1. Put `allowlist secret` in a comment on the line. Best for source and test
   fixtures, where the fake value is deliberate and the annotation documents
   that.
2. Add a glob to `.secretsallow` (one per line, `#` comments allowed) to skip a
   whole file. Use this only for a file that is all fixtures.

Reach for these only when the value genuinely is not a credential. The right
fix for a real one is to remove it, not to allowlist it.

## Session transcripts

`.claude-logs/` is tracked (`docs/DECISIONS.md`, 2026-11-02): a session's digest is
committed on the branch that ships its work, so `check:secrets` scans it at the
pre-commit hook and again in CI. Read a log before committing it: the scanner covers credential shapes, not private code, names or paths. In this repo
every agent writes to `.claude-logs/` (`docs/SESSION_LOGGING.md`); `.codex-logs/` is kept
because the template's checks and Prettier ignore still reference it. `pnpm check:standards` (`session-logs-tracked`)
enforces that the directories stay ignored and that no real log is tracked.
`scripts/session-log.mjs` redacts credentials before writing and runs this repo's
scanner over its own output — a backstop, not a guarantee of privacy and not
permission to paste a live credential or private code into a session.
