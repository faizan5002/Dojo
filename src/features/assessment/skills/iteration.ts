import type { Interaction } from '../interactions'
import { onOpening, type Observation, type Signal } from '../observation'
import {
	EXPECTATION,
	REFINEMENT,
	find,
	findContext,
	isShortFeedback,
	similarity,
	wordCount
} from '../signals'

// Each follow-up to an agent's answer is an observation: does it give the agent
// something new to act on?
const VALUE = {
	specificAndExpected: 1,
	refined: 0.8,
	specificOrExpected: 0.7,
	unremarkable: 0.5,
	vague: 0.25,
	repeated: 0
}
const REPEAT_SIMILARITY = 0.8
const REPEAT_MIN_WORDS = 5

function evaluate({
	followUp,
	earlier
}: {
	followUp: Interaction
	earlier: readonly Interaction[]
}): Observation {
	const { text } = followUp
	const repeated =
		wordCount(text) >= REPEAT_MIN_WORDS &&
		earlier.some((previous) => similarity(previous.text, text) >= REPEAT_SIMILARITY)
	if (repeated) {
		return {
			value: VALUE.repeated,
			signals: [
				onOpening({
					criterion: 'repeatedPrompt',
					interaction: followUp,
					rewrite: ['expectedActual']
				})
			]
		}
	}
	const specific = findContext(text)
	const expected = find(text, EXPECTATION)
	const signals: Signal[] = []
	if (specific != null) {
		signals.push({
			criterion: 'specificFeedback',
			polarity: 'strength',
			interaction: followUp,
			span: specific
		})
	}
	if (expected != null) {
		signals.push({
			criterion: 'statesExpectedVsActual',
			polarity: 'strength',
			interaction: followUp,
			span: expected
		})
	}
	if (specific != null && expected != null) return { value: VALUE.specificAndExpected, signals }
	if (signals.length > 0) return { value: VALUE.specificOrExpected, signals }
	const refinement = find(text, REFINEMENT)
	if (refinement != null) {
		return {
			value: VALUE.refined,
			signals: [
				{
					criterion: 'refinesRequirement',
					polarity: 'strength',
					interaction: followUp,
					span: refinement
				}
			]
		}
	}
	if (isShortFeedback(text)) {
		return {
			value: VALUE.vague,
			signals: [
				onOpening({
					criterion: 'vagueFeedback',
					interaction: followUp,
					rewrite: ['expectedActual']
				})
			]
		}
	}
	return { value: VALUE.unremarkable, signals: [] }
}

export function evaluateIteration(sessions: readonly (readonly Interaction[])[]): Observation[] {
	return sessions.flatMap((session) =>
		session.flatMap((interaction, index) =>
			interaction.kind === 'feedback'
				? [evaluate({ followUp: interaction, earlier: session.slice(0, index) })]
				: []
		)
	)
}
