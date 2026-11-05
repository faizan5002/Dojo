import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SKILL_IDS } from '@/features/assessment/rubric'
import { CHALLENGE_DEFINITIONS } from '../../../prisma/seed/practice-challenges/index'
import {
	contentHashOf,
	decodeCriteria,
	decodePitfalls,
	encodeCriteria,
	encodePitfalls
} from './challenge-codec'
import { evaluateWithRules, rulesEvaluator } from './evaluate'
import {
	PRACTICE_CONFIG,
	buildPracticePlan,
	nextDifficulty,
	priorityOf,
	reviewAfter,
	summarizePractice,
	type AssessedSkill,
	type AttemptRecord
} from './plan'
import type { CatalogEntry, ChallengeDefinition } from './types'

const NOW = new Date('2026-11-03T12:00:00Z')
const HOUR = 3_600_000
const DAY = 86_400_000

function challenge(slug: string): ChallengeDefinition {
	const found = CHALLENGE_DEFINITIONS.find((each) => each.slug === slug)
	assert.ok(found, `no challenge ${slug}`)
	return found
}

/** The planner's view of the seeded library, as listCatalog would return it. */
const CATALOG: readonly CatalogEntry[] = CHALLENGE_DEFINITIONS.map((each) => ({
	slug: each.slug,
	version: each.version,
	title: each.title,
	description: each.description,
	skill: each.skill,
	type: each.type,
	difficulty: each.difficulty,
	minutes: each.minutes,
	tags: each.tags
}))

function planFor(input: {
	assessed: readonly AssessedSkill[] | null
	attempts: readonly AttemptRecord[]
	catalog?: readonly CatalogEntry[]
}) {
	return buildPracticePlan({ catalog: CATALOG, ...input, now: NOW })
}

let sequence = 0
function attempt(
	overrides: Partial<AttemptRecord> & { challengeSlug: string; score: number }
): AttemptRecord {
	const source = challenge(overrides.challengeSlug)
	const createdAt = overrides.createdAt ?? new Date(NOW.getTime() - 2 * DAY)
	return {
		id: `a${sequence++}`,
		challengeVersion: source.version,
		skill: source.skill,
		difficulty: source.difficulty,
		createdAt,
		reviewAfter: reviewAfter({ score: overrides.score, from: createdAt }),
		...overrides
	}
}

const EXAMPLE: readonly AssessedSkill[] = [
	{ skill: 'promptClarity', score: 45 },
	{ skill: 'planning', score: 82 },
	{ skill: 'verification', score: 38 },
	{ skill: 'iteration', score: 71 },
	{ skill: 'scopeControl', score: 65 }
]

// --- the library (seed content) ------------------------------------------

test('the library has 40 challenges: 8 per skill, 3 beginner, 3 intermediate, 2 advanced', () => {
	assert.equal(CHALLENGE_DEFINITIONS.length, 40)
	assert.equal(new Set(CHALLENGE_DEFINITIONS.map((each) => each.slug)).size, 40)
	for (const skill of SKILL_IDS) {
		const own = CHALLENGE_DEFINITIONS.filter((each) => each.skill === skill)
		assert.equal(own.length, 8, `${skill} has ${own.length}`)
		const count = (difficulty: string) =>
			own.filter((each) => each.difficulty === difficulty).length
		assert.deepEqual(
			[count('beginner'), count('intermediate'), count('advanced')],
			[3, 3, 2],
			skill
		)
		assert.equal(new Set(own.map((each) => each.type)).size, 1, `${skill} mixes exercise types`)
	}
})

test('no two challenges share a title or a scenario', () => {
	assert.equal(new Set(CHALLENGE_DEFINITIONS.map((each) => each.title)).size, 40)
	assert.equal(new Set(CHALLENGE_DEFINITIONS.map((each) => each.scenario)).size, 40)
})

