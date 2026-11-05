import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { SKILL_IDS } from '@/features/assessment/rubric'
import { CHALLENGE_DEFINITIONS } from '../../../prisma/seed/practice-challenges/index'
import {
	getChallenge,
	getChallengeVersion,
	listCatalog,
	listChallenges
} from './challenge-repository'
import { toDetailDto, toSummaryDto } from './dto'
import { evaluateWithRules } from './evaluate'
import { getAttempt, listAttemptsFor, recordAttempt } from './practice-repository'
import { SeedConflictError, seedChallenges } from './seed-challenges'
import type { ChallengeDefinition } from './types'

// The challenge library in PostgreSQL: seeding, browsing, versioning and
// retirement. Runs against TEST_DATABASE_URL; skipped without it. Challenges
// created here have a `test-` slug and are removed afterwards.

const url = process.env.TEST_DATABASE_URL
const SEEDED = new Set(CHALLENGE_DEFINITIONS.map((each) => each.slug))
const isSeeded = (slug: string) => SEEDED.has(slug)

function definition(slug: string, login = CHALLENGE_DEFINITIONS[0]): ChallengeDefinition {
	assert.ok(login)
	return { ...login, slug, title: `Test ${slug}`, tags: ['test-only'] }
}

describe('the challenge library in PostgreSQL', { skip: url == null }, () => {
	const db = new PrismaClient({ datasourceUrl: url })
	const user = randomUUID()
	const other = randomUUID()
	const testSlug = `test-${randomUUID().slice(0, 8)}`

	before(async () => {
		await seedChallenges({ db, definitions: CHALLENGE_DEFINITIONS })
		await db.user.createMany({
			data: [
				{ id: user, email: `guru-${user}@test.dojo` },
				{ id: other, email: `guru-${other}@test.dojo` }
			]
		})
	})

	after(async () => {
		await db.user.deleteMany({ where: { id: { in: [user, other] } } })
		const own = await db.practiceChallenge.findMany({
			where: { slug: { startsWith: 'test-' } },
			select: { id: true }
		})
		const ids = own.map((each) => each.id)
		await db.practiceAttempt.deleteMany({ where: { scoredVersion: { challengeId: { in: ids } } } })
		await db.practiceChallenge.updateMany({
			where: { id: { in: ids } },
			data: { currentVersionId: null }
		})
		await db.practiceChallengeVersion.deleteMany({ where: { challengeId: { in: ids } } })
		await db.practiceChallenge.deleteMany({ where: { id: { in: ids } } })
		await db.$disconnect()
	})

	test('the seed stores all 40 challenges, and running it again changes nothing', async () => {
		const again = await seedChallenges({ db, definitions: CHALLENGE_DEFINITIONS })
		assert.deepEqual([again.created.length, again.versioned.length], [0, 0])
		assert.equal(again.unchanged.length, 40)
		const stored = await db.practiceChallenge.findMany({
			where: { slug: { in: [...SEEDED] } },
			include: { _count: { select: { versions: true } } }
		})
		assert.equal(stored.length, 40)
		assert.ok(stored.every((each) => each._count.versions === 1 && each.currentVersionId != null))
	})

	test('every skill has eight active challenges across three difficulties', async () => {
		const catalog = (await listCatalog({ db })).filter((each) => isSeeded(each.slug))
		for (const skill of SKILL_IDS) {
			const own = catalog.filter((each) => each.skill === skill)
			assert.equal(own.length, 8, skill)
			assert.equal(new Set(own.map((each) => each.difficulty)).size, 3, skill)
		}
	})

	test('browsing filters by skill, difficulty and type, searches, and pages', async () => {
		const bySkill = await listChallenges({ db, filters: { skill: 'planning' }, pageSize: 50 })
		assert.ok(bySkill.items.every((each) => each.skill === 'planning'))
		assert.equal(bySkill.items.filter((each) => isSeeded(each.slug)).length, 8)

		const advanced = await listChallenges({
			db,
			filters: { skill: 'verification', difficulty: 'advanced' },
			pageSize: 50
		})
		assert.deepEqual(advanced.items.map((each) => each.slug).sort(), [
			'verification-acceptance-check',
			'verification-migration-script'
		])

		const byType = await listChallenges({ db, filters: { type: 'controlScope' }, pageSize: 50 })
		assert.ok(byType.items.every((each) => each.type === 'controlScope'))

		const search = await listChallenges({ db, filters: { search: 'WEBHOOK' }, pageSize: 50 })
		assert.ok(search.items.some((each) => each.slug === 'planning-payment-intents'))
		const byTag = await listChallenges({ db, filters: { search: 'websockets' }, pageSize: 50 })
		assert.deepEqual(
			byTag.items.map((each) => each.slug),
			['iteration-third-attempt']
		)

		const first = await listChallenges({ db, page: 1, pageSize: 7 })
		const second = await listChallenges({ db, page: 2, pageSize: 7 })
		assert.equal(first.items.length, 7)
		assert.ok(first.total >= 40)
		const firstSlugs = new Set(first.items.map((each) => each.slug))
		assert.ok(
			second.items.every((each) => !firstSlugs.has(each.slug)),
			'pages do not overlap'
		)

		const none = await listChallenges({ db, filters: { search: 'no such challenge text' } })
		assert.deepEqual([none.items.length, none.total], [0, 0])
	})

	test('what browsing and the detail view expose carries no criteria and no strong answer', async () => {
		const login = await getChallenge({ db, slug: 'clarity-login-api' })
		assert.ok(login)
		const page = await listChallenges({ db, filters: { search: login.title } })
		for (const shown of [
			JSON.stringify(page.items.map(toSummaryDto)),
			JSON.stringify(toDetailDto(login))
		]) {
			assert.ok(!shown.includes(login.exemplar.slice(0, 40)), 'the strong answer is not exposed')
			assert.ok(
				!shown.includes('criteria') && !shown.includes('exemplar') && !shown.includes('bcrypt')
			)
		}
	})

	test('the stored rubric scores exactly as the seed content does', async () => {
		for (const seeded of CHALLENGE_DEFINITIONS) {
			const stored = await getChallenge({ db, slug: seeded.slug })
			assert.ok(stored, seeded.slug)
			const fromDb = evaluateWithRules({ challenge: stored, prompt: seeded.exemplar })
			assert.equal(fromDb.score, 100, `${seeded.slug} scored ${fromDb.score} from the database`)
			assert.deepEqual(fromDb, evaluateWithRules({ challenge: seeded, prompt: seeded.exemplar }))
		}
	})

	test('an edit needs a version bump; old attempts keep the version they were scored on', async () => {
		const v1 = definition(testSlug)
		await seedChallenges({ db, definitions: [v1] })
		const first = await recordAttempt({ db, userId: user, slug: testSlug, prompt: v1.exemplar })
		assert.ok(first?.challengeVersionId)

		const edited = {
			...v1,
			exemplar: `${v1.exemplar} Also log every failed login.`,
			criteria: v1.criteria.slice(1)
		}
		await assert.rejects(seedChallenges({ db, definitions: [edited] }), SeedConflictError)

		const report = await seedChallenges({ db, definitions: [{ ...edited, version: 2 }] })
		assert.deepEqual(report.versioned, [testSlug])
		const current = await getChallenge({ db, slug: testSlug })
		assert.equal(current?.version, 2)
		assert.equal(current?.criteria.length, v1.criteria.length - 1)

		const second = await recordAttempt({ db, userId: user, slug: testSlug, prompt: v1.exemplar })
		assert.equal(second?.challengeVersion, 2)
		assert.notEqual(second?.challengeVersionId, first.challengeVersionId)

		const kept = await getAttempt({ db, userId: user, attemptId: first.id })
		assert.equal(kept?.challengeVersion, 1)
		assert.equal(kept?.evaluation.criteria.length, v1.criteria.length, 'old result unchanged')
		const original = await getChallengeVersion({ db, versionId: first.challengeVersionId })
		assert.equal(original?.exemplar, v1.exemplar, 'the version it was scored on is intact')
	})

	test('a retired challenge leaves the library but keeps its history, and takes no attempts', async () => {
		const slug = `${testSlug}-retired`
		const active = definition(slug)
		await seedChallenges({ db, definitions: [active] })
		const attempt = await recordAttempt({ db, userId: user, slug, prompt: active.exemplar })
		assert.ok(attempt)

		await seedChallenges({ db, definitions: [{ ...active, isActive: false }] })
		const listed = await listChallenges({ db, filters: { search: active.title } })
		assert.equal(listed.total, 0)
		assert.ok(!(await listCatalog({ db })).some((each) => each.slug === slug))
		assert.equal((await getChallenge({ db, slug }))?.isActive, false)
		assert.equal(await recordAttempt({ db, userId: user, slug, prompt: active.exemplar }), null)
		assert.deepEqual(
			(await listAttemptsFor({ db, userId: user, slug })).map((each) => each.id),
			[attempt.id]
		)
	})

	test('attempts are private to their user', async () => {
		const mine = await recordAttempt({
			db,
			userId: user,
			slug: 'scope-remember-me',
			prompt: 'Add only a remember me checkbox to the login form, and do not change anything else.'
		})
		assert.ok(mine)
		assert.equal(await getAttempt({ db, userId: other, attemptId: mine.id }), null)
		assert.deepEqual(await listAttemptsFor({ db, userId: other, slug: 'scope-remember-me' }), [])
	})

	test('an attempt saved before the library moved to the database is linked by the seed', async () => {
		const legacy = await db.practiceAttempt.create({
			data: {
				userId: user,
				challengeSlug: 'clarity-login-api',
				challengeVersion: 1,
				skill: 'promptClarity',
				exerciseType: 'improveVaguePrompt',
				difficulty: 'beginner',
				prompt: 'An answer saved by the code-library release.',
				score: 40,
				band: 'developing',
				evaluator: 'rules-1.0',
				evaluation: {},
				reviewAfter: new Date()
			}
		})
		const report = await seedChallenges({ db, definitions: CHALLENGE_DEFINITIONS })
		assert.ok(report.linkedAttempts >= 1)
		const linked = await db.practiceAttempt.findUnique({
			where: { id: legacy.id },
			select: { challengeVersionId: true, scoredVersion: { select: { version: true } } }
		})
		assert.equal(linked?.scoredVersion?.version, 1)
	})

	test('a seed with a duplicate slug or a changed skill is refused', async () => {
		const login = CHALLENGE_DEFINITIONS[0]
		assert.ok(login)
		await assert.rejects(seedChallenges({ db, definitions: [login, login] }), SeedConflictError)
		await assert.rejects(
			seedChallenges({ db, definitions: [{ ...login, skill: 'planning', version: 9 }] }),
			SeedConflictError
		)
	})
})
