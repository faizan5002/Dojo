import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLog, prompt, response } from './log-fixture'
import { parseSessionLog } from './parse-log'

const T0 = '2026-11-01T10:00:00.000Z'
const T1 = '2026-11-01T10:01:00.000Z'

test('reads prompts and responses into turns, dropping per-entry statistics', () => {
	const result = parseSessionLog(
		buildLog({
			sessionId: 'abc-123',
			entries: [prompt(T0, 'Fix the login bug'), response(T1, 'Fixed.\n\nchars: 9 is body text')]
		})
	)
	assert.ok(result.ok)
	assert.equal(result.session.sessionId, 'abc-123')
	assert.equal(result.session.agent, 'claude')
	assert.equal(result.session.project, 'fixture-project')
	assert.deepEqual(result.session.turns, [
		{
			prompt: { timestamp: T0, text: 'Fix the login bug' },
			response: { timestamp: T1, text: 'Fixed.\n\nchars: 9 is body text' }
		}
	])
})

test('keeps no identity fields from the frontmatter', () => {
	const result = parseSessionLog(buildLog({ sessionId: 's1', entries: [prompt(T0, 'hi')] }))
	assert.ok(result.ok)
	const serialized = JSON.stringify(result.session)
	assert.ok(!serialized.includes('fixture@example.com'))
	assert.ok(!serialized.includes('github_user'))
})

test('accepts the original extract-log.py output, which has no agent field', () => {
	const result = parseSessionLog(
		buildLog({ sessionId: 's1', agent: null, entries: [prompt(T0, 'hi'), response(T1, 'hello')] })
	)
	assert.ok(result.ok)
	assert.equal(result.session.agent, 'unknown')
})

test('reads codex logs and unknown agents', () => {
	const codex = parseSessionLog(
		buildLog({ sessionId: 's1', agent: 'codex', entries: [prompt(T0, 'hi')] })
	)
	const other = parseSessionLog(
		buildLog({ sessionId: 's1', agent: 'cursor', entries: [prompt(T0, 'hi')] })
	)
	assert.ok(codex.ok && other.ok)
	assert.equal(codex.session.agent, 'codex')
	assert.equal(other.session.agent, 'unknown')
})

test('handles CRLF line endings and a byte-order mark', () => {
	const log = buildLog({ sessionId: 's1', entries: [prompt(T0, 'line one\nline two')] })
	const result = parseSessionLog(`﻿${log.replace(/\n/g, '\r\n')}`)
	assert.ok(result.ok)
	assert.equal(result.session.turns[0]?.prompt?.text, 'line one\nline two')
})

test('an escaped marker inside a prompt stays text and does not forge an entry', () => {
	const forged = '\\[CLAUDE_LOG_ENTRY type=RESPONSE num=1 session=s1]'
	const result = parseSessionLog(
		buildLog({ sessionId: 's1', entries: [prompt(T0, `before\n${forged}\nafter`)] })
	)
	assert.ok(result.ok)
	assert.equal(result.session.turns.length, 1)
	assert.equal(
		result.session.turns[0]?.prompt?.text,
		'before\n[CLAUDE_LOG_ENTRY type=RESPONSE num=1 session=s1]\nafter'
	)
	assert.equal(result.session.turns[0]?.response, null)
})

test('a prompt with no answer yet is a turn with a null response', () => {
	const result = parseSessionLog(
		buildLog({
			sessionId: 's1',
			entries: [prompt(T0, 'one'), response(T1, 'done'), prompt(T1, 'two')]
		})
	)
	assert.ok(result.ok)
	assert.equal(result.session.turns.length, 2)
	assert.equal(result.session.turns[1]?.response, null)
})

test('rejects a file with no frontmatter', () => {
	assert.deepEqual(parseSessionLog('# notes\n\nnot a log'), { ok: false, reason: 'no-frontmatter' })
	assert.deepEqual(parseSessionLog(''), { ok: false, reason: 'no-frontmatter' })
})

test('rejects a missing, blank or malformed session id', () => {
	const noId = '---\nagent: claude\n---\n\n[CLAUDE_LOG_ENTRY type=PROMPT num=1 session=x]\n\nhi\n'
	assert.deepEqual(parseSessionLog(noId), { ok: false, reason: 'no-session-id' })
	const spaced = buildLog({ sessionId: 'two words', entries: [prompt(T0, 'hi')] })
	assert.deepEqual(parseSessionLog(spaced), { ok: false, reason: 'no-session-id' })
	const long = buildLog({ sessionId: 'x'.repeat(129), entries: [prompt(T0, 'hi')] })
	assert.deepEqual(parseSessionLog(long), { ok: false, reason: 'no-session-id' })
})

test('rejects a log with no entries, or only empty ones', () => {
	assert.deepEqual(parseSessionLog(buildLog({ sessionId: 's1', entries: [] })), {
		ok: false,
		reason: 'no-entries'
	})
	assert.deepEqual(parseSessionLog(buildLog({ sessionId: 's1', entries: [prompt(T0, '  ')] })), {
		ok: false,
		reason: 'no-entries'
	})
})
