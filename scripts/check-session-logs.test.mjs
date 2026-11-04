import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSessionLogs, message, pendingLogs } from './check-session-logs.mjs'
import { cleanGitEnv } from './test-git-env.mjs'

const SCRIPT = fileURLToPath(new URL('./check-session-logs.mjs', import.meta.url))
const HOOK = fileURLToPath(new URL('../.githooks/pre-push', import.meta.url))

function tempRepo() {
	const repo = mkdtempSync(join(tmpdir(), 'check-session-logs-'))
	const git = (...args) => {
		const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: cleanGitEnv() })
		assert.equal(result.status, 0, result.stderr)
	}
	git('init', '-q')
	git('config', 'user.name', 'Test')
	git('config', 'user.email', 'test@example.com')
	git('config', 'commit.gpgsign', 'false')
	mkdirSync(join(repo, '.claude-logs'))
	writeFileSync(join(repo, '.claude-logs', '.gitkeep'), '')
	writeFileSync(join(repo, 'app.ts'), 'export {}\n')
	git('add', '.')
	git('commit', '-q', '--no-verify', '-m', 'init')
	return { repo, git }
}

const run = (repo) =>
	spawnSync(process.execPath, [SCRIPT, '--cwd', repo], { encoding: 'utf8', env: cleanGitEnv() })

test('pendingLogs picks out session logs only, in any state', () => {
	const porcelain = [
		' M .claude-logs/2026-11-04_08-00-00_a.md',
		'?? .claude-logs/2026-11-04_09-00-00_b.md',
		'A  .codex-logs/2026-11-04_10-00-00_c.md',
		' D .claude-logs/2026-11-01_10-00-00_d.md',
		'R  .claude-logs/old.md -> .claude-logs/2026-11-04_11-00-00_e.md',
		' M src/app.ts',
		'?? .claude-logs/2026-11-04_08-00-00_a.md.1234.tmp',
		' M .claude-logs/.gitkeep',
		'?? notes/.claude-logs/x.md'
	].join('\n')
	assert.deepEqual(
		pendingLogs(porcelain).map((entry) => entry.path),
		[
			'.claude-logs/2026-11-04_08-00-00_a.md',
			'.claude-logs/2026-11-04_09-00-00_b.md',
			'.codex-logs/2026-11-04_10-00-00_c.md',
			'.claude-logs/2026-11-01_10-00-00_d.md',
			'.claude-logs/2026-11-04_11-00-00_e.md'
		]
	)
})

test('a clean repo, or one with only unrelated changes, may push', () => {
	const { repo } = tempRepo()
	try {
		assert.equal(run(repo).status, 0)
		writeFileSync(join(repo, 'app.ts'), 'export const changed = true\n')
		writeFileSync(join(repo, 'scratch.txt'), 'untracked, not a log\n')
		assert.deepEqual(checkSessionLogs({ cwd: repo, env: cleanGitEnv() }), {
			ok: true,
			pending: []
		})
		assert.equal(run(repo).status, 0)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('an untracked or modified session log blocks the push, with the fix spelled out', () => {
	const { repo, git } = tempRepo()
	try {
		const log = join(repo, '.claude-logs', '2026-11-04_08-00-00_sess.md')
		writeFileSync(log, '---\nsession_id: sess\n---\n')
		let result = run(repo)
		assert.equal(result.status, 1)
		assert.match(result.stderr, /untracked +\.claude-logs\/2026-11-04_08-00-00_sess\.md/)
		assert.match(result.stderr, /git add \.claude-logs/)
		assert.match(result.stderr, /git commit -m "chore\(logs\)/)

		git('add', '.claude-logs')
		git('commit', '-q', '--no-verify', '-m', 'chore(logs): add')
		assert.equal(run(repo).status, 0, 'committed: nothing pending')

		writeFileSync(log, '---\nsession_id: sess\n---\nmore\n')
		result = run(repo)
		assert.equal(result.status, 1)
		assert.match(result.stderr, /modified +\.claude-logs\/2026-11-04_08-00-00_sess\.md/)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('the message names every pending log and how to commit them', () => {
	const text = message([
		{ state: '??', path: '.claude-logs/a.md' },
		{ state: ' M', path: '.codex-logs/b.md' }
	])
	assert.match(text, /untracked +\.claude-logs\/a\.md/)
	assert.match(text, /modified +\.codex-logs\/b\.md/)
	assert.match(text, /check-secrets\.mjs/)
})

test('the pre-push hook runs the session-log check before the slower gates', () => {
	const hook = readFileSync(HOOK, 'utf8')
	const at = hook.indexOf('node scripts/check-session-logs.mjs')
	assert.ok(at !== -1, 'pre-push calls the check')
	assert.ok(at < hook.indexOf('gate format:check'), 'and calls it first')
})
