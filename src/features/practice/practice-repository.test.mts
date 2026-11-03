import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { STRONG_SESSION } from '@/features/assessment/session-fixtures'
import { runAssessment, saveUpload } from '@/features/workspace/repository'
import { CHALLENGE_DEFINITIONS } from '../../../prisma/seed/practice-challenges/index'
import { seedChallenges } from './seed-challenges'
import { getAttempt, listAttempts, recordAttempt } from './practice-repository'

// Runs against TEST_DATABASE_URL (a throwaway database with the schema
// applied); skipped without it, as CI's check job has no database.
const url = process.env.TEST_DATABASE_URL
const TOKEN = `ghp_${'a1B2c3D4e5'.repeat(4)}`
const ANSWER =
	'Add a POST /api/auth/login endpoint to our Express API. Return 200 with a JWT on success and 401 otherwise. Do not change the users schema. Done when tests cover success and a wrong password, and they pass.'

describe('practice repository against PostgreSQL', { skip: url == null }, () => {
	const db = new PrismaClient({ datasourceUrl: url })
	const alice = randomUUID()
	const bob = randomUUID()

	before(async () => {
		await seedChallenges({ db, definitions: CHALLENGE_DEFINITIONS })
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

	test('an attempt is scored on the server and saved with its challenge version', async () => {
		const attempt = await recordAttempt({
			db,
			userId: bob,
			slug: 'clarity-login-api',
			prompt: ANSWER
		})
		assert.ok(attempt)
		assert.equal(attempt.challengeVersion, 1)
		const version = await db.practiceChallengeVersion.findUnique({
			where: { id: attempt.challengeVersionId ?? '' },
			select: { version: true, challenge: { select: { slug: true } } }
		})
		assert.equal(
			version?.challenge.slug,
			'clarity-login-api',
			'linked to the version it was scored on'
		)
		assert.equal(version?.version, attempt.challengeVersion)
		assert.equal(attempt.skill, 'promptClarity')
		assert.ok(attempt.score >= 60, `scored ${attempt.score}`)
		assert.equal(attempt.evaluation.score, attempt.score)
		assert.ok(attempt.reviewAfter.getTime() > attempt.createdAt.getTime())
		assert.equal(attempt.assessmentId, null, 'bob has no assessment to link')
	})

	test('a retry adds an attempt and never rewrites the first', async () => {
		const first = await recordAttempt({
			db,
			userId: bob,
			slug: 'scope-remember-me',
			prompt: 'Add a remember me checkbox please, thanks a lot.'
		})
		const second = await recordAttempt({
			db,
			userId: bob,
			slug: 'scope-remember-me',
			prompt:
				'Add only a "Remember me" checkbox to the login form so the session lasts 30 days. Do not change the styling or the dependencies. Done when the login tests pass.'
		})
		assert.ok(first && second && first.id !== second.id)
		assert.ok(second.score > first.score)
		const reread = await getAttempt({ db, userId: bob, attemptId: first.id })
		assert.equal(reread?.score, first.score)
		assert.equal(reread?.prompt, first.prompt)
		const ids = (await listAttempts({ db, userId: bob })).map((each) => each.id)
		assert.ok(ids.includes(first.id) && ids.includes(second.id))
	})

	test('a credential in an answer is redacted before it is scored or stored', async () => {
		const attempt = await recordAttempt({
			db,
			userId: bob,
			slug: 'clarity-login-api',
			prompt: `${ANSWER} Use the token ${TOKEN} for the test account.`
		})
		assert.ok(attempt)
		const row = await db.practiceAttempt.findUnique({ where: { id: attempt.id } })
		assert.ok(!JSON.stringify(row).includes(TOKEN))
		assert.ok(row?.prompt.includes('[REDACTED:github-token]'))
	})

	test('an unknown challenge is refused and saves nothing', async () => {
		const before = await db.practiceAttempt.count({ where: { userId: bob } })
		assert.equal(
			await recordAttempt({ db, userId: bob, slug: 'no-such-challenge', prompt: ANSWER }),
			null
		)
		assert.equal(await db.practiceAttempt.count({ where: { userId: bob } }), before)
	})

	test("one user cannot read another's attempts", async () => {
		const attempt = await recordAttempt({
			db,
			userId: bob,
			slug: 'clarity-login-api',
			prompt: ANSWER
		})
		assert.ok(attempt)
		assert.equal(await getAttempt({ db, userId: alice, attemptId: attempt.id }), null)
		assert.ok(!(await listAttempts({ db, userId: alice })).some((each) => each.id === attempt.id))
	})

	test('an attempt links to the latest assessment, and survives that assessment being deleted', async () => {
		const uploadId = await saveUpload({
			db,
			userId: alice,
			input: { files: [{ fileName: 'a.md', reason: null }], sessions: [STRONG_SESSION] }
		})
		const assessmentId = await runAssessment({ db, userId: alice, uploadId })
		const attempt = await recordAttempt({
			db,
			userId: alice,
			slug: 'clarity-login-api',
			prompt: ANSWER
		})
		assert.equal(attempt?.assessmentId, assessmentId)

		await db.upload.delete({ where: { id: uploadId } })
		const kept = await getAttempt({ db, userId: alice, attemptId: attempt?.id ?? '' })
		assert.ok(kept, 'the attempt is kept')
		assert.equal(kept.assessmentId, null)
		assert.equal(kept.score, attempt?.score)
	})
})
