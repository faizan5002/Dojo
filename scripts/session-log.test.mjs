import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zstdCompressSync } from 'node:zlib'
import { scanText } from './check-secrets.mjs'
import { cleanGitEnv, withoutGitEnv } from './test-git-env.mjs'
import {
	cleanPrompt,
	logSession,
	parseClaudeTranscript,
	parseCodexRollout,
	parseLog,
	readFrontmatter,
	readTranscriptFile,
	redact,
	renderLog,
	resolveAttribution
} from './session-log.mjs'

// Every credential below is synthetic and assembled at runtime, so no literal
// secret shape sits in this file for `check:secrets --all` to trip over.
const FAKE = {
	github: 'ghp_' + 'Ab3dE5gH7jK9mN1pQ3sT5vX7zC9eF1hJ3kL5',
	aws: 'AKIA' + 'QWERTYUIOPASDFGH',
	openai: 'sk-' + 'proj-' + 'Zy8xW6vU4tS2rQ0pO9nM7lK5jI3hG1fE',
	jwt: [
		'eyJhbGciOiJIUzI1NiJ9',
		'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
		'dBjftJeZ4CVPmB92K27uhbUJU1p1r'
	].join('.'),
	dbPassword: 'Xk9vQ2mZ' + 'r7SdF3pLw8bN',
	apiKeyValue: 'Qm4Vt8Lz2X' + 'c6Rn9Pw3Yb7Hd1',
	pem: [
		'-----BEGIN RSA PRIVATE',
		'KEY-----\nMIIEowIBAAKCAQEA0123456789\n-----END RSA PRIVATE',
		'KEY-----'
	].join(' ')
}
const NOW = new Date('2026-10-30T10:00:00.000Z')
const jsonl = (...records) =>
	records.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n')

function tempRepo() {
	const dir = mkdtempSync(join(tmpdir(), 'session-log-'))
	mkdirSync(join(dir, '.git'))
	return dir
}
const logFiles = (repo) => {
	try {
		return readdirSync(join(repo, '.claude-logs')).filter((name) => name.endsWith('.md'))
	} catch {
		return []
	}
}
const read = (repo, name) => readFileSync(join(repo, '.claude-logs', name), 'utf8')
const noGh = (command, args) =>
	command === 'git' && !args.includes('github.user') ? 'Test Dev' : ''
const exec = (command, args) => {
	if (command === 'gh' || args.includes('github.user')) return ''
	return args.includes('user.email') ? 'dev@example.com' : 'Test Dev'
}

// --- redaction --------------------------------------------------------------

test('redact removes provider tokens, URL passwords, bearer tokens and keyed values', () => {
	const input = [
		`github ${FAKE.github}`,
		`aws ${FAKE.aws}`,
		`openai ${FAKE.openai}`,
		`jwt ${FAKE.jwt}`,
		`db postgresql://prod_user:${FAKE.dbPassword}@db.host.io:5432/app`,
		`Authorization: Bearer ${FAKE.apiKeyValue}ABCDEF`,
		`MY_SERVICE_KEY=${FAKE.apiKeyValue}`,
		`{"apiKey": "${FAKE.apiKeyValue}"}`,
		FAKE.pem
	].join('\n')
	const { text, count } = redact(input)
	for (const secret of [
		FAKE.github,
		FAKE.aws,
		FAKE.openai,
		FAKE.jwt,
		FAKE.dbPassword,
		FAKE.apiKeyValue
	]) {
		assert.ok(!text.includes(secret), `leaked ${secret.slice(0, 6)}…`)
	}
	assert.ok(!text.includes('MIIEowIBAAKCAQEA'))
	assert.ok(
		text.includes('postgresql://prod_user:[REDACTED:url-password]@db.host.io'),
		'keeps the URL shape'
	)
	assert.ok(count >= 8)
	assert.deepEqual(scanText(text), [], 'output passes the repo secret scanner')
})

test('redact leaves references and prose alone', () => {
	const input =
		'curl -H "Authorization: Bearer $CRON_SECRET" and process.env.API_KEY, secret: z.string()'
	assert.deepEqual(redact(input), { text: input, count: 0 })
})

