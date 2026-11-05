import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CRITERIA, SKILL_IDS } from '@/features/assessment/rubric'
import { loadSample } from '@/features/sample/sample-session'
import { scoreRewrite } from '../score-rewrite'
import { SCENARIOS } from './catalog'
import {
	SESSION_LENGTH,
	adjustDifficulty,
	buildPlan,
	chooseScenario,
	orderedOptions,
	startDifficulty
} from './plan'

describe('the scenario catalogue', () => {
	it('has three difficulties for each of the five assessed skills, and no others', () => {
		for (const skill of SKILL_IDS) {
			const own = SCENARIOS.filter((scenario) => scenario.skill === skill)
			assert.deepEqual(
				own.map((scenario) => scenario.difficulty).sort(),
				[1, 2, 3],
				`${skill} should have one scenario per difficulty`
			)
		}
		assert.equal(SCENARIOS.length, SKILL_IDS.length * 3)
		assert.equal(new Set(SCENARIOS.map((scenario) => scenario.id)).size, SCENARIOS.length)
	})

	it('targets a real opportunity criterion of its own skill', () => {
		for (const scenario of SCENARIOS) {
			const opportunities: readonly string[] = CRITERIA[scenario.skill].opportunity
			assert.ok(
				opportunities.includes(scenario.criterion),
				`${scenario.id} targets ${scenario.criterion}, which is not an opportunity of ${scenario.skill}`
			)
		}
	})

	it('has exactly one effective choice, and explains every choice', () => {
		for (const scenario of SCENARIOS) {
			assert.equal(
				scenario.options.filter((option) => option.quality === 'effective').length,
				1,
				scenario.id
			)
			assert.ok(scenario.options.length >= 3)
			for (const option of scenario.options) {
				assert.ok(option.why.length > 20, `${scenario.id}/${option.id} has no explanation`)
			}
			assert.ok(scenario.matters && scenario.better && scenario.takeaway)
		}
	})

	it('agrees with the rubric: the effective choice is never flagged, an ineffective one is never credited', () => {
		for (const scenario of SCENARIOS) {
			for (const option of scenario.options) {
				const result = scoreRewrite({
					text: option.label,
					skill: scenario.skill,
					criterion: scenario.criterion
				})
				if (option.quality === 'effective') {
					assert.notEqual(
						result.verdict,
						'weaknessRemains',
						`${scenario.id}: the effective choice still shows the weakness`
					)
				}
				if (option.quality === 'ineffective') {
					assert.notEqual(
						result.verdict,
						'improved',
						`${scenario.id}: an ineffective choice is credited by the rules`
					)
				}
			}
		}
	})
})

describe('building a practice plan from an assessment', () => {
	it('targets the weakest skills of the sample first, in five scenarios', async () => {
		const { stored } = await loadSample()
		const plan = buildPlan(stored.assessment)
		assert.ok(plan)
		assert.equal(plan.slots.length, SESSION_LENGTH)
		const ranked = stored.assessment.skills
			.filter((skill) => skill.score != null)
			.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
		assert.equal(plan.skills[0]?.skill, ranked[0]?.skill)
		assert.equal(plan.slots[0], ranked[0]?.skill)
		assert.ok(plan.slots.every((slot) => plan.skills.some((each) => each.skill === slot)))
	})

	it('marks a skill as weak only when the assessment found it below the line', async () => {
		const { stored } = await loadSample()
		const plan = buildPlan(stored.assessment)
		assert.ok(plan)
		for (const each of plan.skills) {
			assert.equal(each.isWeak, each.score < 80)
		}
	})

	it('has nothing to build from an assessment that scored nothing', async () => {
		const { stored } = await loadSample()
		const empty = {
			...stored.assessment,
			skills: stored.assessment.skills.map((skill) => ({
				...skill,
				score: null,
				confidence: 'insufficient' as const
			}))
		}
		assert.equal(buildPlan(empty), null)
	})

	it('starts harder for a stronger skill', () => {
		assert.equal(startDifficulty(30), 1)
		assert.equal(startDifficulty(55), 2)
		assert.equal(startDifficulty(80), 3)
	})

	it('adapts difficulty to the last choice, within 1 to 3', () => {
		assert.equal(adjustDifficulty(1, 'effective'), 2)
		assert.equal(adjustDifficulty(3, 'effective'), 3)
		assert.equal(adjustDifficulty(2, 'partial'), 2)
		assert.equal(adjustDifficulty(2, 'ineffective'), 1)
		assert.equal(adjustDifficulty(1, 'ineffective'), 1)
	})

	it('chooses the nearest unused scenario, and never repeats one', () => {
		const first = chooseScenario({
			skill: 'iteration',
			difficulty: 2,
			preferred: null,
			used: []
		})
		assert.equal(first?.difficulty, 2)
		const second = chooseScenario({
			skill: 'iteration',
			difficulty: 2,
			preferred: null,
			used: first ? [first.id] : []
		})
		assert.notEqual(second?.id, first?.id)
		const none = chooseScenario({
			skill: 'iteration',
			difficulty: 2,
			preferred: null,
			used: SCENARIOS.filter((scenario) => scenario.skill === 'iteration').map((s) => s.id)
		})
		assert.equal(none, null)
	})

	it('is deterministic, and shows the same options in the same order every time', () => {
		for (const scenario of SCENARIOS) {
			assert.deepEqual(
				orderedOptions(scenario).map((option) => option.id),
				orderedOptions(scenario).map((option) => option.id)
			)
			assert.equal(orderedOptions(scenario).length, scenario.options.length)
		}
	})
})
