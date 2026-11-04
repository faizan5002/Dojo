import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { assessSessions } from '@/features/assessment/assess'
import {
	EVIDENCE_THRESHOLDS,
	MIN_SKILLS_FOR_OVERALL,
	SKILL_IDS
} from '@/features/assessment/rubric'
import { sessionOf } from '@/features/assessment/session-fixtures'
import type { SkillAssessment } from '@/features/assessment/types'
import type { StoredAssessment, UploadView } from '@/features/workspace/repository'
import {
	DEV_ASSESSMENTS,
	DEV_UPLOADS,
	devAssessment,
	devUploadView
} from '@/features/dev-frontend/fixtures'
import {
	buildDashboard,
	displayName,
	focusOf,
	RECENT_SESSIONS,
	type DashboardModel
} from './dashboard-model'

// Everything here runs on the deterministic fixtures, which are real engine output
// over synthetic sessions, or on copies of them with one thing changed, so each
// test names the one rule it is about.

const fixture = (index: number): StoredAssessment => {
	const found = devAssessment(DEV_ASSESSMENTS[index]?.id)
	assert.ok(found)
	return found
}
const views = DEV_UPLOADS.map((upload) => devUploadView(upload.id)).filter(
	(view): view is UploadView => view != null
)
const viewOf = (assessment: StoredAssessment) => devUploadView(assessment.uploadId)

const withSkills = (
	assessment: StoredAssessment,
	change: (skill: SkillAssessment) => SkillAssessment
): StoredAssessment => ({
	...assessment,
	assessment: { ...assessment.assessment, skills: assessment.assessment.skills.map(change) }
})

const build = (overrides: Partial<Parameters<typeof buildDashboard>[0]> = {}): DashboardModel => {
	const valid = fixture(0)
	return buildDashboard({
		uploads: DEV_UPLOADS,
		assessments: DEV_ASSESSMENTS,
		newest: valid,
		valid,
		previous: fixture(1),
		validUploadView: viewOf(valid),
		recentUploadViews: views,
		...overrides
	})
}

/** A real engine run on one short prompt: too little evidence for an overall score. */
function tinyAssessment(): StoredAssessment {
	const assessment = assessSessions([sessionOf({ sessionId: 'tiny', prompts: ['Fix the bug.'] })])
	return {
		id: '00000000-0000-4000-8000-0000000b0001',
		uploadId: DEV_UPLOADS[0]?.id ?? '',
		createdAt: new Date('2026-11-03T08:00:00Z'),
		overallScore: assessment.overall.score,
		rubricVersion: assessment.rubricVersion,
		assessment,
		overview: null
	}
}

describe('focus next: where the coaching comes from', () => {
	test('is the assessment’s own first recommendation, with its own skill and score', () => {
		const model = build()
		const valid = fixture(0)
		const recommendation = valid.assessment.recommendations[0]
		assert.ok(recommendation)
		assert.ok(model.focus && model.focus.kind === 'ready')
		const skill = valid.assessment.skills.find((item) => item.skill === recommendation.skill)
		assert.equal(model.focus.skill, recommendation.skill)
		assert.equal(model.focus.criterion, recommendation.criterion)
		assert.equal(model.focus.score, skill?.score)
		assert.equal(model.focus.confidence, skill?.confidence)
		assert.equal(model.focus.observations, skill?.observations)
		assert.equal(model.focus.seen, recommendation.count)
		assert.equal(model.focus.of, recommendation.total)
	})

	test('quotes the stored excerpt of that recommendation’s evidence, exactly', () => {
		for (const [index] of DEV_ASSESSMENTS.entries()) {
			const assessment = fixture(index)
			const focus = focusOf(assessment, viewOf(assessment))
			if (focus.kind !== 'ready') continue
			const recommendation = assessment.assessment.recommendations[0]
			const evidence = assessment.assessment.skills
				.flatMap((skill) => skill.evidence)
				.find((item) => item.id === recommendation?.evidenceId)
			assert.ok(evidence, 'the evidence is in this assessment')
			assert.equal(focus.quote.excerpt, evidence.excerpt)
			assert.equal(focus.quote.sessionId, evidence.sessionId)
			assert.equal(focus.quote.promptNumber, evidence.promptNumber)
			assert.equal(focus.quote.clippedBefore, evidence.clippedBefore)
			assert.equal(focus.quote.clippedAfter, evidence.clippedAfter)
		}
	})

	test('names the project and date of the session the quote came from', () => {
		const assessment = fixture(0)
		const focus = focusOf(assessment, viewOf(assessment))
		assert.ok(focus.kind === 'ready')
		const session = viewOf(assessment)?.sessions.find(
			(item) => item.sessionId === focus.quote.sessionId
		)
		assert.ok(session)
		assert.equal(focus.quote.project, session.project)
		assert.equal(focus.quote.startedAt, session.startedAt)
	})

	test('leaves the project and date empty when the upload is not available, and still quotes', () => {
		const focus = focusOf(fixture(0), null)
		assert.ok(focus.kind === 'ready')
		assert.equal(focus.quote.project, null)
		assert.equal(focus.quote.startedAt, null)
		assert.ok(focus.quote.excerpt.length > 0)
	})

	test('never quotes evidence from a different assessment', () => {
		// Evidence ids are only unique within one assessment, so the lookup has to stay
		// inside it: an id that exists only in another assessment finds nothing here.
		const mine = fixture(0)
		const other = fixture(1)
		const myIds = new Set(
			mine.assessment.skills.flatMap((skill) => skill.evidence.map((item) => item.id))
		)
		const foreign = other.assessment.skills
			.flatMap((skill) => skill.evidence)
			.find((item) => !myIds.has(item.id))
		const foreignId = foreign?.id ?? 'another-assessment:evidence:999'
		assert.ok(!myIds.has(foreignId))
		const [first, ...rest] = mine.assessment.recommendations
		assert.ok(first)
		const crossed: StoredAssessment = {
			...mine,
			assessment: {
				...mine.assessment,
				recommendations: [{ ...first, evidenceId: foreignId }, ...rest]
			}
		}
		const focus = focusOf(crossed, viewOf(mine))
		assert.equal(focus.kind, 'missingQuote')
		assert.ok(!('quote' in focus))
	})

	test('does not use evidence from another skill or criterion either', () => {
		const mine = fixture(0)
		const [first, ...rest] = mine.assessment.recommendations
		assert.ok(first)
		const wrongCriterion: StoredAssessment = {
			...mine,
			assessment: {
				...mine.assessment,
				recommendations: [{ ...first, criterion: 'statesGoal' as typeof first.criterion }, ...rest]
			}
		}
		if (first.criterion !== 'statesGoal') {
			assert.equal(focusOf(wrongCriterion, viewOf(mine)).kind, 'missingQuote')
		}
	})
})