test('redact fails closed: a line the scanner still flags is blanked', () => {
	// RapidAPI keys have no span rule here, only the scanner knows the shape.
	const line = `key ${'a1b2c3d4e5f6a7b8c9d0'}jsn${'0123456789abcdef'}`
	assert.ok(scanText(line).length > 0)
	const { text } = redact(`before\n${line}\nafter`)
	assert.equal(text, 'before\n[REDACTED LINE: possible rapidapi-key]\nafter')
})

// --- prompt cleaning --------------------------------------------------------

test('cleanPrompt keeps what the human typed and drops harness context', () => {
	assert.equal(cleanPrompt('<system-reminder>ctx</system-reminder>\nfix the bug'), 'fix the bug')
	assert.equal(cleanPrompt('<ide_opened_file>x</ide_opened_file>hello'), 'hello')
	assert.equal(cleanPrompt('<command-name>/clear</command-name>'), '')
	assert.equal(cleanPrompt('Caveat: local commands'), '')
	assert.equal(cleanPrompt('   '), '')
	assert.equal(
		cleanPrompt('# Files mentioned by the user\n\n## a.png: x\n\n## My request:\nmake it blue'),
		'make it blue'
	)
})

// --- Claude Code transcript -------------------------------------------------

const claudeFixture = () =>
	jsonl(
		{ type: 'queue-operation', operation: 'enqueue' },
		{
			type: 'user',
			timestamp: '2026-10-30T09:00:00.000Z',
			message: { role: 'user', content: 'first question' }
		},
		{
			type: 'assistant',
			timestamp: '2026-10-30T09:00:02.000Z',
			message: {
				id: 'm1',
				stop_reason: 'tool_use',
				content: [{ type: 'thinking', thinking: 'SECRET-THOUGHT' }]
			}
		},
		{
			type: 'assistant',
			timestamp: '2026-10-30T09:00:03.000Z',
			message: {
				id: 'm1',
				stop_reason: 'tool_use',
				content: [{ type: 'text', text: 'Let me look at the files.' }]
			}
		},
		{
			type: 'assistant',
			timestamp: '2026-10-30T09:00:04.000Z',
			message: {
				id: 'm1',
				stop_reason: 'tool_use',
				content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/etc/hosts' } }]
			}
		},
		{
			type: 'user',
			timestamp: '2026-10-30T09:00:05.000Z',
			message: {
				role: 'user',
				content: [{ type: 'tool_result', tool_use_id: 't1', content: 'TOOL-OUTPUT-LEAK' }]
			}
		},
		{
			type: 'assistant',
			isSidechain: true,
			timestamp: '2026-10-30T09:00:06.000Z',
			message: {
				id: 's1',
				stop_reason: 'end_turn',
				content: [{ type: 'text', text: 'SIDECHAIN-LEAK' }]
			}
		},
		{
			type: 'user',
			isMeta: true,
			timestamp: '2026-10-30T09:00:06.500Z',
			message: { role: 'user', content: 'META-LEAK' }
		},
		'{"type":"assistant","message":{"id":"torn"',
		{
			type: 'assistant',
			timestamp: '2026-10-30T09:00:07.000Z',
			message: {
				id: 'm2',
				stop_reason: 'end_turn',
				content: [{ type: 'thinking', thinking: 'more thoughts' }]
			}
		},
		{
			type: 'assistant',
			timestamp: '2026-10-30T09:00:08.000Z',
			message: {
				id: 'm2',
				stop_reason: 'end_turn',
				content: [{ type: 'text', text: 'The answer is 42.' }]
			}
		},
		{
			type: 'user',
			timestamp: '2026-10-30T09:05:00.000Z',
			message: {
				role: 'user',
				content: [{ type: 'text', text: 'second question, pasted as blocks' }]
			}
		},
		{
			type: 'assistant',
			timestamp: '2026-10-30T09:05:03.000Z',
			message: { id: 'm3', stop_reason: null, content: [{ type: 'text', text: 'Checking first.' }] }
		},
		{
			type: 'assistant',
			timestamp: '2026-10-30T09:05:04.000Z',
			message: {
				id: 'm3',
				stop_reason: null,
				content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: {} }]
			}
		},
		{
			type: 'user',
			timestamp: '2026-10-30T09:06:00.000Z',
			message: { role: 'user', content: 'third question, unanswered' }
		}
	)

