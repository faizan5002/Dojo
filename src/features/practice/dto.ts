import type { StoredAttempt } from './practice-repository'
import type { PracticeContext } from './load-practice'
import type { Challenge, Evaluation, PublicChallenge } from './types'

const RECENT_ATTEMPTS = 5

// The JSON shapes of the Prompting Guru API. A challenge summary or detail
// never carries the criteria or the strong answer; those travel only with the
// user's own attempt, after it has been scored.

export interface ChallengeSummaryDto {
	readonly id: string
	readonly slug: string
	readonly title: string
	readonly description: string
	readonly skill: string
	readonly difficulty: string
	readonly exerciseType: string
	readonly estimatedMinutes: number
	readonly version: number
	readonly tags: readonly string[]
}

/** A list entry, with the caller's own best score at it (null if never tried). */
export interface ChallengeListItemDto extends ChallengeSummaryDto {
	readonly bestScore: number | null
}

export interface ChallengeDetailDto extends ChallengeSummaryDto {
	readonly scenario: string
	readonly instructions: string
	/** The vague prompt to improve, or the fictional agent reply to answer. */
	readonly given: { readonly label: string; readonly text: string } | null
}

export interface AttemptSummaryDto {
	readonly id: string
	readonly challengeSlug: string
	readonly challengeVersion: number
	readonly score: number
	readonly band: string
	readonly createdAt: string
}

export interface AttemptDto extends AttemptSummaryDto {
	readonly title: string | null
	readonly answer: string
	readonly evaluator: string
	readonly evaluation: Evaluation
	/** The strong answer of the version this attempt was scored against. */
	readonly example: { readonly answer: string; readonly explanation: string } | null
}

export function toSummaryDto(challenge: PublicChallenge): ChallengeSummaryDto {
	return {
		id: challenge.id,
		slug: challenge.slug,
		title: challenge.title,
		description: challenge.description,
		skill: challenge.skill,
		difficulty: challenge.difficulty,
		exerciseType: challenge.type,
		estimatedMinutes: challenge.minutes,
		version: challenge.version,
		tags: challenge.tags
	}
}

export function toDetailDto(challenge: PublicChallenge): ChallengeDetailDto {
	return {
		...toSummaryDto(challenge),
		scenario: challenge.scenario,
		instructions: challenge.instructions,
		given: challenge.given
	}
}

export function toAttemptSummaryDto(attempt: StoredAttempt): AttemptSummaryDto {
	return {
		id: attempt.id,
		challengeSlug: attempt.challengeSlug,
		challengeVersion: attempt.challengeVersion,
		score: attempt.score,
		band: attempt.evaluation.band,
		createdAt: attempt.createdAt.toISOString()
	}
}

export function toAttemptDto(attempt: StoredAttempt, version: Challenge | null): AttemptDto {
	return {
		...toAttemptSummaryDto(attempt),
		title: attempt.title,
		answer: attempt.prompt,
		evaluator: attempt.evaluator,
		evaluation: attempt.evaluation,
		example: version == null ? null : { answer: version.exemplar, explanation: version.explanation }
	}
}

export function toOverviewDto(context: PracticeContext) {
	return {
		mode: context.plan.mode,
		next: context.plan.next,
		focus: context.plan.focus,
		skills: context.plan.skills,
		due: context.plan.due.map((item) => ({ slug: item.slug, dueAt: item.dueAt.toISOString() })),
		summary: context.summary,
		recentAttempts: context.attempts.slice(0, RECENT_ATTEMPTS).map(toAttemptSummaryDto)
	}
}
