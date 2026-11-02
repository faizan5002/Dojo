import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sessionOf } from '@/features/assessment/session-fixtures'
import { countRedactions, redactSessions } from './redact-sessions'
import { uploadInputSchema } from './stored'

const TOKEN = `ghp_${'a1B2c3D4e5'.repeat(4)}`

test('redaction covers prompts and responses, and counts what it removed', () => {
	const session = sessionOf({ sessionId: 's1', prompts: [`deploy with ${TOKEN}`] })
	const withSecretAnswer = {
		...session,
		turns: [
			{
				prompt: session.turns[0]?.prompt ?? null,
				response: { timestamp: '', text: 'Use postgres://app:hunter22@db:5432/x' }
			}
		]
	}
	const [redacted] = redactSessions([withSecretAnswer])
	const text = JSON.stringify(redacted)
	assert.ok(!text.includes(TOKEN))
	assert.ok(!text.includes('hunter22'))
	assert.equal(countRedactions(redactSessions([withSecretAnswer])), 2)
})

test('redacting twice changes nothing, so the server can always redact again', () => {
	const once = redactSessions([sessionOf({ sessionId: 's1', prompts: [`key ${TOKEN}`] })])
	assert.deepEqual(redactSessions(once), once)
})

test('the upload input accepts parsed sessions and rejects malformed ones', () => {
	const files = [{ fileName: 'a.md', reason: null }]
	const sessions = [sessionOf({ sessionId: 's1', prompts: ['Fix the build'] })]
	assert.ok(uploadInputSchema.safeParse({ files, sessions }).success)
	assert.ok(!uploadInputSchema.safeParse({ files: [], sessions }).success)
	assert.ok(
		!uploadInputSchema.safeParse({ files, sessions: [{ ...sessions[0], sessionId: 'two words' }] })
			.success
	)
	assert.ok(
		!uploadInputSchema.safeParse({ files: [{ fileName: 'a.md', reason: 'made-up' }], sessions })
			.success
	)
})