test('every challenge has criteria, positive weights and a strong example that scores well', () => {
	for (const each of CHALLENGE_DEFINITIONS) {
		assert.ok(each.criteria.length >= 4, `${each.slug}: too few criteria`)
		assert.ok(each.criteria.every((criterion) => criterion.weight > 0))
		const result = evaluateWithRules({ challenge: each, prompt: each.exemplar })
		assert.ok(result.score >= 80, `${each.slug}: its own example scored ${result.score}`)
		for (const pattern of [
			...each.criteria.flatMap((c) => c.anyOf),
			...each.pitfalls.map((p) => p.pattern)
		]) {
			assert.ok(!pattern.global, `${each.slug}: a global regex keeps state between calls`)
		}
	}
})

test('a weak answer and the vague prompt itself score low on every challenge', () => {
	const weak = 'Please make it work and add tests. Thanks, looks good to me overall today.'
	for (const each of CHALLENGE_DEFINITIONS) {
		assert.ok(evaluateWithRules({ challenge: each, prompt: weak }).score <= 40, each.slug)
		if (each.given != null) {
			const given = evaluateWithRules({ challenge: each, prompt: each.given.text })
			assert.ok(given.score <= 25, `${each.slug}: the given text scored ${given.score}`)
		}
	}
})

test('a rubric stored as JSON scores exactly like the authored one', () => {
	for (const each of CHALLENGE_DEFINITIONS) {
		const stored = JSON.parse(
			JSON.stringify({
				criteria: encodeCriteria(each.criteria),
				pitfalls: encodePitfalls(each.pitfalls)
			})
		)
		const decoded = {
			...each,
			criteria: decodeCriteria(stored.criteria),
			pitfalls: decodePitfalls(stored.pitfalls)
		}
		for (const prompt of [each.exemplar, each.given?.text ?? 'Do the task, thanks.']) {
			assert.deepEqual(
				evaluateWithRules({ challenge: decoded, prompt }),
				evaluateWithRules({ challenge: each, prompt }),
				each.slug
			)
		}
	}
})

test('a stored rubric with a stateful flag or no patterns is rejected', () => {
	const criterion = encodeCriteria(challenge('clarity-login-api').criteria)[0]
	assert.ok(criterion)
	assert.throws(() => decodeCriteria([{ ...criterion, anyOf: [{ source: 'login', flags: 'gi' }] }]))
	assert.throws(() => decodeCriteria([{ ...criterion, anyOf: [] }]))
	assert.throws(() => decodeCriteria([]))
})

test('the content hash changes with the content, not with the version number', () => {
	const login = challenge('clarity-login-api')
	assert.equal(contentHashOf(login), contentHashOf({ ...login }))
	assert.notEqual(contentHashOf(login), contentHashOf({ ...login, exemplar: `${login.exemplar} ` }))
	const reweighted = login.criteria.map((each, index) =>
		index === 0 ? { ...each, weight: each.weight + 1 } : each
	)
	assert.notEqual(contentHashOf(login), contentHashOf({ ...login, criteria: reweighted }))
	assert.equal(contentHashOf(login), contentHashOf({ ...login, version: login.version + 1 }))
})

// --- the evaluator ---------------------------------------------------------

test('scores are 0–100, deterministic, and explained criterion by criterion', () => {
	const login = challenge('clarity-login-api')
	const prompt =
		'Add a POST /api/auth/login endpoint to our Express API that returns a JWT on success.'
	const first = rulesEvaluator.evaluate({ challenge: login, prompt })
	const again = rulesEvaluator.evaluate({ challenge: login, prompt })
	assert.deepEqual(first, again)
	assert.ok(first.score >= 0 && first.score <= 100)
	assert.equal(first.criteria.length, login.criteria.length)
	for (const result of first.criteria) {
		if (result.status === 'met')
			assert.ok(result.evidence != null && prompt.includes(result.evidence))
		if (result.status === 'missing') assert.equal(result.points, 0)
	}
})

test('the strong answer beats a weak one, and a full answer is not just a long one', () => {
	const login = challenge('clarity-login-api')
	const strong = evaluateWithRules({ challenge: login, prompt: login.exemplar })
	const long = evaluateWithRules({
		challenge: login,
		prompt:
			'Please build the login thing for our app and make it really good and nice for the users, because right now we do not have one and it would be very helpful for everybody if it existed and worked the way people expect it to work when they visit.'
	})
	assert.ok(strong.score > long.score + 40, `strong ${strong.score} vs long ${long.score}`)
})

