// The rubric in one place: its version, the five skills and what each looks for,
// the score bands and the evidence thresholds. Changing any of these changes
// what a score means, so bump RUBRIC_VERSION with it; every assessment carries
// the version it was scored under.

export const RUBRIC_VERSION = 'rules-1.0'

export const SKILL_IDS = [
	'promptClarity',
	'planning',
	'verification',
	'iteration',
	'scopeControl'
] as const
export type SkillId = (typeof SKILL_IDS)[number]

/**
 * What each skill looks for. A strength criterion is credited when the
 * behaviour is seen; an opportunity criterion is recorded when its absence (or
 * a counter-pattern) is seen where the behaviour was expected.
 */
export const CRITERIA = {
	promptClarity: {
		strength: ['statesGoal', 'givesContext', 'statesConstraints', 'definesDone'],
		opportunity: ['vagueReference']
	},
	planning: {
		strength: ['asksForPlan', 'structuredRequirements', 'considersEdgeCases'],
		opportunity: ['straightToBuild']
	},
	verification: {
		strength: ['asksForVerification', 'checksResult', 'challengesClaims'],
		opportunity: ['acceptedWithoutCheck']
	},
	iteration: {
		strength: ['specificFeedback', 'statesExpectedVsActual', 'refinesRequirement'],
		opportunity: ['vagueFeedback', 'repeatedPrompt']
	},
	scopeControl: {
		strength: ['namesTargets', 'setsBoundaries'],
		opportunity: ['broadRequest', 'bundledRequest']
	}
} as const satisfies Record<
	SkillId,
	{ strength: readonly string[]; opportunity: readonly string[] }
>

type CriteriaOf<S extends SkillId> =
	(typeof CRITERIA)[S]['strength'][number] | (typeof CRITERIA)[S]['opportunity'][number]
export type CriterionId = { [S in SkillId]: CriteriaOf<S> }[SkillId]

export type Proficiency = 'needsImprovement' | 'developing' | 'proficient' | 'strong'

/** Highest band first; a score belongs to the first band whose minimum it meets. */
export const PROFICIENCY_BANDS: readonly { readonly min: number; readonly level: Proficiency }[] = [
	{ min: 80, level: 'strong' },
	{ min: 60, level: 'proficient' },
	{ min: 40, level: 'developing' },
	{ min: 0, level: 'needsImprovement' }
]

export function proficiencyOf(score: number): Proficiency {
	return PROFICIENCY_BANDS.find((band) => score >= band.min)?.level ?? 'needsImprovement'
}

export type Confidence = 'strong' | 'limited' | 'insufficient'

/**
 * How many observations a skill needs. Below `scoreFrom` the skill is not
 * scored at all; missing evidence is never read as poor performance.
 */
export const EVIDENCE_THRESHOLDS: Record<SkillId, { scoreFrom: number; strongFrom: number }> = {
	promptClarity: { scoreFrom: 3, strongFrom: 10 },
	planning: { scoreFrom: 2, strongFrom: 5 },
	verification: { scoreFrom: 2, strongFrom: 6 },
	iteration: { scoreFrom: 2, strongFrom: 6 },
	scopeControl: { scoreFrom: 3, strongFrom: 10 }
}

export function confidenceOf(skill: SkillId, observations: number): Confidence {
	const thresholds = EVIDENCE_THRESHOLDS[skill]
	if (observations < thresholds.scoreFrom) return 'insufficient'
	return observations >= thresholds.strongFrom ? 'strong' : 'limited'
}

/**
 * The overall score is the equal-weighted mean of the skills that could be
 * scored, and only when at least this many could: an average of one or two
 * skills would speak for five.
 */
export const MIN_SKILLS_FOR_OVERALL = 3

/** Evidence shown per skill, per polarity. */
export const MAX_EVIDENCE_PER_POLARITY = 3

/** Skills at or above this score are not turned into improvement recommendations. */
export const RECOMMEND_BELOW = 80
export const MAX_RECOMMENDATIONS = 3
