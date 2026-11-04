import type { Proficiency, SkillId } from '@/features/assessment/rubric'

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** One exercise type per rubric skill. */
export const EXERCISE_TYPES = [
	'improveVaguePrompt',
	'planBeforeCoding',
	'verifyOutput',
	'improveIteration',
	'controlScope'
] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

/**
 * One thing a strong answer does. It is met when any `anyOf` pattern matches
 * a sentence of four or more words; if `near` is given, that sentence must
 * also mention the scenario, or it only counts half (mentioned, but not tied
 * to this task).
 */
export interface Criterion {
	readonly id: string
	readonly label: string
	/** Share of the score, out of the challenge's total (normalised to 100). */
	readonly weight: number
	readonly anyOf: readonly RegExp[]
	readonly near?: readonly RegExp[]
	/** What to add when it is missing: one line, used in feedback. */
	readonly hint: string
	/** A template line for the suggested prompt, with [brackets] to fill. */
	readonly template: string
}

/** Wording that works against the task, each costing `penalty` points. */
export interface Pitfall {
	readonly id: string
	readonly label: string
	readonly pattern: RegExp
	readonly penalty: number
}

/**
 * A challenge as authored: the seed content in prisma/seed/practice-challenges/,
 * and the shape every stored version decodes back into. `slug` is its stable
 * identity; changing anything else means a new `version`.
 */
export interface ChallengeDefinition {
	readonly slug: string
	readonly version: number
	readonly title: string
	readonly description: string
	readonly skill: SkillId
	readonly type: ExerciseType
	readonly difficulty: Difficulty
	readonly scenario: string
	readonly instructions: string
	/** The vague prompt to improve, or the fictional agent reply to answer. */
	readonly given: { readonly label: string; readonly text: string } | null
	readonly criteria: readonly Criterion[]
	readonly pitfalls: readonly Pitfall[]
	/** Shown only after an attempt: a strong answer and why it works. */
	readonly exemplar: string
	readonly explanation: string
	readonly minutes: number
	readonly tags: readonly string[]
	readonly isActive: boolean
}

/** One stored version of a challenge, loaded from the database. */
export interface Challenge extends ChallengeDefinition {
	/** The challenge's id (stable across versions). */
	readonly id: string
	/** This version's id: what an attempt records. */
	readonly versionId: string
}

/** What the evaluator needs, and nothing else. */
export type ChallengeRubric = Pick<ChallengeDefinition, 'criteria' | 'pitfalls' | 'given'>

/** What a page may show before the user has submitted: no criteria, no answer. */
export type PublicChallenge = Pick<
	Challenge,
	| 'id'
	| 'slug'
	| 'version'
	| 'title'
	| 'description'
	| 'skill'
	| 'type'
	| 'difficulty'
	| 'scenario'
	| 'instructions'
	| 'given'
	| 'minutes'
	| 'tags'
	| 'isActive'
>

/** The planner's view of the active library: one entry per challenge. */
export type CatalogEntry = Pick<
	Challenge,
	| 'slug'
	| 'version'
	| 'title'
	| 'description'
	| 'skill'
	| 'type'
	| 'difficulty'
	| 'minutes'
	| 'tags'
>

export type CriterionStatus = 'met' | 'partial' | 'missing'

export interface CriterionResult {
	readonly id: string
	readonly label: string
	readonly weight: number
	readonly status: CriterionStatus
	readonly points: number
	/** The user's sentence that met it, exactly as written. */
	readonly evidence: string | null
	readonly note: string
}

export interface PitfallResult {
	readonly id: string
	readonly label: string
	readonly penalty: number
	readonly evidence: string
}

export interface Evaluation {
	readonly evaluator: string
	readonly score: number
	readonly band: Proficiency
	readonly criteria: readonly CriterionResult[]
	readonly pitfalls: readonly PitfallResult[]
	/** Caps applied to the score, with the reason (too short, unchanged...). */
	readonly caps: readonly string[]
	readonly strengths: readonly string[]
	readonly missing: readonly string[]
	/** The user's own prompt, followed by template lines for what is missing. */
	readonly suggestion: string
}

/**
 * Anything that can score an answer against a challenge. The rules evaluator
 * is the only one today; an LLM evaluator could implement this later.
 */
export interface PromptEvaluator {
	readonly id: string
	evaluate(input: { readonly challenge: ChallengeRubric; readonly prompt: string }): Evaluation
}