test('a bare keyword list earns only partial credit', () => {
	const notes = challenge('verification-notes-endpoint')
	const keywords = evaluateWithRules({
		challenge: notes,
		prompt: 'tests. validation. auth. evidence. show output.'
	})
	assert.ok(keywords.criteria.every((result) => result.status !== 'met'))
	assert.ok(keywords.score <= 25)
})

test('a criterion met outside the scenario counts half, with the reason given', () => {
	const reset = challenge('planning-password-reset')
	const result = evaluateWithRules({
		challenge: reset,
		prompt:
			'Before starting, please inspect the existing codebase for the billing module carefully. Then propose a step-by-step plan for me.'
	})
	const inspect = result.criteria.find((each) => each.id === 'inspect')
	assert.equal(inspect?.status, 'partial')
	assert.match(inspect?.note ?? '', /not tied to this task/)
})

test('an unchanged or too-short answer is capped, and the cap is explained', () => {
	const login = challenge('clarity-login-api')
	const unchanged = evaluateWithRules({ challenge: login, prompt: 'Build a login API.' })
	assert.ok(unchanged.score <= 10)
	assert.ok(unchanged.caps.length >= 1)
	const short = evaluateWithRules({
		challenge: login,
		prompt: 'Add login with JWT, tests must pass.'
	})
	assert.ok(short.score <= 25)
	assert.ok(short.caps.some((cap) => /too short/.test(cap)))
})

test('pitfalls cost points and are quoted', () => {
	const scope = challenge('scope-remember-me')
	const clean =
		'Add only a "Remember me" checkbox to the login form so the session lasts 30 days. Do not change the styling or the dependencies.'
	const sweeping = `${clean} While you're at it, refactor everything in the auth module.`
	const a = evaluateWithRules({ challenge: scope, prompt: clean })
	const b = evaluateWithRules({ challenge: scope, prompt: sweeping })
	assert.ok(b.score < a.score)
	assert.equal(b.pitfalls[0]?.id, 'sweeping')
	assert.ok(sweeping.includes(b.pitfalls[0]?.evidence ?? '\u0000'))
})

test("the suggestion keeps the user's words and adds only what is missing", () => {
	const login = challenge('clarity-login-api')
	const prompt =
		'Add a POST /api/auth/login endpoint to our Express API that returns a JWT on success.'
	const result = evaluateWithRules({ challenge: login, prompt })
	assert.ok(result.suggestion.startsWith(prompt))
	const added = result.suggestion.slice(prompt.length)
	for (const criterion of login.criteria) {
		const wasMet = result.criteria.find((each) => each.id === criterion.id)?.status === 'met'
		assert.equal(added.includes(criterion.template), !wasMet, criterion.id)
	}
})

// --- the planner -----------------------------------------------------------

test('priorities follow the documented score bands', () => {
	assert.deepEqual([0, 39, 40, 59, 60, 79, 80, 100].map(priorityOf), [
		'critical',
		'critical',
		'high',
		'high',
		'moderate',
		'moderate',
		'maintenance',
		'maintenance'
	])
})

test('practice is weighted toward the weakest skills, as in the worked example', () => {
	const plan = planFor({ assessed: EXAMPLE, attempts: [] })
	assert.equal(plan.mode, 'personalized')
	const share = (skill: string) => plan.skills.find((each) => each.skill === skill)?.share ?? 0
	assert.ok(share('verification') > share('promptClarity'))
	assert.ok(share('promptClarity') > share('scopeControl'))
	assert.ok(share('planning') < 0.1)
	assert.ok(Math.abs(plan.skills.reduce((total, each) => total + each.share, 0) - 1) < 1e-9)
	assert.deepEqual(plan.focus, ['verification', 'promptClarity'])
	assert.equal(plan.next?.skill, 'verification')
	assert.equal(plan.next?.difficulty, 'beginner')
})