test('Claude parser extracts prompts and only final responses', () => {
	const { turns } = parseClaudeTranscript(claudeFixture())
	assert.deepEqual(
		turns.map((t) => [t.prompt.text, t.response?.text ?? null]),
		[
			['first question', 'The answer is 42.'],
			['second question, pasted as blocks', null],
			['third question, unanswered', null]
		]
	)
	const everything = JSON.stringify(turns)
	for (const leak of [
		'TOOL-OUTPUT-LEAK',
		'SIDECHAIN-LEAK',
		'META-LEAK',
		'SECRET-THOUGHT',
		'Let me look',
		'Checking first'
	]) {
		assert.ok(!everything.includes(leak), `${leak} leaked`)
	}
})

test('Claude parser keeps only the last final response of a turn and joins blocks of one message', () => {
	const { turns } = parseClaudeTranscript(
		jsonl(
			{ type: 'user', timestamp: 't0', message: { content: 'go' } },
			{
				type: 'assistant',
				timestamp: 't1',
				message: { id: 'a', stop_reason: 'end_turn', content: [{ type: 'text', text: 'draft' }] }
			},
			{
				type: 'assistant',
				timestamp: 't2',
				message: { id: 'b', stop_reason: 'end_turn', content: [{ type: 'text', text: 'part one' }] }
			},
			{
				type: 'assistant',
				timestamp: 't3',
				message: { id: 'b', stop_reason: 'end_turn', content: [{ type: 'text', text: 'part two' }] }
			}
		)
	)
	assert.equal(turns.length, 1)
	assert.equal(turns[0].response.text, 'part one\n\npart two')
})

test('malformed and empty JSONL never throw', () => {
	assert.deepEqual(parseClaudeTranscript('').turns, [])
	assert.deepEqual(parseClaudeTranscript('not json\n{"type":\n[1,2]\nnull').turns, [])
	assert.deepEqual(parseCodexRollout('{"type":"event_msg"\n\n42').turns, [])
})

// --- Codex rollout ----------------------------------------------------------

const codexFixture = () =>
	jsonl(
		{
			timestamp: '2026-10-30T09:00:00Z',
			type: 'session_meta',
			payload: { id: '01a1-codex-session', cwd: '/work/dojo' }
		},
		{
			timestamp: '2026-10-30T09:00:01Z',
			type: 'response_item',
			payload: {
				type: 'message',
				role: 'user',
				content: [{ type: 'input_text', text: '<environment_context>cwd</environment_context>' }]
			}
		},
		{
			timestamp: '2026-10-30T09:00:02Z',
			type: 'event_msg',
			payload: {
				type: 'item_completed',
				item: { type: 'UserMessage', content: [{ type: 'text', text: 'add a test' }] }
			}
		},
		{
			timestamp: '2026-10-30T09:00:03Z',
			type: 'response_item',
			payload: {
				type: 'message',
				role: 'assistant',
				phase: 'commentary',
				content: [{ type: 'output_text', text: 'COMMENTARY-LEAK' }]
			}
		},
		{
			timestamp: '2026-10-30T09:00:04Z',
			type: 'response_item',
			payload: { type: 'function_call', name: 'shell', arguments: '{"cmd":"TOOL-CALL-LEAK"}' }
		},
		{
			timestamp: '2026-10-30T09:00:05Z',
			type: 'response_item',
			payload: { type: 'function_call_output', output: 'TOOL-RESULT-LEAK' }
		},
		{
			timestamp: '2026-10-30T09:00:06Z',
			type: 'response_item',
			payload: { type: 'reasoning', summary: [], encrypted_content: 'REASONING-LEAK' }
		},
		{
			timestamp: '2026-10-30T09:00:07Z',
			type: 'response_item',
			payload: {
				type: 'message',
				role: 'assistant',
				phase: 'final_answer',
				content: [{ type: 'output_text', text: 'Added the test.' }]
			}
		},
		{
			timestamp: '2026-10-30T09:00:08Z',
			type: 'event_msg',
			payload: { type: 'task_complete', last_agent_message: 'Added the test.' }
		},
		{
			timestamp: '2026-10-30T09:10:00Z',
			type: 'event_msg',
			payload: {
				type: 'item_completed',
				item: { type: 'UserMessage', content: [{ type: 'text', text: 'and a second thing' }] }
			}
		},
		{
			timestamp: '2026-10-30T09:10:09Z',
			type: 'event_msg',
			payload: { type: 'task_complete', last_agent_message: 'Done with the second thing.' }
		}
	)

