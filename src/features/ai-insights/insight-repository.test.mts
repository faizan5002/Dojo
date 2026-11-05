import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { AiError } from '@/server/ai/llm-core'
import { generationsSince, getOrGenerateInsight, latestInsight } from './insight-repository'
import { INSIGHT_SCHEMAS, type RecommendationExplanation } from './schemas'

// Stored AI insights against TEST_DATABASE_URL (skipped without it): reuse of
// an unchanged input, the daily limit, recorded failures and isolation between
// users. The model is a fake that counts its calls; nothing reaches xAI.

const url = process.env.TEST_DATABASE_URL
const parse = (value: unknown) => INSIGHT_SCHEMAS.recommendation_explanation.parse(value)
const ANSWER: RecommendationExplanation = {
	headline: 'Practise verification next.',
	reasons: ['Your verification score is 22, your lowest.'],
	focusTip: 'Ask for the test output.'
}

function fakeModel(answer: () => Promise<RecommendationExplanation>) {
	const counter = { calls: 0 }
	return {
		counter,
		generate: async () => {
			counter.calls++
			return { data: await answer() }
		}
	}
}

describe('AI insights in PostgreSQL', { skip: url == null }, () => {
	const db = new PrismaClient({ datasourceUrl: url })
	const alice = randomUUID()
	const bob = randomUUID()
	const base = {
		db,
		feature: 'recommendation_explanation' as const,
		model: 'grok-4.7',
		parse
	}

	before(async () => {
		await db.user.createMany({
			data: [
				{ id: alice, email: `alice-${alice}@test.dojo` },
				{ id: bob, email: `bob-${bob}@test.dojo` }
			]
		})
	})

	after(async () => {
		await db.user.deleteMany({ where: { id: { in: [alice, bob] } } })
		await db.$disconnect()
	})

	test('a generation is stored; the same input is then reused at no cost', async () => {
		const model = fakeModel(async () => ANSWER)
		const first = await getOrGenerateInsight({
			...base,
			userId: alice,
			subjectId: 'next:a',
			input: { x: 1 },
			generate: model.generate
		})
		const second = await getOrGenerateInsight({
			...base,
			userId: alice,
			subjectId: 'next:a',
			input: { x: 1 },
			generate: model.generate
		})
		assert.equal(model.counter.calls, 1)
		assert.equal(first.cached, false)
		assert.equal(second.cached, true)
		assert.equal(second.insight.id, first.insight.id)
		assert.deepEqual(second.insight.output, ANSWER)
		assert.match(first.insight.promptVersion, /^recommendation_explanation\.v\d+$/)
		assert.equal(first.insight.model, 'grok-4.7')
	})

	test('a changed input, or another model, generates again and keeps the earlier result', async () => {
		const model = fakeModel(async () => ANSWER)
		await getOrGenerateInsight({
			...base,
			userId: alice,
			subjectId: 'next:b',
			input: { x: 1 },
			generate: model.generate
		})
		await getOrGenerateInsight({
			...base,
			userId: alice,
			subjectId: 'next:b',
			input: { x: 2 },
			generate: model.generate
		})
		await getOrGenerateInsight({
			...base,
			model: 'another-model',
			userId: alice,
			subjectId: 'next:b',
			input: { x: 2 },
			generate: model.generate
		})
		assert.equal(model.counter.calls, 3)
		assert.equal(
			await db.aiInsight.count({ where: { userId: alice, subjectId: 'next:b', status: 'ok' } }),
			3
		)
	})

	test('a failure is recorded with its reason, rethrown, and never served as a result', async () => {
		const broken = fakeModel(async () => {
			throw new AiError('invalid_output')
		})
		await assert.rejects(
			getOrGenerateInsight({
				...base,
				userId: alice,
				subjectId: 'next:c',
				input: { x: 1 },
				generate: broken.generate
			}),
			(error: unknown) => error instanceof AiError && error.failure === 'invalid_output'
		)
		const row = await db.aiInsight.findFirst({ where: { userId: alice, subjectId: 'next:c' } })
		assert.equal(row?.status, 'failed')
		assert.equal(row?.errorCode, 'invalid_output')
		assert.equal(row?.output, null)
		assert.equal(await latestInsight({ ...base, userId: alice, subjectId: 'next:c' }), null)

		const unexpected = fakeModel(async () => {
			throw new Error('socket hang up')
		})
		await assert.rejects(
			getOrGenerateInsight({
				...base,
				userId: alice,
				subjectId: 'next:c',
				input: { x: 1 },
				generate: unexpected.generate
			}),
			(error: unknown) => error instanceof AiError && error.failure === 'unavailable'
		)
	})

	test('past the daily limit nothing is generated, but stored results are still served', async () => {
		const model = fakeModel(async () => ANSWER)
		const now = new Date()
		const used = await generationsSince({
			db,
			userId: bob,
			since: new Date(now.getTime() - 86_400_000)
		})
		const limit = used + 2
		for (const n of [1, 2]) {
			await getOrGenerateInsight({
				...base,
				userId: bob,
				subjectId: `next:q${n}`,
				input: { n },
				generate: model.generate,
				dailyLimit: limit
			})
		}
		await assert.rejects(
			getOrGenerateInsight({
				...base,
				userId: bob,
				subjectId: 'next:q3',
				input: { n: 3 },
				generate: model.generate,
				dailyLimit: limit
			}),
			(error: unknown) => error instanceof AiError && error.failure === 'quota_exceeded'
		)
		assert.equal(model.counter.calls, 2, 'the third was refused before the model was asked')
		const reused = await getOrGenerateInsight({
			...base,
			userId: bob,
			subjectId: 'next:q1',
			input: { n: 1 },
			generate: model.generate,
			dailyLimit: limit
		})
		assert.equal(reused.cached, true)
		// The window is 24 hours: tomorrow the same user may generate again.
		const tomorrow = new Date(now.getTime() + 86_400_000 + 1_000)
		const next = await getOrGenerateInsight({
			...base,
			userId: bob,
			subjectId: 'next:q4',
			input: { n: 4 },
			generate: model.generate,
			dailyLimit: limit,
			now: tomorrow
		})
		assert.equal(next.cached, false)
	})

	test("one user never sees or reuses another user's insight", async () => {
		const model = fakeModel(async () => ANSWER)
		await getOrGenerateInsight({
			...base,
			userId: alice,
			subjectId: 'next:shared',
			input: { same: true },
			generate: model.generate
		})
		assert.equal(await latestInsight({ ...base, userId: bob, subjectId: 'next:shared' }), null)
		const bobs = await getOrGenerateInsight({
			...base,
			userId: bob,
			subjectId: 'next:shared',
			input: { same: true },
			generate: model.generate
		})
		assert.equal(bobs.cached, false, "bob's identical input is not served alice's row")
		assert.equal(model.counter.calls, 2)
	})

	test('deleting a user deletes their insights', async () => {
		const carol = randomUUID()
		await db.user.create({ data: { id: carol, email: `carol-${carol}@test.dojo` } })
		await getOrGenerateInsight({
			...base,
			userId: carol,
			subjectId: 'next:x',
			input: {},
			generate: fakeModel(async () => ANSWER).generate
		})
		await db.user.delete({ where: { id: carol } })
		assert.equal(await db.aiInsight.count({ where: { userId: carol } }), 0)
	})
})
