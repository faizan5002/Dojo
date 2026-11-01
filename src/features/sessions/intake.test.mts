import { test } from 'node:test'
import assert from 'node:assert/strict'
import { intakeLogFiles, type LogFileSource } from './intake'
import { MAX_LOG_FILE_BYTES, MAX_LOG_FILES } from './limits'
import { buildLog, prompt, response } from './log-fixture'

const T0 = '2026-11-01T10:00:00.000Z'
const T1 = '2026-11-01T10:01:00.000Z'

function file(name: string, text: string, size = text.length): LogFileSource {
	return { name, size, read: async () => text }
}

const oneTurn = (sessionId: string) =>
	buildLog({ sessionId, entries: [prompt(T0, 'hi'), response(T1, 'hello')] })

test('valid logs become sessions; nothing is rejected', async () => {
	const result = await intakeLogFiles([file('a.md', oneTurn('a')), file('b.md', oneTurn('b'))])
	assert.deepEqual(
		result.sessions.map((session) => session.sessionId),
		['a', 'b']
	)
	assert.deepEqual(result.rejected, [])
})

test('each bad file is rejected with its own reason and does not stop the others', async () => {
	const result = await intakeLogFiles([
		file('notes.txt', oneTurn('x')),
		file('empty.md', '', 0),
		file('huge.md', 'x', MAX_LOG_FILE_BYTES + 1),
		file('plain.md', '# just notes'),
		{ name: 'broken.md', size: 10, read: () => Promise.reject(new Error('read failed')) },
		file('good.md', oneTurn('good'))
	])
	assert.deepEqual(
		result.sessions.map((session) => session.sessionId),
		['good']
	)
	assert.deepEqual(result.rejected, [
		{ fileName: 'notes.txt', reason: 'not-markdown' },
		{ fileName: 'empty.md', reason: 'empty' },
		{ fileName: 'huge.md', reason: 'too-large' },
		{ fileName: 'plain.md', reason: 'no-frontmatter' },
		{ fileName: 'broken.md', reason: 'unreadable' }
	])
})

test('an oversized file is never read', async () => {
	let wasRead = false
	await intakeLogFiles([
		{
			name: 'huge.md',
			size: MAX_LOG_FILE_BYTES + 1,
			read: async () => {
				wasRead = true
				return ''
			}
		}
	])
	assert.equal(wasRead, false)
})

test('two copies of one session keep the longer and report the other', async () => {
	const shorter = buildLog({ sessionId: 'same', entries: [prompt(T0, 'hi')] })
	const longer = oneTurn('same')
	const result = await intakeLogFiles([file('old.md', shorter), file('new.md', longer)])
	assert.equal(result.sessions.length, 1)
	assert.equal(result.sessions[0]?.turns[0]?.response?.text, 'hello')
	assert.deepEqual(result.rejected, [{ fileName: 'old.md', reason: 'duplicate-session' }])

	const reversed = await intakeLogFiles([file('new.md', longer), file('old.md', shorter)])
	assert.deepEqual(reversed.rejected, [{ fileName: 'old.md', reason: 'duplicate-session' }])
})

test('equal copies keep the most recently generated', async () => {
	const early = buildLog({
		sessionId: 'same',
		entries: [prompt(T0, 'early')],
		generatedAt: '2026-11-01T09:00:00.000Z'
	})
	const late = buildLog({
		sessionId: 'same',
		entries: [prompt(T0, 'late')],
		generatedAt: '2026-11-01T11:00:00.000Z'
	})
	const result = await intakeLogFiles([file('late.md', late), file('early.md', early)])
	assert.equal(result.sessions[0]?.turns[0]?.prompt?.text, 'late')
})

test('files past the limit are rejected without being read', async () => {
	const files = Array.from({ length: MAX_LOG_FILES + 2 }, (_, index) =>
		file(`s${index}.md`, oneTurn(`s${index}`))
	)
	const result = await intakeLogFiles(files)
	assert.equal(result.sessions.length, MAX_LOG_FILES)
	assert.deepEqual(
		result.rejected.map((rejected) => rejected.reason),
		['too-many-files', 'too-many-files']
	)
})
