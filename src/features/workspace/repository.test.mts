import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { STRONG_SESSION, WEAK_SESSION, sessionOf } from '@/features/assessment/session-fixtures'
import { metricsOverview, sessionMetrics } from '@/features/sessions/metrics'
import {
	deleteUpload,
	deleteUserData,
	getAssessment,
	getUploadView,
	listAssessments,
	listUploads,
	loadSessions,
	runAssessment,
	saveUpload
} from './repository'

// Runs against a real PostgreSQL with the schema applied, named by
// TEST_DATABASE_URL (never the dev or production database). Without it the
// suite is skipped: CI's check job has no database.
const url = process.env.TEST_DATABASE_URL
const TOKEN = `ghp_${'a1B2c3D4e5'.repeat(4)}`

describe('workspace repository against PostgreSQL', { skip: url == null }, () => {
	const db = new PrismaClient({ datasourceUrl: url })
	const alice = randomUUID()
	const bob = randomUUID()
	const files = [
		{ fileName: 'strong.md', reason: null },
		{ fileName: 'notes.txt', reason: 'not-markdown' as const }
	]
	const secretSession = sessionOf({
		sessionId: 'secret-session',
		prompts: [`Fix the deploy in scripts/deploy.sh, it uses ${TOKEN}.`]
	})

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

	test('an upload, its redacted sessions and its metrics are saved together', async () => {
		const uploadId = await saveUpload({
			db,
			userId: alice,
			input: { files, sessions: [STRONG_SESSION, secretSession] }
		})
		const view = await getUploadView({ db, userId: alice, uploadId })
		assert.ok(view)
		assert.equal(view.sessionCount, 2)
		assert.equal(view.fileCount, 2)
		assert.deepEqual(view.rejected, [{ fileName: 'notes.txt', reason: 'not-markdown' }])
		assert.ok(view.redactionCount >= 1)

		const stored = await db.agentSession.findMany({ where: { uploadId } })
		assert.equal(stored.length, 2)
		assert.ok(!JSON.stringify(stored).includes(TOKEN), 'a raw secret reached the database')

		// The free metrics are the same calculation, on the redacted sessions.
		const sessions = await loadSessions({ db, userId: alice, uploadId })
		assert.deepEqual(view.overview, metricsOverview(sessions))
		assert.deepEqual(
			[...view.sessions].sort((a, b) => a.sessionId.localeCompare(b.sessionId)),
			sessions.map(sessionMetrics).sort((a, b) => a.sessionId.localeCompare(b.sessionId))
		)
	})

	test("one user cannot see, score or delete another's upload", async () => {
		const uploadId = await saveUpload({
			db,
			userId: alice,
			input: { files, sessions: [WEAK_SESSION] }
		})
		assert.equal(await getUploadView({ db, userId: bob, uploadId }), null)
		assert.deepEqual(await loadSessions({ db, userId: bob, uploadId }), [])
		assert.ok(!(await listUploads({ db, userId: bob })).some((upload) => upload.id === uploadId))
		assert.equal(await runAssessment({ db, userId: bob, uploadId }), null)
		assert.equal(await deleteUpload({ db, userId: bob, uploadId }), false)
		assert.ok(await getUploadView({ db, userId: alice, uploadId }), 'the owner still has it')
	})

	test('assessments are saved as history, with every skill and traceable evidence', async () => {
		const uploadId = await saveUpload({
			db,
			userId: alice,
			input: { files, sessions: [STRONG_SESSION, WEAK_SESSION] }
		})
		const firstId = await runAssessment({ db, userId: alice, uploadId })
		assert.ok(firstId)
		const first = await getAssessment({ db, userId: alice, assessmentId: firstId })
		assert.ok(first)
		assert.equal(first.assessment.skills.length, 5)
		assert.equal(first.rubricVersion, first.assessment.rubricVersion)
		assert.ok(first.assessment.overall.score != null)

		const prompts = (await loadSessions({ db, userId: alice, uploadId })).flatMap((session) =>
			session.turns.flatMap((turn) => (turn.prompt == null ? [] : [turn.prompt.text]))
		)
		for (const evidence of first.assessment.skills.flatMap((skill) => skill.evidence)) {
			assert.ok(
				prompts.some((prompt) => prompt.slice(evidence.start, evidence.end) === evidence.excerpt),
				`untraceable: ${evidence.excerpt}`
			)
		}

		const secondId = await runAssessment({ db, userId: alice, uploadId })
		assert.ok(secondId && secondId !== firstId)
		const again = await getAssessment({ db, userId: alice, assessmentId: firstId })
		assert.deepEqual(again?.assessment, first.assessment, 'an old assessment is never rewritten')
		const history = await listAssessments({ db, userId: alice })
		assert.ok([firstId, secondId].every((id) => history.some((each) => each.id === id)))

		assert.equal(await getAssessment({ db, userId: bob, assessmentId: firstId }), null)
		assert.ok(!(await listAssessments({ db, userId: bob })).some((each) => each.id === firstId))
	})

	test('deleting an upload removes its sessions, metrics and assessments', async () => {
		const uploadId = await saveUpload({
			db,
			userId: alice,
			input: { files, sessions: [STRONG_SESSION] }
		})
		const assessmentId = await runAssessment({ db, userId: alice, uploadId })
		assert.equal(await deleteUpload({ db, userId: alice, uploadId }), true)
		assert.equal(await db.agentSession.count({ where: { uploadId } }), 0)
		assert.equal(await db.uploadMetrics.count({ where: { uploadId } }), 0)
		assert.equal(await db.assessment.count({ where: { id: assessmentId ?? '' } }), 0)
		assert.equal(await db.skillAssessment.count({ where: { assessmentId: assessmentId ?? '' } }), 0)
	})

	test("deleting a user's data removes everything they own, and nothing of anyone else's", async () => {
		const bobsUpload = await saveUpload({
			db,
			userId: bob,
			input: { files, sessions: [WEAK_SESSION] }
		})
		const carol = randomUUID()
		await db.user.create({ data: { id: carol, email: `carol-${carol}@test.dojo` } })
		const carolsUpload = await saveUpload({
			db,
			userId: carol,
			input: { files, sessions: [STRONG_SESSION] }
		})
		await runAssessment({ db, userId: carol, uploadId: carolsUpload })
		await deleteUserData({ db, userId: carol })
		for (const table of [db.upload, db.agentSession, db.assessment] as const) {
			assert.equal(await table.count({ where: { userId: carol } }), 0)
		}
		assert.equal(await db.user.count({ where: { id: carol } }), 0)
		assert.ok(await getUploadView({ db, userId: bob, uploadId: bobsUpload }))
	})
})
