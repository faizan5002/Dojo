import type { Confidence, CriterionId, Proficiency, SkillId } from './rubric'

export type Polarity = 'strength' | 'opportunity'

/** A template line a suggested rewrite appends; the copy lives in messages. */
export type RewriteLine =
	'context' | 'constraints' | 'doneWhen' | 'planFirst' | 'verify' | 'scope' | 'expectedActual'

/**
 * A suggested structure, not a generated rewrite: the user's own first
 * sentence (`base`, quoted from the prompt) followed by template lines.
 */
export interface Suggestion {
	readonly base: string
	readonly additions: readonly RewriteLine[]
}

/**
 * One quoted piece of the user's own session. `excerpt` is exactly
 * `prompt.slice(start, end)` of the (cleaned, redacted) prompt it came from.
 */
export interface Evidence {
	readonly id: string
	readonly skill: SkillId
	readonly criterion: CriterionId
	readonly polarity: Polarity
	readonly sessionId: string
	readonly promptNumber: number
	readonly excerpt: string
	readonly start: number
	readonly end: number
	/** The quote starts or ends partway through a sentence; shown with an ellipsis. */
	readonly clippedBefore: boolean
	readonly clippedAfter: boolean
	readonly suggestion: Suggestion | null
}

export interface CriterionTally {
	readonly criterion: CriterionId
	readonly polarity: Polarity
	readonly count: number
}

export interface SkillAssessment {
	readonly skill: SkillId
	/** 0–100, or null when the evidence is insufficient to score. */
	readonly score: number | null
	readonly proficiency: Proficiency | null
	/** How much evidence there was; independent of how well the user did. */
	readonly confidence: Confidence
	readonly observations: number
	readonly tallies: readonly CriterionTally[]
	readonly evidence: readonly Evidence[]
}

export type PatternId =
	| 'plansFirst'
	| 'buildsBeforePlanning'
	| 'checksTheWork'
	| 'movesOnWithoutChecking'
	| 'specificFeedback'
	| 'vagueFeedback'
	| 'namesTargets'
	| 'broadRequests'

export interface ProfilePattern {
	readonly id: PatternId
	readonly kind: Polarity
	readonly skill: SkillId
	readonly count: number
	readonly total: number
	readonly evidenceIds: readonly string[]
}

export interface Recommendation {
	readonly skill: SkillId
	readonly criterion: CriterionId
	readonly count: number
	readonly total: number
	readonly evidenceId: string
}

export interface OverallAssessment {
	readonly score: number | null
	readonly proficiency: Proficiency | null
	readonly skillsAssessed: number
	readonly strongest: SkillId | null
	readonly weakest: SkillId | null
}

export interface Assessment {
	readonly rubricVersion: string
	readonly sessionCount: number
	readonly promptCount: number
	readonly redactions: number
	readonly overall: OverallAssessment
	readonly skills: readonly SkillAssessment[]
	readonly profile: readonly ProfilePattern[]
	readonly recommendations: readonly Recommendation[]
}
