# Published session-log exposure

Report only. **Nothing here has been done:** no history rewrite, no deletion, no
force-push, no GitHub request, and the historical log is byte-for-byte unchanged. The
personal information itself is deliberately not reproduced; this report names categories
and counts. Facts were checked on 2026-10-30.

## 0. Status by layer (updated in Phase 1D)

The exposure is **not resolved**. It exists in four layers, and only the first has changed:

| Layer                                        | State                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. The working copy's index** (this clone) | **Removed, staged, not committed.** The owner approved `git rm --cached` on the one log; it is now a staged deletion. The local file still exists and is byte-identical (same SHA-256 before and after). The two `.gitkeep` placeholders remain tracked.                                        |
| **B. The public `main` branch today**        | **Still present.** Nothing has been committed or pushed, so the repository on GitHub still serves the file at the head of `main` until a commit containing the deletion is merged there.                                                                                                        |
| **C. Git history**                           | **Still present, permanently, by decision.** Commit `2f2f925` still contains the file and the personal email in its author fields. History has **not** been rewritten (separate owner decision, still open). Even after the deletion is merged, anyone can read the file at that commit by SHA. |
| **D. Caches and copies elsewhere**           | **Unknown and not removable by us.** Clones taken since 2026-10-29, crawlers, search or code-search caches, and GitHub's cached views of old commits. 0 forks at last check.                                                                                                                    |

So: the deletion (A, once merged: B) stops the file being served from the current tree
and from new clones' working files. It does nothing for C or D. The history-rewrite and
repository-recreation options in section 6 remain open for the repository owner.

## 1. What was published

| Item                     | Value                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Repository               | `faizan5002/Dojo` — **public**                                                     |
| Commit                   | `2f2f925` ("setup with template and code claude logs done"), authored 2026-10-29   |
| Path                     | `.claude-logs/2026-10-29_15-37-18_d2eb4960-aee9-437f-866f-e67e47fcbacb.md`         |
| Size                     | 95 added lines, about 4.6 KB; one short Claude Code session (2 prompts, 2 answers) |
| Introduced in            | only that commit; the log has never been modified since                            |
| Branches / tags / PRs    | one branch (`main`), no tags, no pull requests                                     |
| Forks / stars / watchers | 0 / 0 / 0 at the time of checking                                                  |
| Repository age           | created 2026-10-29 10:19Z, last pushed 10:40Z                                      |

## 2. Categories of personal information exposed

In the **log file** (counted, not quoted):

1. **One personal email address**, in the `git_email` field. The field exists because the
   original guide asks for it.
2. **A GitHub handle** in the `author` field (the owner's public handle; low sensitivity).
3. **Two Windows local-path fragments** that include a local account name, from IDE
   context quoted in a prompt.
4. The **project folder name**, the **times of day** the owner was working (UTC
   timestamps), and the **prompts and answers** of one short session (tooling setup;
   no credentials were found by the repository's secret scanner or by manual category
   counts: 0 other emails, 0 IP addresses, 0 URLs).

In the **commit metadata**, independent of the log: the commit's author and committer
fields carry the **same personal email address**, and its date carries the owner's
**timezone offset**. The first commit uses the GitHub no-reply address, so the repo
shows two different identities for one person.

Conclusion: the one meaningful item is the personal email address, and it appears in
**two places** (the log's content, and the commit's author fields). Everything else is low
sensitivity.

## 3. Is it still accessible?

Yes, in three ways:

- **Current tree.** The file is served at the head of `main`: the GitHub contents API
  returns it and the raw file URL answers HTTP 200.
- **History.** Commit `2f2f925` and its diff are reachable by SHA.
- **Clones.** Anyone who cloned or fetched since 2026-10-29 holds a full copy of both
  commits. The repo shows 0 forks, but clones, crawlers and caches are not visible to us.

## 4. Would a normal deletion commit be enough?

It depends on what "remediation" is meant to achieve.

- **Sufficient for:** removing the file from the current tree, so it no longer appears in
  the repo browser, search or the raw URL at `main`. It is cheap, safe, reversible, needs
  no coordination, and is a normal commit (`git rm` plus commit).
- **Not sufficient for:** removing the information. The deleted file and its blob stay in
  history and remain readable at the old commit; and the **email stays in commit
  `2f2f925`'s author and committer fields** whatever happens to the file. A deletion commit
  also adds a new commit that is easy to see in history.

## 5. Is history rewriting necessary for complete removal?

Yes, for **complete removal on this repository's history**, and it must cover both places:
dropping the log's blob from history **and** rewriting the author/committer email of
`2f2f925` (and therefore the SHA of every commit after it). Even then:

- GitHub keeps commits reachable by direct SHA and in cached views until its garbage
  collection; removal from those needs a request to GitHub Support (its sensitive-data
  guidance), not just a force-push.
- Existing clones and anything copied by third parties cannot be recalled.
- Every clone, including the developers' local copies and any branch, must be
  discarded or re-created from the rewritten history. The "never force-push a shared
  branch" rule would be broken on purpose, so this needs separate, explicit approval.

Timing matters: the repo is about one day old with two commits, one branch, no PRs and no
forks, so the cost of a rewrite is as low as it will ever be. It grows with every clone,
branch and PR.

## 6. Options (for the owner; none executed)

| #   | Option                                                                                                                                     | Removes from HEAD | Removes from history | Removes the commit-metadata email | Cost / risk                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | :---------------: | :------------------: | :-------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Do nothing                                                                                                                                 |        no         |          no          |                no                 | None. The email stays public.                                                                                                             |
| B   | Fix going forward only: both developers use the GitHub no-reply address; enable GitHub's email privacy settings                            |        no         |          no          |                no                 | Config only. Stops further leaks. Recommended in any case.                                                                                |
| C   | Deletion commit for the log (`git rm --cached` or `git rm`, normal commit)                                                                 |        yes        |          no          |                no                 | Safe. Leaves the file and email in history.                                                                                               |
| D   | Rewrite history (drop the log from history, rewrite the author email) and force-push `main`, then ask GitHub Support to purge cached views |        yes        |         yes          |                yes                | Destructive and owner-only. Breaks every existing clone; no recall of copies already taken.                                               |
| E   | Delete the GitHub repository and recreate it from a cleaned local history                                                                  |        yes        |   yes (on GitHub)    |          yes (on GitHub)          | Simplest complete removal for a 2-commit repo with no issues, PRs or forks; loses repo settings, stars, links; same non-recall of copies. |

REC (not approved): **B now**, plus **C or D/E depending on how much the owner cares about
the email being public**. If the answer is "it matters", prefer D or E soon, before more
collaborators and branches accumulate. Do **not** rotate any credential: none was found.

## 7. What each approval would unlock

- **B:** each developer runs `git config user.email <their GitHub no-reply address>` in
  their clone (or globally) and turns on GitHub's "keep my email addresses private" and
  "block command line pushes that expose my email". No repository change.
- **C:** one normal commit removing the file from tracking and the tree. Because the logs
  are now gitignored, the file will not return.
- **D:** a written plan with a freeze on pushes, a fresh mirror clone, a rewrite that
  removes the log path and rewrites the one author email, verification, a force-push,
  a GitHub Support request, and re-cloning by both developers. I would prepare and show
  the exact commands first.
- **E:** a clean local history prepared and reviewed, the repository deleted and recreated
  by its owner, and both developers re-cloning.

## 8. Required approval

The owner (`faizan5002`) decides: whether the exposure needs remediation at all, and
which of B, C, D, E. D and E can only be performed by someone with admin rights on the
repository (the current machine's account has push rights but not admin).
