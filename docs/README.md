# Documentation

Back to the [project README](../README.md).

Start with the section that matches what you are doing. Documents marked _living_ describe the current state and are kept up to date; documents marked _record_ capture a decision or an audit at a point in time and are not rewritten when things move on.

## Understand the project

| Document                                   | Kind   | What it covers                                                                           |
| ------------------------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| [`../PRODUCT.md`](../PRODUCT.md)           | living | The approved product record: users, purpose, positioning, principles, evidence on hand.  |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | living | What Dojo is, what exists today, the architecture at a glance, how to run and test.      |
| [`STATUS.md`](STATUS.md)                   | living | What is implemented, what is verified, what is not, and the known limitations.           |
| [`HANDOFF.md`](HANDOFF.md)                 | living | The baton between the two developers: who is doing what, and the decisions still needed. |
| [`DECISIONS.md`](DECISIONS.md)             | living | Choices a future reader could not infer from the code, newest first.                     |
| [`../DESIGN.md`](../DESIGN.md)             | living | Design-token and component conventions.                                                  |

## Build and run it

| Document                                                                         | What it covers                                                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`DEVELOPMENT.md`](DEVELOPMENT.md)                                               | Prerequisites, first run, every command, Git hooks, Windows notes, troubleshooting. |
| [`ENVIRONMENT.md`](ENVIRONMENT.md)                                               | Every environment variable, what is required, and where each one lives.             |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                                             | How the app is structured: request flow, routes, the landing page, data, logger.    |
| [`TESTING.md`](TESTING.md)                                                       | Test commands, what is covered, writing git-using tests safely, the quality gates.  |
| [`CI_CD_SETUP.md`](CI_CD_SETUP.md)                                               | GitHub secrets and environments and Vercel settings needed for CI and deployment.   |
| [`rules/deployment.md`](rules/deployment.md)                                     | Why nothing is deployed by hand, and what CI/CD does instead.                       |
| [`../public/landing-pages/ADAPTATION.md`](../public/landing-pages/ADAPTATION.md) | How the landing page was adapted from its source, with file hashes.                 |

## Work on it with others

| Document                                             | What it covers                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md)           | The short contributor guide.                                                                         |
| [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) | Two developers, two agents: branching, claiming files, handing work over.                            |
| [`../AGENTS.md`](../AGENTS.md)                       | The rules every coding agent reads first. `CLAUDE.md`, `GEMINI.md` and `QWEN.md` point to it.        |
| [`rules/`](rules)                                    | One file per engineering rule (database, migrations, auth, errors, logging, SEO, commits, and more). |
| [`STANDARDS.md`](STANDARDS.md)                       | The checklist of standards the repository carries, and `pnpm check:standards`, which proves each.    |
| [`SESSION_LOGGING.md`](SESSION_LOGGING.md)           | How agent sessions are logged locally, what is and is not recorded, and the privacy policy.          |
| [`../SECURITY.md`](../SECURITY.md)                   | How to report a vulnerability, and how the repository handles secrets.                               |

## Planning and audit records

These explain how decisions were reached. They are not instructions, and parts of them have since been overtaken by events; each begins with a note saying what has changed.

| Document                                                           | What it records                                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [`FIRST_PUBLIC_EXPERIENCE.md`](FIRST_PUBLIC_EXPERIENCE.md)         | The shaping brief for the first public release, with options and recommendations.        |
| [`INITIAL_PRODUCT_SPEC_AUDIT.md`](INITIAL_PRODUCT_SPEC_AUDIT.md)   | The audit of the first landing-page specification against the repository.                |
| [`PRODUCT_DECISIONS_REVIEW.md`](PRODUCT_DECISIONS_REVIEW.md)       | A review of product decisions, privacy risks and tooling.                                |
| [`PUBLISHED_LOG_EXPOSURE.md`](PUBLISHED_LOG_EXPOSURE.md)           | A report on a session log that was published in Git history, and the options considered. |
| [`../agent-session-logs-setup.md`](../agent-session-logs-setup.md) | The original session-logging guide, kept as a historical spec. Superseded in places.     |

## Conventions for these documents

- Treat the code as the source of truth. If a document and the code disagree, fix the document.
- Do not document planned work as implemented. Mark undecided things as undecided.
- Keep one home for each fact and link to it rather than copying it.
- Do not paste session logs, secrets or personal information into any document.
- Format with Prettier (`pnpm exec prettier --write <file>`); `pnpm format:check` covers Markdown.