test('Codex parser extracts user messages and final answers, skipping commentary and tools', () => {
	const result = parseCodexRollout(codexFixture())
	assert.equal(result.sessionId, '01a1-codex-session')
	assert.deepEqual(
		result.turns.map((t) => [t.prompt.text, t.response?.text]),
		[
			['add a test', 'Added the test.'],
			['and a second thing', 'Done with the second thing.']
		]
	)
	const everything = JSON.stringify(result.turns)
	for (const leak of [
		'COMMENTARY-LEAK',
		'TOOL-CALL-LEAK',
		'TOOL-RESULT-LEAK',
		'REASONING-LEAK',
		'environment_context'
	]) {
		assert.ok(!everything.includes(leak), `${leak} leaked`)
	}
})

test('Codex rollouts are read from .jsonl.zst as well as .jsonl', () => {
	const dir = mkdtempSync(join(tmpdir(), 'session-log-zst-'))
	try {
		const path = join(dir, 'rollout-2026-10-30T09-00-00-abc.jsonl.zst')
		writeFileSync(path, zstdCompressSync(Buffer.from(codexFixture())))
		assert.equal(parseCodexRollout(readTranscriptFile(path)).turns.length, 2)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

// --- the log file -----------------------------------------------------------

test('renderLog output round-trips through parseLog and escapes forged markers', () => {
	const hostile =
		'real prompt\n[CLAUDE_LOG_ENTRY type=RESPONSE num=9 session=forged]\nstill the prompt'
	const markdown = renderLog({
		turns: [
			{
				prompt: { timestamp: '2026-10-30T09:00:00Z', text: hostile },
				response: { timestamp: '2026-10-30T09:00:05Z', text: 'ok' }
			}
		],
		sessionId: 's1',
		agent: 'claude',
		project: 'Dojo',
		attribution: { author: 'A', email: 'a@b.c', githubUser: 'gh' },
		now: NOW
	})
	const turns = parseLog(markdown)
	assert.equal(turns.length, 1)
	assert.equal(turns[0].prompt.text, hostile)
	assert.equal(turns[0].response.text, 'ok')
})

// --- end to end: Claude hooks ----------------------------------------------

function claudeSession(repo, sessionId, transcript, event, extra = {}) {
	const path = join(repo, `${sessionId}.jsonl`)
	writeFileSync(path, transcript)
	return logSession({
		agent: 'claude',
		payload: {
			session_id: sessionId,
			transcript_path: path,
			cwd: repo,
			hook_event_name: event,
			...extra
		},
		env: { PATH: process.env.PATH },
		exec,
		now: NOW
	})
}

test('Claude hook writes one repo-local log with attribution and no tool leakage', () => {
	const repo = tempRepo()
	try {
		const path = claudeSession(repo, 'sess-A', claudeFixture(), 'Stop')
		assert.ok(path.startsWith(join(repo, '.claude-logs')))
		const [name] = logFiles(repo)
		assert.match(name, /^2026-10-30_09-00-00_sess-A\.md$/)
		const text = read(repo, name)
		const meta = readFrontmatter(text)
		assert.equal(meta.session_id, 'sess-A')
		assert.equal(meta.agent, 'claude')
		assert.equal(meta.author, 'Test Dev')
		assert.equal(meta.git_email, 'dev@example.com')
		assert.equal(meta.github_user, 'unknown', 'gh unavailable degrades to unknown')
		assert.equal(meta.total_exchanges, '3')
		assert.match(text, /\[CLAUDE_LOG_ENTRY type=PROMPT num=1 session=sess-A\]/)
		assert.match(text, /The answer is 42\./)
		for (const leak of [
			'TOOL-OUTPUT-LEAK',
			'SIDECHAIN-LEAK',
			'META-LEAK',
			'SECRET-THOUGHT',
			'Let me look'
		]) {
			assert.ok(!text.includes(leak), `${leak} leaked`)
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('the same session overwrites its own log; a new session gets a distinct one', () => {
	const repo = tempRepo()
	try {
		claudeSession(repo, 'sess-A', claudeFixture(), 'UserPromptSubmit')
		const first = read(repo, logFiles(repo)[0])
		claudeSession(repo, 'sess-A', claudeFixture(), 'Stop')
		assert.equal(logFiles(repo).length, 1, 'no duplicate file for the same session')
		assert.equal(read(repo, logFiles(repo)[0]), first, 'idempotent for identical input')

		claudeSession(repo, 'sess-B', claudeFixture(), 'Stop')
		assert.equal(logFiles(repo).length, 2)
		assert.notEqual(logFiles(repo)[0], logFiles(repo)[1])
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('UserPromptSubmit logs the prompt even before the transcript has flushed it', () => {
	const repo = tempRepo()
	try {
		claudeSession(repo, 'sess-C', '', 'UserPromptSubmit', { prompt: 'brand new prompt' })
		assert.match(read(repo, logFiles(repo)[0]), /brand new prompt/)
		assert.equal(readFrontmatter(read(repo, logFiles(repo)[0])).session_status, 'awaiting_response')
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('Stop falls back to last_assistant_message when the transcript lags', () => {
	const repo = tempRepo()
	try {
		const lagging = jsonl({
			type: 'user',
			timestamp: '2026-10-30T09:00:00.000Z',
			message: { content: 'hi' }
		})
		claudeSession(repo, 'sess-D', lagging, 'Stop', { last_assistant_message: 'final words' })
		assert.match(read(repo, logFiles(repo)[0]), /final words/)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('secrets in a prompt and a response never reach the file', () => {
	const repo = tempRepo()
	try {
		const transcript = jsonl(
			{
				type: 'user',
				timestamp: '2026-10-30T09:00:00.000Z',
				message: {
					content: `deploy with DATABASE_URL=postgresql://u:${FAKE.dbPassword}@h.io/db and ${FAKE.github}`
				}
			},
			{
				type: 'assistant',
				timestamp: '2026-10-30T09:00:05.000Z',
				message: {
					id: 'x',
					stop_reason: 'end_turn',
					content: [{ type: 'text', text: `I used ${FAKE.openai} and\n${FAKE.pem}` }]
				}
			}
		)
		claudeSession(repo, 'sess-E', transcript, 'Stop')
		const text = read(repo, logFiles(repo)[0])
		for (const secret of [FAKE.dbPassword, FAKE.github, FAKE.openai, 'MIIEowIBAAKCAQEA'])
			assert.ok(!text.includes(secret))
		assert.deepEqual(scanText(text), [], 'a written log passes check:secrets')
		assert.ok(Number(readFrontmatter(text).redactions) >= 3)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('a subfolder session logs to the repo root, not the subfolder', () => {
	const repo = tempRepo()
	try {
		const sub = join(repo, 'src', 'deep')
		mkdirSync(sub, { recursive: true })
		const path = join(repo, 't.jsonl')
		writeFileSync(path, claudeFixture())
		logSession({
			agent: 'claude',
			payload: { session_id: 's', transcript_path: path, cwd: sub, hook_event_name: 'Stop' },
			env: {},
			exec,
			now: NOW
		})
		assert.equal(logFiles(repo).length, 1)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// --- end to end: Codex hooks ------------------------------------------------

function codexHook(repo, sessionId, event, fields) {
	return logSession({
		agent: 'codex',
		payload: {
			session_id: sessionId,
			cwd: repo,
			hook_event_name: event,
			transcript_path: null,
			...fields
		},
		env: {},
		exec,
		now: NOW
	})
}

test('Codex hooks accumulate prompts and final messages into the shared format', () => {
	const repo = tempRepo()
	try {
		codexHook(repo, '01aa-codex', 'UserPromptSubmit', { prompt: 'first' })
		codexHook(repo, '01aa-codex', 'Stop', { last_assistant_message: 'answer one' })
		codexHook(repo, '01aa-codex', 'UserPromptSubmit', { prompt: 'second' })
		codexHook(repo, '01aa-codex', 'Stop', { last_assistant_message: 'answer two' })
		codexHook(repo, '01aa-codex', 'Stop', { last_assistant_message: 'answer two' })
		assert.equal(logFiles(repo).length, 1)
		const text = read(repo, logFiles(repo)[0])
		assert.deepEqual(
			parseLog(text).map((t) => [t.prompt.text, t.response.text]),
			[
				['first', 'answer one'],
				['second', 'answer two']
			]
		)
		assert.equal(readFrontmatter(text).agent, 'codex')
		assert.equal(readFrontmatter(text).total_exchanges, '2')
		codexHook(repo, '01bb-other', 'UserPromptSubmit', { prompt: 'other session' })
		assert.equal(logFiles(repo).length, 2)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('a Codex rollout can be backfilled with --transcript', () => {
	const repo = tempRepo()
	try {
		const rollout = join(repo, 'rollout.jsonl')
		writeFileSync(rollout, codexFixture())
		logSession({ agent: 'codex', transcriptPath: rollout, cwd: repo, env: {}, exec, now: NOW })
		const [name] = logFiles(repo)
		assert.match(name, /_01a1-codex-session\.md$/)
		assert.equal(parseLog(read(repo, name)).length, 2)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('Claude and Codex logs share one frontmatter schema and entry format', () => {
	const repo = tempRepo()
	try {
		claudeSession(repo, 'sess-A', claudeFixture(), 'Stop')
		codexHook(repo, '01aa-codex', 'UserPromptSubmit', { prompt: 'p' })
		codexHook(repo, '01aa-codex', 'Stop', { last_assistant_message: 'r' })
		const claude = logFiles(repo).find((name) => !name.includes('codex'))
		const codex = logFiles(repo).find((name) => name.includes('codex'))
		const keys = (name) => Object.keys(readFrontmatter(read(repo, name)))
		const required = [
			'session_id',
			'agent',
			'date',
			'author',
			'github_user',
			'git_email',
			'project',
			'session_status',
			'total_exchanges',
			'generated_at'
		]
		for (const name of [claude, codex])
			for (const key of required) assert.ok(keys(name).includes(key), `${name} lacks ${key}`)
		for (const name of [claude, codex])
			assert.match(read(repo, name), /^\[CLAUDE_LOG_ENTRY type=PROMPT num=1 session=\S+\]$/m)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// --- attribution ------------------------------------------------------------

test('attribution: env overrides win, gh failure and a missing binary degrade to unknown', () => {
	assert.deepEqual(
		resolveAttribution({
			cwd: '.',
			env: { CLAUDE_AUTHOR: 'Env Dev', GITHUB_USER: 'envuser' },
			exec
		}),
		{
			author: 'Env Dev',
			email: 'dev@example.com',
			githubUser: 'envuser'
		}
	)
	assert.equal(resolveAttribution({ cwd: '.', env: {}, exec: () => '' }).author, 'unknown')
	assert.equal(resolveAttribution({ cwd: '.', env: {}, exec: () => '' }).githubUser, 'unknown')
	assert.equal(resolveAttribution({ cwd: '.', env: {}, exec: noGh }).githubUser, 'unknown')
	// `git config github.user` is the fallback when gh cannot answer (e.g. a hook shell with no gh on PATH)
	const viaGitConfig = (command, args) =>
		args.includes('github.user') ? 'cfguser' : command === 'gh' ? '' : 'x'
	assert.equal(resolveAttribution({ cwd: '.', env: {}, exec: viaGitConfig }).githubUser, 'cfguser')
	// a login recorded earlier in the same session is reused, so gh is not called again
	const calls = []
	const spy = (command) => (calls.push(command), command === 'gh' ? 'late' : 'x')
	assert.equal(
		resolveAttribution({ cwd: '.', env: {}, exec: spy, previous: { github_user: 'kept' } })
			.githubUser,
		'kept'
	)
	assert.ok(!calls.includes('gh'))
})

test('real git config is used when no override is set', () => {
	const repo = tempRepo()
	try {
		const git = (...args) => spawnSync('git', args, { cwd: repo, env: cleanGitEnv() })
		git('init', '-q')
		git('config', 'user.name', 'Real Dev')
		git('config', 'user.email', 'real@dev.test')
		// resolveAttribution spawns git itself, in this process's environment.
		const result = withoutGitEnv(() =>
			resolveAttribution({ cwd: repo, env: { GITHUB_USER: 'someone' } })
		)
		assert.equal(result.author, 'Real Dev')
		assert.equal(result.email, 'real@dev.test')
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// --- the CLI the hooks actually run ----------------------------------------

function cli(args, input, cwd) {
	return spawnSync(
		process.execPath,
		[fileURLToPath(new URL('./session-log.mjs', import.meta.url)), ...args],
		{
			cwd,
			input,
			encoding: 'utf8',
			env: { ...cleanGitEnv(), GITHUB_USER: 'cli-user', CLAUDE_PROJECT_DIR: '' }
		}
	)
}

test('CLI: exits 0 on garbage stdin, writes on a valid payload, answers {} to a Codex Stop', () => {
	const repo = tempRepo()
	try {
		const garbage = cli(['claude'], 'not json at all', repo)
		assert.equal(garbage.status, 0)
		assert.equal(logFiles(repo).length, 0)

		const bad = cli(['nonsense'], '', repo)
		assert.equal(bad.status, 0)

		const prompt = cli(
			['codex'],
			JSON.stringify({
				session_id: 'cli-1',
				cwd: repo,
				hook_event_name: 'UserPromptSubmit',
				prompt: 'hello'
			}),
			repo
		)
		assert.equal(prompt.status, 0)
		assert.equal(
			prompt.stdout,
			'',
			'UserPromptSubmit stdout is injected as model context, so it must stay empty'
		)
		const stop = cli(
			['codex'],
			JSON.stringify({
				session_id: 'cli-1',
				cwd: repo,
				hook_event_name: 'Stop',
				last_assistant_message: 'hi'
			}),
			repo
		)
		assert.equal(stop.status, 0)
		assert.equal(stop.stdout, '{}')
		const text = read(repo, logFiles(repo)[0])
		assert.match(text, /github_user: cli-user/)
		assert.match(text, /hi\n/)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// --- review fixes: repeated prompts, multiple stops, env isolation, counts ---

test('Codex: an identical prompt after an answer is a new turn, a redelivered one is not', () => {
	const repo = tempRepo()
	try {
		codexHook(repo, 'rep-1', 'UserPromptSubmit', { prompt: 'continue' })
		codexHook(repo, 'rep-1', 'UserPromptSubmit', { prompt: 'continue' })
		codexHook(repo, 'rep-1', 'Stop', { last_assistant_message: 'step one' })
		codexHook(repo, 'rep-1', 'UserPromptSubmit', { prompt: 'continue' })
		codexHook(repo, 'rep-1', 'Stop', { last_assistant_message: 'step two' })
		assert.deepEqual(
			parseLog(read(repo, logFiles(repo)[0])).map((t) => [t.prompt.text, t.response.text]),
			[
				['continue', 'step one'],
				['continue', 'step two']
			]
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('Codex: when a turn stops twice the latest final message wins', () => {
	const repo = tempRepo()
	try {
		codexHook(repo, 'multi-stop', 'UserPromptSubmit', { prompt: 'go' })
		codexHook(repo, 'multi-stop', 'Stop', { last_assistant_message: 'first stop' })
		codexHook(repo, 'multi-stop', 'Stop', { last_assistant_message: 'after continuation' })
		const turns = parseLog(read(repo, logFiles(repo)[0]))
		assert.equal(turns.length, 1)
		assert.equal(turns[0].response.text, 'after continuation')
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('Codex ignores CLAUDE_PROJECT_DIR inherited from another project; Claude honours it', () => {
	const repo = tempRepo()
	const other = tempRepo()
	try {
		const payload = {
			session_id: 'env-1',
			cwd: repo,
			hook_event_name: 'UserPromptSubmit',
			prompt: 'hi'
		}
		logSession({ agent: 'codex', payload, env: { CLAUDE_PROJECT_DIR: other }, exec, now: NOW })
		assert.equal(logFiles(repo).length, 1)
		assert.equal(logFiles(other).length, 0)
		logSession({
			agent: 'claude',
			payload: { ...payload, session_id: 'env-2' },
			env: { CLAUDE_PROJECT_DIR: other },
			exec,
			now: NOW
		})
		assert.equal(logFiles(other).length, 1)
	} finally {
		rmSync(repo, { recursive: true, force: true })
		rmSync(other, { recursive: true, force: true })
	}
})

test('the redaction total survives a log that is grown across hook runs', () => {
	const repo = tempRepo()
	try {
		codexHook(repo, 'count-1', 'UserPromptSubmit', { prompt: `token ${FAKE.github}` })
		codexHook(repo, 'count-1', 'Stop', { last_assistant_message: 'done' })
		const text = read(repo, logFiles(repo)[0])
		assert.ok(!text.includes(FAKE.github))
		assert.ok(Number(readFrontmatter(text).redactions) >= 1)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('a Claude transcript is found from the session id when the payload omits its path', () => {
	const repo = tempRepo()
	const home = mkdtempSync(join(tmpdir(), 'session-log-home-'))
	try {
		const folder = repo.replace(/[^A-Za-z0-9]/g, '-')
		mkdirSync(join(home, '.claude', 'projects', folder), { recursive: true })
		writeFileSync(join(home, '.claude', 'projects', folder, 'lookup-1.jsonl'), claudeFixture())
		logSession({
			agent: 'claude',
			payload: { session_id: 'lookup-1', cwd: repo, hook_event_name: 'Stop' },
			env: {},
			exec,
			now: NOW,
			home
		})
		assert.match(read(repo, logFiles(repo)[0]), /The answer is 42\./)
	} finally {
		rmSync(repo, { recursive: true, force: true })
		rmSync(home, { recursive: true, force: true })
	}
})

test('redaction stays linear on a long run of credential-like letters', () => {
	const started = Date.now()
	redact('key'.repeat(100_000))
	assert.ok(Date.now() - started < 2000, 'the credential-assignment scan went quadratic again')
})

// --- privacy policy: logs are local-only (docs/DECISIONS.md) ------------------

const repoFile = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))

test('logs written by either agent show up in git status under the repo .gitignore', () => {
	const repo = tempRepo()
	rmSync(join(repo, '.git'), { recursive: true, force: true })
	try {
		const git = (...args) =>
			spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: cleanGitEnv() })
		git('init', '-q')
		writeFileSync(join(repo, '.gitignore'), readFileSync(repoFile('.gitignore'), 'utf8'))
		const nested = join(repo, 'packages', 'app')
		mkdirSync(nested, { recursive: true })

		claudeSession(repo, 'policy-claude', claudeFixture(), 'Stop')
		codexHook(repo, 'policy-codex', 'UserPromptSubmit', { prompt: 'p' })
		codexHook(repo, 'policy-codex', 'Stop', { last_assistant_message: 'r' })
		assert.equal(logFiles(repo).length, 2, 'both agents still write their logs locally')

		for (const dir of ['.claude-logs', '.codex-logs']) {
			mkdirSync(join(nested, dir), { recursive: true })
			writeFileSync(join(nested, dir, 'x.md'), 'x')
		}
		const listed = git('status', '--porcelain', '--untracked-files=all').stdout
		assert.ok(/claude-logs/.test(listed), `logs are hidden from git: ${listed.trim()}`)
		for (const path of [
			'.claude-logs/a.md',
			'.codex-logs/a.md',
			'packages/app/.claude-logs/a.md',
			'packages/app/.codex-logs/a.md'
		]) {
			assert.notEqual(git('check-ignore', '-q', path).status, 0, `${path} is ignored`)
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test('no hook, git hook or logger code stages, commits or pushes anything', () => {
	for (const path of [
		'.claude/settings.json',
		'.codex/hooks.json',
		'.githooks/pre-commit',
		'.githooks/commit-msg',
		'scripts/session-log.mjs'
	]) {
		const text = readFileSync(repoFile(path), 'utf8')
		assert.ok(!/git\s+(add|commit|push|stash)\b/.test(text), `${path} runs a git write command`)
	}
})

test('the instruction files state the commit policy and none repeats the local-only one', () => {
	const instructionFiles = [
		'AGENTS.md',
		'CLAUDE.md',
		'GEMINI.md',
		'QWEN.md',
		'README.md',
		'.cursor/rules/project.mdc',
		'.claude/commands/cicd.md',
		'.codex/commands/cicd.md',
		'.claude/skills/e2e-build/SKILL.md',
		'.claude/skills/preview-acceptance-testing/SKILL.md',
		'docs/SESSION_LOGGING.md',
		'docs/DEVELOPMENT_WORKFLOW.md',
		'docs/PROJECT_CONTEXT.md',
		'docs/rules/secrets.md'
	]
	for (const path of instructionFiles) {
		const text = readFileSync(repoFile(path), 'utf8')
		assert.ok(
			!/(logs? (are|is) )?\*\*local-only|never (stage|commit)[^.]*session log/i.test(text),
			`${path} still states the local-only policy`
		)
		if (['AGENTS.md', 'CLAUDE.md', 'docs/SESSION_LOGGING.md'].includes(path)) {
			assert.ok(/\btracked\b/i.test(text), `${path} does not state that logs are tracked`)
		}
	}
})
