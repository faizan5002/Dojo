import type { CriterionId, SkillId } from './rubric'
import type { PatternId, Polarity, ProfilePattern, SkillAssessment } from './types'

// A habit is named only when it recurs: seen at least twice, and in a fair
// share of that skill's observations.
const MIN_PATTERN_COUNT = 2
const MIN_PATTERN_SHARE = 0.4

const PATTERNS: readonly {
	readonly id: PatternId
	readonly kind: Polarity
	readonly skill: SkillId
	readonly criteria: readonly CriterionId[]
}[] = [
	{ id: 'plansFirst', kind: 'strength', skill: 'planning', criteria: ['asksForPlan'] },
	{
		id: 'buildsBeforePlanning',
		kind: 'opportunity',
		skill: 'planning',
		criteria: ['straightToBuild']
	},
	{
		id: 'checksTheWork',
		kind: 'strength',
		skill: 'verification',
		criteria: ['asksForVerification', 'checksResult', 'challengesClaims']
	},
	{
		id: 'movesOnWithoutChecking',
		kind: 'opportunity',
		skill: 'verification',
		criteria: ['acceptedWithoutCheck']
	},
	{ id: 'specificFeedback', kind: 'strength', skill: 'iteration', criteria: ['specificFeedback'] },
	{
		id: 'vagueFeedback',
		kind: 'opportunity',
		skill: 'iteration',
		criteria: ['vagueFeedback', 'repeatedPrompt']
	},
	{ id: 'namesTargets', kind: 'strength', skill: 'scopeControl', criteria: ['namesTargets'] },
	{
		id: 'broadRequests',
		kind: 'opportunity',
		skill: 'scopeControl',
		criteria: ['broadRequest', 'bundledRequest']
	}
]

export function workflowProfile(skills: readonly SkillAssessment[]): ProfilePattern[] {
	return PATTERNS.flatMap((pattern) => {
		const skill = skills.find((each) => each.skill === pattern.skill)
		if (skill == null || skill.observations === 0) return []
		const count = Math.min(
			skill.observations,
			skill.tallies
				.filter(
					(tally) => tally.polarity === pattern.kind && pattern.criteria.includes(tally.criterion)
				)
				.reduce((total, tally) => total + tally.count, 0)
		)
		if (count < MIN_PATTERN_COUNT || count / skill.observations < MIN_PATTERN_SHARE) return []
		return [
			{
				id: pattern.id,
				kind: pattern.kind,
				skill: pattern.skill,
				count,
				total: skill.observations,
				evidenceIds: skill.evidence
					.filter(
						(evidence) =>
							evidence.polarity === pattern.kind && pattern.criteria.includes(evidence.criterion)
					)
					.map((evidence) => evidence.id)
			}
		]
	})
}
