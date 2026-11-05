import type { CriterionId, SkillId } from '@/features/assessment/rubric'

// Authored practice scenarios. Each one targets one opportunity criterion of the
// existing rubric, shows a short realistic conversation with a coding agent, and
// asks what to send next. Feedback is written by people for each choice: it is
// not generated, not scored by a model, and not a skill assessment.

export type Difficulty = 1 | 2 | 3
export type Quality = 'effective' | 'partial' | 'ineffective'

export interface ScenarioTurn {
	readonly role: 'you' | 'agent'
	readonly text: string
}

export interface ScenarioOption {
	readonly id: string
	/** What you would send, in your own words: the card's text. */
	readonly label: string
	readonly quality: Quality
	/** Why this choice is effective or not, in this situation. */
	readonly why: string
}

export interface Scenario {
	readonly id: string
	readonly skill: SkillId
	/** The opportunity criterion this scenario practises. */
	readonly criterion: CriterionId
	readonly difficulty: Difficulty
	readonly title: string
	/** The situation, in a sentence or two. */
	readonly setup: string
	readonly conversation: readonly ScenarioTurn[]
	readonly question: string
	/** Exactly one `effective` option; the rest are `partial` or `ineffective`. */
	readonly options: readonly ScenarioOption[]
	readonly matters: string
	readonly better: string
	readonly takeaway: string
}
