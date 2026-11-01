import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanGitEnv, withoutGitEnv } from './test-git-env.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// A stand-in for the repository that is running a git hook: the variables git
// exports to a hook point every child process at it.
function sentinelRepo() {
	const dir = mkdtempSync(join(tmpdir(), 'git-env-sentinel-'))
	const run = (...args) =>
		spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: cleanGitEnv() })
	run('init', '-q')
	writeFileSync(join(dir, 'tracked.txt'), 'tracked\n')
	run('add', 'tracked.txt')
	run('-c', 'user.name=Sentinel', '-c', 'user.email=s@example.test', 'commit', '-q', '-m', 'seed')
	return dir
}

const hookEnv = (dir) => ({
	GIT_DIR: join(dir, '.git'),
	GIT_WORK_TREE: dir,
	GIT_INDEX_FILE: join(dir, '.git', 'index')
})

function snapshot(dir) {
	const git = (...args) =>
		spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: cleanGitEnv() }).stdout
	return {
		config: readFileSync(join(dir, '.git', 'config'), 'utf8'),
		index: readFileSync(join(dir, '.git', 'index')).toString('base64'),
		head: readFileSync(join(dir, '.git', 'HEAD'), 'utf8'),
		refs: git('for-each-ref'),
		status: git('status', '--porcelain=v1', '--untracked-files=all'),
		files: readdirSync(dir).sort()
	}
}

test('cleanGitEnv drops every GIT_* variable and keeps the rest', () => {
	const env = {
		PATH: '/bin',
		GIT_DIR: 'x',
		GIT_INDEX_FILE: 'y',
		git_work_tree: 'z',
		GITHUB_USER: 'u'
	}
	assert.deepEqual(cleanGitEnv(env), { PATH: '/bin', GITHUB_USER: 'u' })
})

test('withoutGitEnv hides GIT_* only while the callback runs, then restores them', () => {
	process.env.GIT_DIR = 'restored-value'
	try {
		const seen = withoutGitEnv(() => process.env.GIT_DIR)
		assert.equal(seen, undefined)
		assert.equal(process.env.GIT_DIR, 'restored-value')
		assert.throws(() =>
			withoutGitEnv(() => {
				throw new Error('boom')
			})
		)
		assert.equal(process.env.GIT_DIR, 'restored-value', 'restored even when the callback throws')
	} finally {
		delete process.env.GIT_DIR
	}
})

test('control: an unsanitised git call under hook-style GIT_* does write to the sentinel', () => {
	const sentinel = sentinelRepo()
	const victim = mkdtempSync(join(tmpdir(), 'git-env-victim-'))
	try {
		const before = snapshot(sentinel)
		spawnSync('git', ['config', 'user.name', 'Contaminated'], {
			cwd: victim,
			env: { ...process.env, ...hookEnv(sentinel) }
		})
		assert.notEqual(
			snapshot(sentinel).config,
			before.config,
			'the contamination this suite guards against no longer reproduces; the regression tests below prove nothing'
		)
	} finally {
		rmSync(sentinel, { recursive: true, force: true })
		rmSync(victim, { recursive: true, force: true })
	}
})

const withoutTestContext = (env) =>
	Object.fromEntries(Object.entries(env).filter(([name]) => name !== 'NODE_TEST_CONTEXT'))

// Runs a subset of a real suite as a child whose environment is the hook's, and
// checks that the sentinel repository it points at comes out byte-identical.
function runUnderHook(file, namePatterns) {
	const sentinel = sentinelRepo()
	try {
		const before = snapshot(sentinel)
		const result = spawnSync(
			process.execPath,
			[
				'--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
				'--import',
				'./scripts/register-ts.mjs',
				'--test',
				'--test-reporter=tap',
				...namePatterns.map((pattern) => `--test-name-pattern=${pattern}`),
				file
			],
			{
				cwd: REPO_ROOT,
				encoding: 'utf8',
				// NODE_TEST_CONTEXT would make the nested runner a silent child of this one.
				env: { ...withoutTestContext(process.env), ...hookEnv(sentinel) }
			}
		)
		return { result, before, after: snapshot(sentinel) }
	} finally {
		rmSync(sentinel, { recursive: true, force: true })
	}
}

const passed = (stdout) => Number(/^# pass (\d+)/m.exec(stdout)?.[1] ?? 0)

test('session-log tests that use git leave the hook repo untouched under hook-style GIT_*', () => {
	const { result, before, after } = runUnderHook('scripts/session-log.test.mjs', [
		'real git config is used when no override is set',
		'show up in git status under the repo .gitignore'
	])
	assert.equal(result.status, 0, result.stdout + result.stderr)
	assert.equal(passed(result.stdout), 2, 'both git-using tests ran and passed')
	assert.deepEqual(after, before)
})

test('check-standards fixture tests leave the hook repo untouched under hook-style GIT_*', () => {
	const { result, before, after } = runUnderHook('scripts/check-standards.test.mjs', [
		'git-backed checks fail, not skip, outside a git repository',
		'the CLI exits 1 and reports the failure as JSON'
	])
	assert.equal(result.status, 0, result.stdout + result.stderr)
	assert.equal(passed(result.stdout), 2, 'both fixture tests ran and passed')
	assert.deepEqual(after, before)
})