describe('focus next: fallbacks when something is missing', () => {
	test('a recommendation whose quote is gone shows no quote and no coaching text', () => {
		const stripped = withSkills(fixture(0), (skill) => ({ ...skill, evidence: [] }))
		const focus = focusOf(stripped, viewOf(stripped))
		assert.equal(focus.kind, 'missingQuote')
		assert.ok(focus.kind === 'missingQuote' && typeof focus.score === 'number')
		assert.ok(!('quote' in focus) && !('criterion' in focus))
	})

	test('no recommendation means no coaching focus, not an invented one', () => {
		const none: StoredAssessment = {
			...fixture(0),
			assessment: { ...fixture(0).assessment, recommendations: [] }
		}
		assert.deepEqual(focusOf(none, viewOf(none)), { kind: 'none' })
		assert.deepEqual(build({ valid: none, newest: none }).focus, { kind: 'none' })
	})

	test('a recommendation for a skill that has no score is treated as no focus', () => {
		const first = fixture(0).assessment.recommendations[0]
		assert.ok(first)
		const unscored = withSkills(fixture(0), (skill) =>
			skill.skill === first.skill ? { ...skill, score: null, proficiency: null } : skill
		)
		assert.deepEqual(focusOf(unscored, viewOf(unscored)), { kind: 'none' })
	})
})

describe('evidence basis', () => {
	test('is the number of sessions and prompts the assessment actually used', () => {
		for (const [index] of DEV_ASSESSMENTS.entries()) {
			const assessment = fixture(index)
			const model = build({
				valid: assessment,
				newest: assessment,
				previous: null,
				validUploadView: viewOf(assessment)
			})
			assert.equal(model.valid?.sessions, assessment.assessment.sessionCount)
			assert.equal(model.valid?.prompts, assessment.assessment.promptCount)
		}
	})

	test('can differ from the workspace totals, which cover every upload', () => {
		const model = build()
		assert.ok(model.valid)
		assert.ok(model.valid.sessions < model.totals.sessions)
	})
})

