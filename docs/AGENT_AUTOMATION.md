# Agent automation

**Status: designed, not operational.** Nothing in this document runs today. The only AI automation that exists in this repository is [`claude-code-review.yml`](../.github/workflows/claude-code-review.yml), a read-only review comment on pull requests that stays inert until the repository owner adds a secret. The multi-agent workflow below is a design, with one inactive template, for the owners to approve and enable by hand.

## What triggers what

GitHub Actions only runs on events that reach GitHub. A local `git pull` triggers nothing. An agent workflow can start from:

| Trigger                                                | Use                                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `pull_request` (opened, synchronize, ready_for_review) | Review the diff of a PR. The only trigger proposed for automatic runs.     |
| `workflow_dispatch`                                    | A person starts a specific role on a specific branch from the Actions tab. |
| `push` to an agreed development branch                 | Possible, but every push would spend money; not proposed.                  |

Forks receive no secrets, so PRs from forks skip agent jobs.

## Roles

Each role is a separate job with its own prompt, a narrow tool allowlist and a read-only checkout unless stated. Roles comment on the PR; none merges, pushes to `main` or deploys.

| Role                   | Looks at                                                                                  | May do  |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------- |
| Product / UX           | Screens and copy against [`../PRODUCT.md`](../PRODUCT.md), [`../DESIGN.md`](../DESIGN.md) | Comment |
| Frontend               | `src/app`, `src/features/*/ui`, accessibility, React rules                                | Comment |
| Backend / architecture | `src/server`, Prisma schema, [`FUTURE_ARCHITECTURE.md`](FUTURE_ARCHITECTURE.md)           | Comment |
| Testing / QA           | Whether changed flows have unit and Playwright coverage                                   | Comment |
| Security               | Auth, ownership scoping, secrets, dev-mode guards                                         | Comment |
| Documentation          | Docs that the change makes stale                                                          | Comment |
| Integration reviewer   | The other roles' comments, de-duplicated, ranked, one summary                             | Comment |

An implementing agent (writing code) is a different, higher-risk activity and is out of scope here; it would run from a person's machine on its own branch, as today.

## Orchestration rules

1. Every task is scoped, with acceptance criteria, before an agent starts.
2. No two agents work on the same files. Implementing agents each get their own branch or worktree.
3. No agent commits to `main`, merges its own PR or any PR, or deploys.
4. No destructive database operation, no change to auth or security policy, no change to `.githooks`, workflows or branch protection by an agent.
5. No unbounded loops: each job has `timeout-minutes`, a `--max-turns` limit and a concurrency group that cancels superseded runs. Spend is bounded by the account behind the token (set a usage cap there).
6. A human approves: findings are comments, a person decides what to act on, and a person merges after all CI checks pass ([`../AGENTS.md`](../AGENTS.md), "Merging").
7. Logs never contain secrets. Agent jobs get no repository secrets other than the single model credential, and no database or Supabase credentials.

## What is needed to turn it on

None of this is configured, and none of it can be created from the repository.

| Item               | Detail                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A model credential | Repository secret `CLAUDE_CODE_OAUTH_TOKEN` (a Claude subscription token), or an Anthropic API key stored as `ANTHROPIC_API_KEY`. Created and added by the repository owner under Settings, Secrets and variables, Actions. |
| Billing            | A subscription token spends the owner's plan limits; an API key bills per token. Agree who pays and set a cap before enabling.                                                                                              |
| GitHub permissions | Workflow `permissions` of `contents: read` and `pull-requests: write`. `id-token: write` is only for the Claude GitHub App's token exchange. The owner must install the Claude GitHub App on the repository.                |
| Approval           | The owner reviews the final workflow file and prompts, then copies the template into `.github/workflows/`. Workflow changes are reviewed like code.                                                                         |

If the credential is absent, the template's first step detects it and the jobs skip without failing, as `claude-code-review.yml` does today.

## The inactive template

[`agents/pr-agent-review.workflow.yml.example`](agents/pr-agent-review.workflow.yml.example) is a complete workflow for the role matrix above, stored outside `.github/workflows/` so GitHub never runs it. It follows the existing review workflow: the action is pinned to a commit, a presence check gates every later step, draft and fork PRs are skipped, tools are limited to read-only git commands, and `continue-on-error` keeps an outage from turning a PR red.

To enable it, the owner would:

1. Add the secret and install the GitHub App.
2. Copy the file to `.github/workflows/pr-agent-review.yml` in a PR of its own and review it.
3. Merge that PR. The first run will be on the next PR.

## What is verified and what is not

- Verified: the template is valid YAML, passes the repository's formatting check, and mirrors the structure of the working review workflow.
- Not verified: any run. The template has never executed, because there is no credential, and it should be treated as a draft until a first run is observed on a throwaway PR.
- Not claimed: that agents are operational, that they will find real defects, or what they would cost.
