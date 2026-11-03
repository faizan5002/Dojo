import { EVALUATORS } from '@/features/assessment/assess'
import { prepareSessions } from '@/features/assessment/interactions'
import type { CriterionId, SkillId } from '@/features/assessment/rubric'
import type { ParsedSession, Turn } from '@/features/sessions/types'

/**
 * Practice scoring: reads one rewritten prompt with the same rules the
 * assessment uses (`rules-1.0`). Deterministic, local and not AI. It reads
 * wording, not intent, so a pass shows the pattern is gone, not that the
 * prompt is good.
 */

export type DrillVerdict =
	/** The rubric could not read the text as the kind of prompt this skill scores. */
	| 'notEvaluable'
	/** The weakness the drill targets is still detected. */
	| 'weaknessRemains'
	/** The weakness is not detected, and the rubric found nothing positive either. */
	| 'noEvidence'
	/** The weakness is not detected, and at least one strength of this skill is. */
	| 'improved'

export interface DrillFinding {
	readonly criterion: CriterionId
	/** Exactly the slice of the rewrite the rule matched. */
	readonly quote: string
}

export interface DrillResult {
	readonly verdict: DrillVerdict
	/** Mean of the rubric's 0 to 1 observation for this prompt, as 0 to 100. Null when not evaluable. */
	readonly value: number | null
	readonly weakness: DrillFinding | null
	readonly strengths: readonly DrillFinding[]
}

const PERCENT = 100
const NOT_EVALUABLE: DrillResult = {
	verdict: 'notEvaluable',
	value: null,
	weakness: null,
	strengths: []
}

// Verification and iteration are judged across prompts, so the rewrite is placed
// where the rubric would look: a change the agent already delivered, followed by
// a task that does not check it; or a reply to an agent's answer. These stand-ins
// are never shown as the user's words and never scored.
const AGENT_ANSWER = 'Done.'
const EARLIER_REQUEST = 'Build the feature.'
const UNRELATED_NEXT_TASK = 'Now add the next feature.'

const entry = (text: string) => ({ timestamp: '', text })

function turnsFor(skill: SkillId, text: string): { turns: readonly Turn[]; rewriteNumber: number } {
	if (skill === 'verification') {
		return {
			turns: [
				{ prompt: entry(text), response: entry(AGENT_ANSWER) },
				{ prompt: entry(UNRELATED_NEXT_TASK), response: null }
			],
			rewriteNumber: 1
		}
	}
	if (skill === 'iteration') {
		return {
			turns: [
				{ prompt: entry(EARLIER_REQUEST), response: entry(AGENT_ANSWER) },
				{ prompt: entry(text), response: null }
			],
			rewriteNumber: 2
		}
	}
	return { turns: [{ prompt: entry(text), response: null }], rewriteNumber: 1 }
}

export function scoreRewrite({
	text,
	skill,
	criterion
}: {
	text: string
	skill: SkillId
	/** The criterion the drill targets: an opportunity the assessment recorded. */
	criterion: CriterionId
}): DrillResult {
	if (text.trim() === '') return NOT_EVALUABLE
	const { turns, rewriteNumber } = turnsFor(skill, text)
	const session: ParsedSession = {
		sessionId: 'practice',
		agent: 'unknown',
		project: null,
		generatedAt: null,
		turns
	}
	const prepared = prepareSessions([session])
	const observations = EVALUATORS[skill](prepared.sessions).filter((observation) =>
		observation.signals.every((signal) => signal.interaction.promptNumber === rewriteNumber)
	)
	if (observations.length === 0) return NOT_EVALUABLE
	const signals = observations
		.flatMap((observation) => observation.signals)
		.filter((signal) => signal.span.end > signal.span.start)
	const finding = (signal: (typeof signals)[number]): DrillFinding => ({
		criterion: signal.criterion,
		quote: signal.interaction.text.slice(signal.span.start, signal.span.end)
	})
	const weakness = signals.find(
		(signal) => signal.polarity === 'opportunity' && signal.criterion === criterion
	)
	const strengths = signals.filter((signal) => signal.polarity === 'strength').map(finding)
	const mean =
		observations.reduce((total, observation) => total + observation.value, 0) / observations.length
	const verdict: DrillVerdict =
		weakness != null ? 'weaknessRemains' : strengths.length > 0 ? 'improved' : 'noEvidence'
	return {
		verdict,
		value: Math.round(mean * PERCENT),
		weakness: weakness == null ? null : finding(weakness),
		strengths
	}
}
