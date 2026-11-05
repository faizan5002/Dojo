import { proficiencyOf } from '@/features/assessment/rubric'
import { sentenceSpan, similarity, wordCount } from '@/features/assessment/signals'
import type {
	ChallengeRubric,
	Criterion,
	CriterionResult,
	Evaluation,
	Pitfall,
	PitfallResult,
	PromptEvaluator
} from './types'

// The rules evaluator. It reads wording, not intent: every criterion is met
// by a sentence the user wrote, which is quoted back, so a person can judge
// whether the rule read it right. The score is the met criteria's share of
// the challenge's weights, less pitfalls, under a few honest caps.

export const RULES_EVALUATOR_ID = 'rules-1.0'

const PERCENT = 100
const PARTIAL = 0.5
/** A criterion met only by a fragment (a bare keyword list) counts as partial. */
const MIN_SENTENCE_WORDS = 4
/** Below this an answer is too short to judge as a real prompt. */
const MIN_ANSWER_WORDS = 12
const SHORT_ANSWER_CAP = 25
/** An answer this close to the given vague prompt is the same prompt. */
const UNCHANGED_SIMILARITY = 0.85
const UNCHANGED_CAP = 10
const MAX_PITFALL_PENALTY = 30

function sentenceOf(text: string, pattern: RegExp): string | null {
	const match = pattern.exec(text)
	if (match == null) return null
	const span = sentenceSpan(text, match.index, match[0].length)
	return text.slice(span.start, span.end)
}

function judge(text: string, criterion: Criterion): CriterionResult {
	const base = { id: criterion.id, label: criterion.label, weight: criterion.weight }
	let fragment: string | null = null
	for (const pattern of criterion.anyOf) {
		const sentence = sentenceOf(text, pattern)
		if (sentence == null) continue
		if (wordCount(sentence) < MIN_SENTENCE_WORDS) {
			fragment ??= sentence
			continue
		}
		const isTied = criterion.near == null || criterion.near.some((near) => near.test(sentence))
		if (isTied) {
			return { ...base, status: 'met', points: criterion.weight, evidence: sentence, note: '' }
		}
		return {
			...base,
			status: 'partial',
			points: criterion.weight * PARTIAL,
			evidence: sentence,
			note: 'mentioned, but not tied to this task'
		}
	}
	if (fragment != null) {
		return {
			...base,
			status: 'partial',
			points: criterion.weight * PARTIAL,
			evidence: fragment,
			note: 'only a fragment, not an instruction'
		}
	}
	return { ...base, status: 'missing', points: 0, evidence: null, note: criterion.hint }
}

function findPitfall(text: string, pitfall: Pitfall): PitfallResult | null {
	const sentence = sentenceOf(text, pitfall.pattern)
	return sentence == null
		? null
		: { id: pitfall.id, label: pitfall.label, penalty: pitfall.penalty, evidence: sentence }
}

/**
 * The score from per-criterion and per-pitfall judgements, whoever made them
 * (these rules, or an LLM judge in llm-evaluate.ts): the met criteria's share
 * of the weights (half for partial), less pitfalls, under the unchanged-prompt
 * and too-short caps, with a template suggestion for what is missing. One
 * arithmetic for both, so a score means the same whichever judged it.
 */
export function scoreJudgements({
	challenge,
	text,
	criteria,
	pitfalls,
	evaluator
}: {
	challenge: ChallengeRubric
	text: string
	criteria: readonly CriterionResult[]
	pitfalls: readonly PitfallResult[]
	evaluator: string
}): Evaluation {
	const totalWeight = challenge.criteria.reduce((total, criterion) => total + criterion.weight, 0)
	const earned = criteria.reduce((total, result) => total + result.points, 0)
	const penalty = Math.min(
		MAX_PITFALL_PENALTY,
		pitfalls.reduce((total, pitfall) => total + pitfall.penalty, 0)
	)
	let score = Math.max(0, Math.round((earned / Math.max(totalWeight, 1)) * PERCENT) - penalty)

	const caps: string[] = []
	if (challenge.given != null && similarity(text, challenge.given.text) >= UNCHANGED_SIMILARITY) {
		score = Math.min(score, UNCHANGED_CAP)
		caps.push('The answer is nearly the same as the prompt you were given.')
	}
	if (wordCount(text) < MIN_ANSWER_WORDS) {
		score = Math.min(score, SHORT_ANSWER_CAP)
		caps.push(`The answer is under ${MIN_ANSWER_WORDS} words, too short to judge as a full prompt.`)
	}

	const missing = criteria.filter((result) => result.status !== 'met')
	const templateLines = challenge.criteria
		.filter((criterion) => missing.some((result) => result.id === criterion.id))
		.map((criterion) => criterion.template)
	return {
		evaluator,
		score,
		band: proficiencyOf(score),
		criteria: [...criteria],
		pitfalls: [...pitfalls],
		caps,
		strengths: criteria.filter((result) => result.status === 'met').map((result) => result.label),
		missing: missing.map((result) => result.label),
		suggestion: templateLines.length === 0 ? text : `${text}\n\n${templateLines.join('\n')}`
	}
}

export function evaluateWithRules({
	challenge,
	prompt
}: {
	challenge: ChallengeRubric
	prompt: string
}): Evaluation {
	const text = prompt.trim()
	return scoreJudgements({
		challenge,
		text,
		criteria: challenge.criteria.map((criterion) => judge(text, criterion)),
		pitfalls: challenge.pitfalls.flatMap((pitfall) => {
			const found = findPitfall(text, pitfall)
			return found == null ? [] : [found]
		}),
		evaluator: RULES_EVALUATOR_ID
	})
}

export const rulesEvaluator: PromptEvaluator = {
	id: RULES_EVALUATOR_ID,
	evaluate: evaluateWithRules
}
