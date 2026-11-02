import type { Interaction } from '../interactions'
import { onOpening, type Observation, type Signal } from '../observation'
import {
	CONSTRAINT,
	DONE,
	TASK_REQUEST,
	find,
	findContext,
	isSubstantial,
	isVagueReference,
	sentenceSpan,
	type Span
} from '../signals'
import type { RewriteLine } from '../types'

// A larger request needs all four; a small one is clear with a goal and an
// anchor, and is not marked down for omitting constraints it does not need.
// Length is never scored: a short precise prompt can reach 1.
const LARGER_REQUEST_WEIGHTS = {
	statesGoal: 0.3,
	givesContext: 0.3,
	statesConstraints: 0.2,
	definesDone: 0.2
}
const SMALL_REQUEST_VALUE = { goalAndContext: 1, goalOnly: 0.6, contextOnly: 0.5, neither: 0.2 }
const VAGUE_REFERENCE_CAP = 0.2

function goalOf(interaction: Interaction): Span | null {
	if (interaction.kind === 'task') return find(interaction.text, TASK_REQUEST)
	const mark = interaction.text.indexOf('?')
	return sentenceSpan(interaction.text, Math.max(mark, 0))
}

function evaluate(interaction: Interaction): Observation {
	const { text } = interaction
	const goal = goalOf(interaction)
	const context = findContext(text)
	const signals: Signal[] = []
	const credit = (criterion: Signal['criterion'], span: Span | null) => {
		if (span != null) signals.push({ criterion, polarity: 'strength', interaction, span })
	}
	credit('statesGoal', goal)
	credit('givesContext', context)

	let value: number
	if (interaction.kind === 'task' && isSubstantial(text)) {
		const constraints = find(text, CONSTRAINT)
		const done = find(text, DONE)
		credit('statesConstraints', constraints)
		credit('definesDone', done)
		const rewrite: RewriteLine[] = [
			...(context == null ? (['context'] as const) : []),
			...(constraints == null ? (['constraints'] as const) : []),
			...(done == null ? (['doneWhen'] as const) : [])
		]
		const missing = [
			{ criterion: 'statesGoal', present: goal != null },
			{ criterion: 'givesContext', present: context != null },
			{ criterion: 'statesConstraints', present: constraints != null },
			{ criterion: 'definesDone', present: done != null }
		] as const
		for (const each of missing) {
			if (!each.present)
				signals.push(onOpening({ criterion: each.criterion, interaction, rewrite }))
		}
		value = missing.reduce(
			(total, each) => total + (each.present ? LARGER_REQUEST_WEIGHTS[each.criterion] : 0),
			0
		)
	} else {
		if (goal == null) signals.push(onOpening({ criterion: 'statesGoal', interaction }))
		if (context == null) {
			signals.push(onOpening({ criterion: 'givesContext', interaction, rewrite: ['context'] }))
		}
		value =
			goal != null && context != null
				? SMALL_REQUEST_VALUE.goalAndContext
				: goal != null
					? SMALL_REQUEST_VALUE.goalOnly
					: context != null
						? SMALL_REQUEST_VALUE.contextOnly
						: SMALL_REQUEST_VALUE.neither
	}

	if (context == null && isVagueReference(text)) {
		value = Math.min(value, VAGUE_REFERENCE_CAP)
		signals.push(onOpening({ criterion: 'vagueReference', interaction, rewrite: ['context'] }))
	}
	return { value, signals }
}

/** One observation per request or question; approvals and follow-ups are not requests. */
export function evaluateClarity(sessions: readonly (readonly Interaction[])[]): Observation[] {
	return sessions
		.flat()
		.filter((interaction) => interaction.kind === 'task' || interaction.kind === 'question')
		.map(evaluate)
}
