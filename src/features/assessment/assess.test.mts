import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, assessSessions } from './assess'
import { CRITERIA, MIN_SKILLS_FOR_OVERALL, RUBRIC_VERSION, SKILL_IDS } from './rubric'
import {
	STRONG_PROMPTS,
	STRONG_SESSION,
	WEAK_PROMPTS,
	WEAK_SESSION,
	sessionOf
} from './session-fixtures'
import type { SkillAssessment } from './types'

const skill = (id: SkillAssessment['skill'], score: number | null): SkillAssessment => ({
	skill: id,
	score,
	proficiency: null,
	confidence: score == null ? 'insufficient' : 'limited',
	observations: score == null ? 0 : 3,
	tallies: [],
	evidence: []
})

test('every skill has explicit criteria, and the assessment carries the rubric version', () => {
	for (const id of SKILL_IDS) {
		assert.ok(CRITERIA[id].strength.length > 0, `${id} has no strength criteria`)
		assert.ok(CRITERIA[id].opportunity.length > 0, `${id} has no opportunity criteria`)
	}
	const assessment = assessSessions([STRONG_SESSION])
	assert.equal(assessment.rubricVersion, RUBRIC_VERSION)
	assert.deepEqual(
		assessment.skills.map((each) => each.skill),
		[...SKILL_IDS]
	)
})

test('scores stay within 0–100 and carry a proficiency only when scored', () => {
	for (const session of [STRONG_SESSION, WEAK_SESSION]) {
		const assessment = assessSessions([session])
		for (const each of assessment.skills) {
			if (each.score == null) {
				assert.equal(each.proficiency, null)
				continue
			}
			assert.ok(each.score >= 0 && each.score <= 100, `${each.skill} scored ${each.score}`)
			assert.notEqual(each.proficiency, null)
		}
	}
})

test('a careful workflow outscores a careless one', () => {
	const strong = assessSessions([STRONG_SESSION]).overall
	const weak = assessSessions([WEAK_SESSION]).overall
	assert.ok(strong.score != null && weak.score != null, 'both have an overall score')
	assert.ok(strong.score > weak.score, `strong ${strong.score} vs weak ${weak.score}`)
	assert.equal(strong.proficiency, 'strong')
})

test('every quoted excerpt is the exact text the user wrote', () => {
	const prompts: readonly string[] = [...STRONG_PROMPTS, ...WEAK_PROMPTS]
	const assessment = assessSessions([STRONG_SESSION, WEAK_SESSION])
	const evidence = assessment.skills.flatMap((each) => each.evidence)
	assert.ok(evidence.length > 0)
	for (const item of evidence) {
		assert.ok(
			prompts.some((prompt) => prompt.slice(item.start, item.end) === item.excerpt),
			`not traceable: "${item.excerpt}"`
		)
		if (item.suggestion != null) {
			assert.ok(prompts.some((prompt) => prompt.startsWith(item.suggestion?.base ?? '\u0000')))
		}
	}
})

test('too little evidence leaves a skill unscored instead of scoring it low', () => {
	const assessment = assessSessions([
		sessionOf({ sessionId: 'tiny', prompts: ['Rename `total` to `sum` in src/lib/math.ts.'] })
	])
	for (const each of assessment.skills) {
		assert.equal(each.score, null, `${each.skill} was scored from one prompt`)
		assert.equal(each.confidence, 'insufficient')
	}
	assert.equal(assessment.overall.score, null)
	assert.equal(assessment.recommendations.length, 0)
})

test('confidence describes the evidence, not the performance', () => {
	const planning = assessSessions([STRONG_SESSION]).skills.find((each) => each.skill === 'planning')
	assert.equal(planning?.score, 100)
	assert.equal(planning?.confidence, 'limited')
})

test('empty and malformed input is handled without throwing', () => {
	const empty = assessSessions([])
	assert.equal(empty.promptCount, 0)
	assert.equal(empty.overall.score, null)
	const odd = assessSessions([
		{
			sessionId: 'odd',
			agent: 'unknown',
			project: null,
			generatedAt: null,
			turns: [
				{ prompt: null, response: { timestamp: '', text: 'orphan answer' } },
				{ prompt: { timestamp: 'not-a-date', text: '   ' }, response: null },
				{
					prompt: { timestamp: '', text: '<system-reminder>injected</system-reminder>' },
					response: null
				}
			]
		}
	])
	assert.equal(odd.promptCount, 0)
	assert.equal(odd.overall.score, null)
})

test('credentials are redacted before scoring, and never quoted', () => {
	const token = `ghp_${'a1B2c3D4e5'.repeat(4)}`
	const assessment = assessSessions([
		sessionOf({
			sessionId: 'secret',
			prompts: [
				`Fix the deploy script in scripts/deploy.sh, it uses ${token} as the token.`,
				`Fix the deploy script in scripts/deploy.sh, it uses ${token} as the token.`,
				`Fix the deploy script in scripts/deploy.sh, it uses ${token} as the token.`
			]
		})
	])
	assert.ok(assessment.redactions >= 3)
	const quoted = JSON.stringify(assessment)
	assert.ok(!quoted.includes(token))
})

test('the overall score is the equal-weighted mean of the scored skills', () => {
	const overall = aggregate([
		skill('promptClarity', 80),
		skill('planning', 60),
		skill('verification', 40),
		skill('iteration', null),
		skill('scopeControl', null)
	])
	assert.equal(overall.score, 60)
	assert.equal(overall.proficiency, 'proficient')
	assert.equal(overall.skillsAssessed, 3)
	assert.equal(overall.strongest, 'promptClarity')
	assert.equal(overall.weakest, 'verification')
})

test(`fewer than ${MIN_SKILLS_FOR_OVERALL} scored skills give no overall score`, () => {
	const overall = aggregate([
		skill('promptClarity', 90),
		skill('planning', 20),
		skill('verification', null),
		skill('iteration', null),
		skill('scopeControl', null)
	])
	assert.equal(overall.score, null)
	assert.equal(overall.skillsAssessed, 2)
	assert.equal(overall.strongest, 'promptClarity')
	assert.equal(overall.weakest, 'planning')
})

test('recommendations target weak, reliably scored skills and quote a real gap', () => {
	const assessment = assessSessions([WEAK_SESSION])
	assert.ok(assessment.recommendations.length > 0)
	for (const recommendation of assessment.recommendations) {
		const target = assessment.skills.find((each) => each.skill === recommendation.skill)
		assert.ok(target?.score != null && target.score < 80)
		assert.notEqual(target?.confidence, 'insufficient')
		const evidence = target?.evidence.find((each) => each.id === recommendation.evidenceId)
		assert.equal(evidence?.polarity, 'opportunity')
	}
})

test('the workflow profile names only recurring habits, with their evidence', () => {
	const profile = assessSessions([WEAK_SESSION]).profile
	const vague = profile.find((pattern) => pattern.id === 'vagueFeedback')
	assert.ok(vague, 'two vague follow-ups are a pattern')
	assert.equal(vague.kind, 'opportunity')
	assert.ok(vague.count >= 2 && vague.count <= vague.total)
	for (const pattern of profile) assert.ok(pattern.count >= 2)
})
