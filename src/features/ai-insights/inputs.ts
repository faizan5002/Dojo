import { createHash } from 'node:crypto'
import { redactSecrets } from '@/features/assessment/redact'
import type { Assessment } from '@/features/assessment/types'
import type { PracticePlan } from '@/features/practice/plan'
import type { StoredAttempt } from '@/features/practice/practice-repository'
import type { CatalogEntry, Challenge, PublicChallenge } from '@/features/practice/types'
import type { MetricsOverview, PromptTotals } from '@/features/sessions/metrics'
import type { ParsedSession } from '@/features/sessions/types'

// Exactly what is sent to the AI provider for each insight, built from data
// the caller already owns. Minimised on purpose: the deterministic results and
// short, re-redacted excerpts, never whole logs, never answer keys, never ids
// of other people. Pure, so the tests can see precisely what would leave Dojo.

/** How much of a user's own text an analysis may carry. */
export const INPUT_LIMITS = {
	sessions: 6,
	promptsPerSession: 6,
	excerptChars: 400,
	totalExcerptChars: 9_000,
	evidencePerSkill: 3,
	evidenceChars: 300,
	answerChars: 8_000,
	recentAttempts: 5
} as const

/** Redacts credentials again (a backstop) and trims to a length. */
export function excerpt(text: string, max: number): string {
	const clean = redactSecrets(text).text.replace(/\s+/g, ' ').trim()
	return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

const totalsOf = (totals: PromptTotals) => ({
	promptCount: totals.promptCount,
	responseCount: totals.responseCount,
	averagePromptWords: totals.averagePromptWords,
	averageGapMinutes: totals.averageGapMinutes,
	codeBlocksPerPrompt: totals.codeBlocksPerPrompt,
	filePathsPerPrompt: totals.filePathsPerPrompt
})

/** Evenly spread picks, so a long session is sampled across its length, not just its start. */
function spread<T>(items: readonly T[], count: number): T[] {
	if (items.length <= count) return [...items]
	const step = items.length / count
	return Array.from({ length: count }, (_, index) => items[Math.floor(index * step)]).filter(
		(item): item is T => item !== undefined
	)
}

export function sessionAnalysisInput({
	overview,
	sessions
}: {
	overview: MetricsOverview
	sessions: readonly ParsedSession[]
}) {
	let budget = INPUT_LIMITS.totalExcerptChars
	const sampled = spread(sessions, INPUT_LIMITS.sessions).map((session, index) => {
		const prompts = session.turns.flatMap((turn) => (turn.prompt == null ? [] : [turn.prompt.text]))
		const picked = spread(prompts, INPUT_LIMITS.promptsPerSession).flatMap((prompt) => {
			if (budget <= 0) return []
			const quote = excerpt(prompt, Math.min(INPUT_LIMITS.excerptChars, budget))
			budget -= quote.length
			return [quote]
		})
		return {
			session: index + 1,
			agent: session.agent,
			totalPrompts: prompts.length,
			samplePrompts: picked
		}
	})
	return {
		totals: { sessions: overview.sessionCount, ...totalsOf(overview) },
		sampledSessions: sampled,
		note: `A sample: up to ${INPUT_LIMITS.promptsPerSession} prompts from each of up to ${INPUT_LIMITS.sessions} sessions, trimmed, with credentials redacted.`
	}
}

/** Every quote in a session analysis input, for checking the model's evidence against. */
export function quotesIn(input: ReturnType<typeof sessionAnalysisInput>): string[] {
	return input.sampledSessions.flatMap((session) => session.samplePrompts)
}

export function assessmentExplanationInput(assessment: Assessment) {
	return {
		overall: {
			score: assessment.overall.score,
			proficiency: assessment.overall.proficiency,
			skillsScored: assessment.overall.skillsAssessed,
			strongest: assessment.overall.strongest,
			weakest: assessment.overall.weakest
		},
		sessions: assessment.sessionCount,
		prompts: assessment.promptCount,
		skills: assessment.skills.map((skill) => ({
			skill: skill.skill,
			score: skill.score,
			proficiency: skill.proficiency,
			status: skill.score == null ? 'not scored: insufficient evidence' : 'scored',
			confidence: skill.confidence,
			observations: skill.observations,
			behaviours: skill.tallies
				.filter((tally) => tally.count > 0)
				.map((tally) => ({ behaviour: tally.criterion, kind: tally.polarity, count: tally.count })),
			evidence: skill.evidence.slice(0, INPUT_LIMITS.evidencePerSkill).map((item) => ({
				behaviour: item.criterion,
				kind: item.polarity,
				quote: excerpt(item.excerpt, INPUT_LIMITS.evidenceChars)
			}))
		})),
		ruleRecommendations: assessment.recommendations.map((item) => ({
			skill: item.skill,
			behaviour: item.criterion,
			seen: `${item.count} of ${item.total}`
		}))
	}
}

const challengeBrief = (challenge: PublicChallenge) => ({
	title: challenge.title,
	skill: challenge.skill,
	exerciseType: challenge.type,
	difficulty: challenge.difficulty,
	scenario: challenge.scenario,
	instructions: challenge.instructions,
	given: challenge.given
})

/** C + D. The strong answer and the hidden criteria are not sent: the feedback is independent. */
export function attemptFeedbackInput({
	challenge,
	attempt
}: {
	challenge: PublicChallenge
	attempt: Pick<StoredAttempt, 'prompt' | 'score' | 'evaluation'>
}) {
	return {
		challenge: challengeBrief(challenge),
		answer: excerpt(attempt.prompt, INPUT_LIMITS.answerChars),
		officialResult: {
			score: attempt.score,
			band: attempt.evaluation.band,
			criteria: attempt.evaluation.criteria.map((criterion) => ({
				label: criterion.label,
				status: criterion.status
			}))
		}
	}
}

/** E. Only the public brief: the example is written independently of Dojo's own. */
export function challengeExampleInput(challenge: Challenge) {
	return { challenge: challengeBrief(challenge) }
}

/** F. The planner's choice and the history behind it; the model explains, never chooses. */
export function recommendationExplanationInput({
	plan,
	next,
	attempts
}: {
	plan: PracticePlan
	next: CatalogEntry
	attempts: readonly Pick<StoredAttempt, 'skill' | 'score' | 'title' | 'createdAt'>[]
}) {
	const skill = plan.skills.find((each) => each.skill === next.skill)
	return {
		mode: plan.mode,
		recommended: {
			title: next.title,
			description: next.description,
			skill: next.skill,
			difficulty: next.difficulty,
			plannerReason: plan.next?.reason ?? null
		},
		skill:
			skill == null
				? null
				: {
						assessmentScore: skill.assessmentScore,
						priority: skill.priority,
						shareOfPractice: Math.round(skill.share * 100),
						attempts: skill.attempts,
						practiceAverage:
							skill.practiceAverage == null ? null : Math.round(skill.practiceAverage),
						trend: skill.trend
					},
		focusSkills: plan.focus,
		dueReviews: plan.due.length,
		recentAttemptsAtThisSkill: attempts
			.filter((attempt) => attempt.skill === next.skill)
			.slice(0, INPUT_LIMITS.recentAttempts)
			.map((attempt) => ({
				challenge: attempt.title,
				score: attempt.score,
				on: attempt.createdAt.toISOString().slice(0, 10)
			}))
	}
}

/** A stable fingerprint of an input, so an unchanged input reuses its stored result. */
export function hashInput(input: unknown): string {
	return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}
