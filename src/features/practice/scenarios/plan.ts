import { RECOMMEND_BELOW, type CriterionId, type SkillId } from '@/features/assessment/rubric'
import type { Assessment } from '@/features/assessment/types'
import { SCENARIOS } from './catalog'
import type { Difficulty, Quality, Scenario } from './types'

/** Default length of a practice session: five scenarios, about 8 to 12 minutes. */
export const SESSION_LENGTH = 5

const MAX_SKILLS = 3
/** How many of the five scenarios each of the weakest skills gets, weakest first. */
const SLOT_WEIGHTS = [2, 2, 1] as const
const PER_SKILL_CAP = 3

export interface PlanSkill {
	readonly skill: SkillId
	readonly score: number
	/** True when the assessment found this skill below the recommendation line. */
	readonly isWeak: boolean
	readonly start: Difficulty
	/** The opportunity the assessment saw most often in this skill, if any. */
	readonly preferred: CriterionId | null
}

export interface PracticePlan {
	/** The skills practised, weakest first. */
	readonly skills: readonly PlanSkill[]
	/** One entry per scenario, in order: which skill it practises. */
	readonly slots: readonly SkillId[]
}

export function startDifficulty(score: number): Difficulty {
	if (score < 45) return 1
	if (score < 65) return 2
	return 3
}

/** The next scenario's difficulty for a skill, from how the last one went. */
export function adjustDifficulty(current: Difficulty, quality: Quality): Difficulty {
	if (quality === 'effective') return Math.min(3, current + 1) as Difficulty
	if (quality === 'ineffective') return Math.max(1, current - 1) as Difficulty
	return current
}

/**
 * A practice plan from an assessment's own results: the weakest reliably scored
 * skills first, then the lowest of the rest so a session always has five scenarios.
 * Null when nothing was scored, because there is nothing honest to target.
 */
export function buildPlan(assessment: Assessment): PracticePlan | null {
	const scored = assessment.skills
		.flatMap((skill) =>
			skill.score != null && skill.confidence !== 'insufficient'
				? [{ skill, score: skill.score }]
				: []
		)
		.sort((a, b) => a.score - b.score)
	if (scored.length === 0) return null
	const chosen = scored.slice(0, MAX_SKILLS)
	const skills: PlanSkill[] = chosen.map(({ skill, score }) => ({
		skill: skill.skill,
		score,
		isWeak: score < RECOMMEND_BELOW,
		start: startDifficulty(score),
		preferred:
			[...skill.tallies]
				.filter((tally) => tally.polarity === 'opportunity')
				.sort((a, b) => b.count - a.count)[0]?.criterion ?? null
	}))
	const counts = new Map<SkillId, number>(
		skills.map((each, index) => [each.skill, Math.min(PER_SKILL_CAP, SLOT_WEIGHTS[index] ?? 1)])
	)
	// Fewer than three skills: give the remaining slots to the weakest, up to the cap.
	let total = [...counts.values()].reduce((sum, count) => sum + count, 0)
	for (const each of skills) {
		while (total < SESSION_LENGTH && (counts.get(each.skill) ?? 0) < PER_SKILL_CAP) {
			counts.set(each.skill, (counts.get(each.skill) ?? 0) + 1)
			total++
		}
	}
	const slots: SkillId[] = []
	const left = new Map(counts)
	while (slots.length < SESSION_LENGTH && [...left.values()].some((count) => count > 0)) {
		for (const each of skills) {
			const remaining = left.get(each.skill) ?? 0
			if (remaining > 0 && slots.length < SESSION_LENGTH) {
				slots.push(each.skill)
				left.set(each.skill, remaining - 1)
			}
		}
	}
	return { skills, slots }
}

/**
 * The scenario for a skill at a target difficulty: the nearest difficulty not yet
 * used, preferring the criterion the assessment saw most often. Deterministic.
 */
export function chooseScenario({
	skill,
	difficulty,
	preferred,
	used
}: {
	skill: SkillId
	difficulty: Difficulty
	preferred: CriterionId | null
	used: readonly string[]
}): Scenario | null {
	const candidates = SCENARIOS.filter(
		(scenario) => scenario.skill === skill && !used.includes(scenario.id)
	)
	candidates.sort(
		(a, b) =>
			Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty) ||
			Number(b.criterion === preferred) - Number(a.criterion === preferred) ||
			a.difficulty - b.difficulty ||
			a.id.localeCompare(b.id)
	)
	return candidates[0] ?? null
}

/** The options in a fixed, scenario-specific order, so the effective one is not always first. */
export function orderedOptions(scenario: Scenario) {
	const seed = [...scenario.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
	const rotation = seed % scenario.options.length
	return [...scenario.options.slice(rotation), ...scenario.options.slice(0, rotation)]
}