test('within the same priority band, the lower score comes first', () => {
	const scores: Record<string, number> = {
		promptClarity: 35,
		planning: 70,
		verification: 75,
		iteration: 12,
		scopeControl: 85
	}
	const assessed = SKILL_IDS.map((skill) => ({ skill, score: scores[skill] ?? null }))
	const plan = planFor({ assessed, attempts: [] })
	assert.deepEqual(plan.focus, ['iteration', 'promptClarity'])
	assert.equal(plan.next?.skill, 'iteration')
})

test('an unscored skill is never treated as a weakness', () => {
	const assessed = EXAMPLE.map((each) =>
		each.skill === 'verification' ? { ...each, score: null } : each
	)
	const plan = planFor({ assessed, attempts: [] })
	const verification = plan.skills.find((each) => each.skill === 'verification')
	assert.equal(verification?.priority, 'unassessed')
	assert.ok(!plan.focus.includes('verification'))
	assert.equal(plan.next?.skill, 'promptClarity')
})

test('with too few scored skills the plan says it cannot rank reliably', () => {
	const assessed = SKILL_IDS.map((skill) => ({ skill, score: skill === 'iteration' ? 30 : null }))
	assert.equal(planFor({ assessed, attempts: [] }).mode, 'limited')
})

test('with no assessment, a newcomer gets the introduction the library tags', () => {
	const plan = planFor({ assessed: null, attempts: [] })
	assert.equal(plan.mode, 'general')
	assert.equal(plan.next?.reason, 'introduction')
	assert.equal(plan.next?.slug, 'clarity-login-api')
	assert.deepEqual(plan.focus, [])
})

test('without a tagged introduction, the first beginner challenge in rubric order is used', () => {
	const untagged = CATALOG.map((each) => ({
		...each,
		tags: each.tags.filter((tag) => tag !== 'introduction')
	}))
	const plan = planFor({ assessed: null, attempts: [], catalog: untagged })
	assert.equal(plan.next?.reason, 'introduction')
	assert.equal(plan.next?.skill, 'promptClarity')
	assert.equal(plan.next?.difficulty, 'beginner')
})

test('only challenges in the catalog are recommended or due: a retired one never is', () => {
	const weak = attempt({ challengeSlug: 'verification-notes-endpoint', score: 30 })
	const retired = CATALOG.filter((each) => each.slug !== 'verification-notes-endpoint')
	const plan = planFor({ assessed: EXAMPLE, attempts: [weak], catalog: retired })
	assert.deepEqual(plan.due, [])
	assert.notEqual(plan.next?.reason, 'review')
	assert.notEqual(plan.next?.slug, 'verification-notes-endpoint')
})

test('with every beginner challenge of a skill tried today, another one is still offered', () => {
	const today = CATALOG.filter(
		(each) => each.skill === 'verification' && each.difficulty === 'beginner'
	).map((each) =>
		attempt({
			challengeSlug: each.slug,
			score: 90,
			createdAt: new Date(NOW.getTime() - HOUR)
		})
	)
	const plan = planFor({ assessed: EXAMPLE, attempts: today })
	assert.ok(plan.next != null)
	assert.ok(!today.some((each) => each.challengeSlug === plan.next?.slug))
})

test('an empty library recommends nothing rather than failing', () => {
	assert.equal(planFor({ assessed: EXAMPLE, attempts: [], catalog: [] }).next, null)
	assert.equal(planFor({ assessed: null, attempts: [], catalog: [] }).next, null)
})

test('a new assessment changes the recommendation', () => {
	const before = planFor({ assessed: EXAMPLE, attempts: [] })
	const after = planFor({
		assessed: EXAMPLE.map((each) => ({
			...each,
			score: each.skill === 'scopeControl' ? 15 : each.skill === 'verification' ? 90 : each.score
		})),
		attempts: []
	})
	assert.equal(before.next?.skill, 'verification')
	assert.equal(after.next?.skill, 'scopeControl')
})