describe('comparisons are only as strong as the evidence', () => {
	const strong = (assessment: StoredAssessment) =>
		withSkills(assessment, (skill) => ({
			...skill,
			confidence: skill.score == null ? skill.confidence : 'strong'
		}))

	test('limited evidence makes a change provisional, never a finding', () => {
		const model = build()
		assert.equal(model.valid?.comparison.status, 'provisional')
		for (const row of model.skills) {
			if (row.comparison.status !== 'unavailable')
				assert.equal(row.comparison.status, 'provisional')
		}
	})

	test('strong evidence on both sides makes it comparable, with the real difference', () => {
		const now = strong(fixture(0))
		const before = strong(fixture(1))
		const model = build({ valid: now, newest: now, previous: before })
		const overall = model.valid?.comparison
		assert.ok(overall && overall.status === 'comparable')
		assert.equal(overall.delta, (now.overallScore ?? 0) - (before.overallScore ?? 0))
		for (const row of model.skills) {
			const after = now.assessment.skills.find((skill) => skill.skill === row.skill)
			const prior = before.assessment.skills.find((skill) => skill.skill === row.skill)
			assert.ok(row.comparison.status === 'comparable')
			assert.equal(row.comparison.delta, (after?.score ?? 0) - (prior?.score ?? 0))
		}
	})

	test('one limited side keeps it provisional', () => {
		const model = build({ valid: strong(fixture(0)), newest: strong(fixture(0)) })
		assert.equal(model.valid?.comparison.status, 'provisional')
	})

	test('differing skill coverage keeps the overall change provisional even on strong evidence', () => {
		const now = strong(fixture(0))
		const before: StoredAssessment = {
			...strong(fixture(1)),
			assessment: {
				...strong(fixture(1)).assessment,
				overall: {
					...strong(fixture(1)).assessment.overall,
					skillsAssessed: now.assessment.overall.skillsAssessed - 1
				}
			}
		}
		assert.equal(
			build({ valid: now, newest: now, previous: before }).valid?.comparison.status,
			'provisional'
		)
	})

	test('no earlier scored assessment is "noPrevious", and shows no change at all', () => {
		const model = build({ previous: null })
		assert.deepEqual(model.valid?.comparison, { status: 'unavailable', reason: 'noPrevious' })
		for (const row of model.skills) {
			assert.deepEqual(row.comparison, { status: 'unavailable', reason: 'noPrevious' })
		}
	})

	test('an earlier assessment with no overall score is not compared against', () => {
		const unscored: StoredAssessment = { ...fixture(1), overallScore: null }
		assert.deepEqual(build({ previous: unscored }).valid?.comparison, {
			status: 'unavailable',
			reason: 'previousUnscored'
		})
	})

	test('a skill that was unscored before has no change, and the others still do', () => {
		const first = fixture(1).assessment.skills[0]
		assert.ok(first)
		const before = withSkills(fixture(1), (skill) =>
			skill.skill === first.skill ? { ...skill, score: null, proficiency: null } : skill
		)
		const model = build({ previous: before })
		const row = model.skills.find((item) => item.skill === first.skill)
		assert.deepEqual(row?.comparison, { status: 'unavailable', reason: 'previousUnscored' })
		assert.ok(model.skills.some((item) => item.comparison.status !== 'unavailable'))
	})
})

describe('the four stages of an account', () => {
	test('empty: nothing uploaded or scored', () => {
		const model = buildDashboard({
			uploads: [],
			assessments: [],
			newest: null,
			valid: null,
			previous: null,
			validUploadView: null,
			recentUploadViews: []
		})
		assert.equal(model.stage, 'empty')
		assert.equal(model.valid, null)
		assert.equal(model.focus, null)
		assert.deepEqual(model.skills, [])
		assert.equal(model.latestUploadId, null)
	})

	test('toScore: uploads with no assessment offer to score the newest upload', () => {
		const model = buildDashboard({
			uploads: DEV_UPLOADS,
			assessments: [],
			newest: null,
			valid: null,
			previous: null,
			validUploadView: null,
			recentUploadViews: views
		})
		assert.equal(model.stage, 'toScore')
		assert.equal(model.latestUploadId, DEV_UPLOADS[0]?.id)
		assert.equal(model.valid, null)
		assert.ok(model.recentSessions.length > 0)
	})

	test('insufficient: states the rubric’s own rule and what each skill has against what it needs', () => {
		const tiny = tinyAssessment()
		const model = buildDashboard({
			uploads: DEV_UPLOADS,
			assessments: [
				{
					id: tiny.id,
					uploadId: tiny.uploadId,
					createdAt: tiny.createdAt,
					overallScore: null,
					rubricVersion: tiny.rubricVersion
				}
			],
			newest: tiny,
			valid: null,
			previous: null,
			validUploadView: null,
			recentUploadViews: views
		})
		assert.equal(model.stage, 'insufficient')
		assert.equal(model.valid, null)
		assert.equal(model.focus, null)
		assert.ok(model.insufficient)
		assert.equal(model.insufficient.minSkills, MIN_SKILLS_FOR_OVERALL)
		assert.equal(model.insufficient.skillsAssessed, tiny.assessment.overall.skillsAssessed)
		assert.deepEqual(
			model.insufficient.needs.map((need) => need.skill),
			[...SKILL_IDS]
		)
		for (const need of model.insufficient.needs) {
			assert.equal(need.needed, EVIDENCE_THRESHOLDS[need.skill].scoreFrom)
			const skill = tiny.assessment.skills.find((item) => item.skill === need.skill)
			assert.equal(need.observations, skill?.observations)
		}
	})

	test('ready: coaching, performance and skills from the latest scored assessment', () => {
		const model = build()
		assert.equal(model.stage, 'ready')
		assert.equal(model.valid?.id, DEV_ASSESSMENTS[0]?.id)
		assert.equal(model.insufficient, null)
		assert.equal(model.newerUnscored, null)
	})

	test('a newer assessment that could not be scored does not hide the last scored one', () => {
		const tiny = tinyAssessment()
		const valid = fixture(0)
		const newer = {
			id: tiny.id,
			uploadId: tiny.uploadId,
			createdAt: new Date('2026-11-05T08:00:00Z'),
			overallScore: null,
			rubricVersion: tiny.rubricVersion
		}
		const model = build({
			assessments: [newer, ...DEV_ASSESSMENTS],
			newest: tiny,
			valid,
			previous: fixture(1)
		})
		assert.equal(model.stage, 'ready')
		assert.equal(model.valid?.id, valid.id)
		assert.deepEqual(model.newerUnscored, { id: newer.id, createdAt: newer.createdAt })
		assert.ok(model.earlier.some((item) => item.id === newer.id && item.score == null))
		assert.ok(!model.earlier.some((item) => item.id === valid.id))
	})
})

