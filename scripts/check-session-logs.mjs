#!/usr/bin/env node
// Pre-push guard: refuses a push while a session log is modified or untracked,
// so the log of the work being pushed travels with it (docs/SESSION_LOGGING.md,
// "Commit policy"). Only the log directories are looked at: any other
// uncommitted file is none of this check's business.
//
//   node scripts/check-session-logs.mjs [--cwd <dir>]
//
// Exit 0: nothing pending. Exit 1: logs pending, with the fix printed.

import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const LOG_DIRS = ['.claude-logs', '.codex-logs']

/**
 * The pending log paths in `git status --porcelain` output: modified, added,
 * deleted or untracked `.md` files under a log directory.
 */
export function pendingLogs(porcelain) {
	return (
		String(porcelain)
			.split('\n')
			.filter((line) => line.trim() !== '')
			.map((line) => ({
				state: line.slice(0, 2),
				// A rename reads "old -> new"; the new path is the one that matters.
				path: line.slice(3).split(' -> ').pop().replace(/^"|"$/g, '')
			}))
			// Only `.md` logs: the logger's in-flight `<log>.md.<pid>.tmp` files are not logs.
			.filter(
				({ path }) => LOG_DIRS.some((dir) => path.startsWith(`${dir}/`)) && path.endsWith('.md')
			)
	)
}

export function checkSessionLogs({ cwd = process.cwd(), env = process.env } = {}) {
	const result = spawnSync(
		'git',
		['status', '--porcelain=v1', '--untracked-files=all', '--', ...LOG_DIRS],
		{ cwd, env, encoding: 'utf8', windowsHide: true }
	)
	if (result.status !== 0) {
		return { ok: false, pending: [], error: (result.stderr || 'git status failed').trim() }
	}
	const pending = pendingLogs(result.stdout)
	return { ok: pending.length === 0, pending }
}

export function message(pending) {
	const describe = (state) =>
		state === '??' ? 'untracked' : state.includes('D') ? 'deleted' : 'modified'
	return [
		'  ✗ session logs are not committed:',
		...pending.map(({ state, path }) => `      ${describe(state).padEnd(9)}  ${path}`),
		'',
		'  The log of the work you are pushing goes with it, in its own commit (docs/SESSION_LOGGING.md).',
		'  Read the log first: it holds full prompts and answers. Then:',
		'',
		'      node scripts/check-secrets.mjs .claude-logs/*.md',
		'      git add .claude-logs .codex-logs',
		'      git commit -m "chore(logs): update the session log before pushing" -m "Changelog: None"',
		'',
		'  and push again. A log of a throwaway test session can be deleted instead.'
	].join('\n')
}

function main() {
	const at = process.argv.indexOf('--cwd')
	const cwd = at === -1 ? process.cwd() : process.argv[at + 1]
	const result = checkSessionLogs({ cwd })
	if (result.error) {
		console.error(`  ✗ could not read git status for the session logs: ${result.error}`)
		process.exit(1)
	}
	if (!result.ok) {
		console.error(message(result.pending))
		process.exit(1)
	}
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) main()