test('difficulty starts from the assessment, then steps up after 80+ and down under 40', () => {
	assert.equal(nextDifficulty({ assessmentScore: 38, latest: undefined }), 'beginner')
	assert.equal(nextDifficulty({ assessmentScore: 65, latest: undefined }), 'intermediate')
	assert.equal(nextDifficulty({ assessmentScore: 85, latest: undefined }), 'advanced')
	assert.equal(nextDifficulty({ assessmentScore: null, latest: undefined }), 'beginner')
	const at = (challengeSlug: string, score: number) => attempt({ challengeSlug, score })
	assert.equal(
		nextDifficulty({ assessmentScore: 38, latest: at('verification-notes-endpoint', 90) }),
		'intermediate'
	)
	assert.equal(
		nextDifficulty({ assessmentScore: 38, latest: at('verification-date-refactor', 20) }),
		'beginner'
	)
	assert.equal(
		nextDifficulty({ assessmentScore: 38, latest: at('verification-date-refactor', 60) }),
		'intermediate'
	)
	assert.equal(
		nextDifficulty({ assessmentScore: 90, latest: at('verification-migration-script', 95) }),
		'advanced'
	)
})

test('after practising one skill, the plan moves to the skill most behind its share', () => {
	const plan = planFor({
		assessed: EXAMPLE,
		attempts: [attempt({ challengeSlug: 'verification-notes-endpoint', score: 90 })]
	})
	assert.equal(plan.next?.skill, 'promptClarity')
})

test('a challenge done in the last day is not offered again while others remain', () => {
	const recent = attempt({
		challengeSlug: 'verification-notes-endpoint',
		score: 55,
		createdAt: new Date(NOW.getTime() - HOUR)
	})
	const plan = planFor({ assessed: EXAMPLE, attempts: [recent] })
	assert.notEqual(plan.next?.slug, 'verification-notes-endpoint')
})

test('a weak attempt on a focus skill comes back as a due review', () => {
	const weak = attempt({
		challengeSlug: 'verification-notes-endpoint',
		score: 30,
		createdAt: new Date(NOW.getTime() - 2 * DAY)
	})
	const plan = planFor({ assessed: EXAMPLE, attempts: [weak] })
	assert.deepEqual(
		plan.due.map((each) => each.slug),
		['verification-notes-endpoint']
	)
	assert.equal(plan.next?.reason, 'review')
	assert.equal(plan.next?.slug, 'verification-notes-endpoint')
})

test('review intervals follow the score', () => {
	const days = (score: number) =>
		(reviewAfter({ score, from: NOW }).getTime() - NOW.getTime()) / DAY
	assert.deepEqual(
		[10, 50, 70, 95].map(days),
		PRACTICE_CONFIG.reviewDays.map((band) => band.days)
	)
})

test('trends compare only repeated attempts of the same challenge version', () => {
	const first = attempt({
		challengeSlug: 'scope-remember-me',
		score: 40,
		createdAt: new Date(NOW.getTime() - 3 * DAY)
	})
	const retry = attempt({
		challengeSlug: 'scope-remember-me',
		score: 75,
		createdAt: new Date(NOW.getTime() - DAY)
	})
	const other = attempt({
		challengeSlug: 'scope-rounding-bug',
		score: 10,
		createdAt: new Date(NOW.getTime() - HOUR)
	})
	const plan = planFor({ assessed: EXAMPLE, attempts: [first, retry, other] })
	assert.equal(plan.skills.find((each) => each.skill === 'scopeControl')?.trend, 'improving')
	const versionBump = { ...retry, challengeVersion: retry.challengeVersion + 1 }
	const mixed = planFor({ assessed: EXAMPLE, attempts: [first, versionBump] })
	assert.equal(mixed.skills.find((each) => each.skill === 'scopeControl')?.trend, null)
})

test('the summary counts attempts, completions and a day streak', () => {
	const summary = summarizePractice({
		now: NOW,
		attempts: [
			attempt({
				challengeSlug: 'clarity-login-api',
				score: 50,
				createdAt: new Date(NOW.getTime() - 2 * DAY)
			}),
			attempt({
				challengeSlug: 'clarity-login-api',
				score: 70,
				createdAt: new Date(NOW.getTime() - DAY)
			}),
			attempt({
				challengeSlug: 'scope-remember-me',
				score: 30,
				createdAt: new Date(NOW.getTime() - HOUR)
			})
		]
	})
	assert.deepEqual(summary, {
		attemptCount: 3,
		attempted: 2,
		completed: 1,
		averageScore: 50,
		bestScore: 70,
		streakDays: 3
	})
})