describe('skills, history and activity', () => {
	test('the five skills are in rubric order with the stored scores', () => {
		const model = build()
		const stored = fixture(0)
		assert.deepEqual(
			model.skills.map((row) => row.skill),
			[...SKILL_IDS]
		)
		for (const row of model.skills) {
			const skill = stored.assessment.skills.find((item) => item.skill === row.skill)
			assert.equal(row.score, skill?.score)
			assert.equal(row.proficiency, skill?.proficiency)
			assert.equal(row.confidence, skill?.confidence)
		}
	})

	test('only the focus skill is marked focus, and the strongest is never the same skill', () => {
		const model = build()
		const focused = model.skills.filter((row) => row.isFocus)
		assert.equal(focused.length, 1)
		assert.equal(
			focused[0]?.skill,
			model.focus && model.focus.kind !== 'none' ? model.focus.skill : null
		)
		for (const row of model.skills) assert.ok(!(row.isFocus && row.isStrongest))
		assert.ok(model.skills.filter((row) => row.isStrongest).length <= 1)
	})

	test('no strongest skill is named when the strongest and weakest are the same', () => {
		const valid = fixture(0)
		const single: StoredAssessment = {
			...valid,
			assessment: {
				...valid.assessment,
				overall: { ...valid.assessment.overall, strongest: 'planning', weakest: 'planning' }
			}
		}
		assert.ok(build({ valid: single, newest: single }).skills.every((row) => !row.isStrongest))
	})

	test('the trend is the scored assessments, oldest first', () => {
		const model = build()
		assert.deepEqual(
			model.trend.map((point) => point.score),
			DEV_ASSESSMENTS.toReversed().map((assessment) => assessment.overallScore)
		)
	})

	test('earlier assessments exclude the one on the page, newest first', () => {
		const earlier = build().earlier
		assert.deepEqual(
			earlier.map((item) => item.id),
			DEV_ASSESSMENTS.slice(1).map((item) => item.id)
		)
	})

	test('the totals are sums over the uploads and the assessments', () => {
		const { totals } = build()
		assert.equal(totals.uploads, DEV_UPLOADS.length)
		assert.equal(
			totals.sessions,
			DEV_UPLOADS.reduce((sum, upload) => sum + upload.sessionCount, 0)
		)
		assert.equal(
			totals.prompts,
			DEV_UPLOADS.reduce((sum, upload) => sum + upload.promptCount, 0)
		)
		assert.equal(totals.assessments, DEV_ASSESSMENTS.length)
	})

	test('recent sessions are newest first, capped, and point at their upload', () => {
		const recent = build().recentSessions
		assert.ok(recent.length > 0 && recent.length <= RECENT_SESSIONS)
		const times = recent.map((session) => Date.parse(session.startedAt ?? ''))
		assert.deepEqual(
			times,
			[...times].sort((a, b) => b - a)
		)
		for (const session of recent) {
			assert.ok(DEV_UPLOADS.some((upload) => upload.id === session.uploadId))
		}
	})

	test('is deterministic', () => {
		assert.equal(JSON.stringify(build()), JSON.stringify(build()))
	})
})

describe('displayName', () => {
	test('is the part of the email before the @, or the whole value', () => {
		assert.equal(displayName('frontend-dev@dojo.invalid'), 'frontend-dev')
		assert.equal(displayName('@odd'), '@odd')
		assert.equal(displayName('plain'), 'plain')
	})
})
