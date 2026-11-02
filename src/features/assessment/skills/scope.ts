import type { Interaction } from '../interactions'
import { onOpening, type Observation, type Signal } from '../observation'
import { BOUNDARY, BROAD, countImperatives, find, findTargets } from '../signals'

// Every request starts neutral and moves with what it shows: named targets and
// stated limits narrow it, sweeping wording and bundled tasks widen it.
const NEUTRAL = 0.5
const NAMES_TARGETS = 0.25
const SETS_BOUNDARIES = 0.25
const BROAD_REQUEST = -0.3
const BUNDLED_REQUEST = -0.2
const BUNDLED_FROM_INSTRUCTIONS = 5

function evaluate(interaction: Interaction): Observation {
	const { text } = interaction
	const targets = findTargets(text)
	const boundary = find(text, BOUNDARY)
	const broad = find(text, BROAD)
	const bundled = countImperatives(text) >= BUNDLED_FROM_INSTRUCTIONS
	const signals: Signal[] = []
	if (targets != null) {
		signals.push({ criterion: 'namesTargets', polarity: 'strength', interaction, span: targets })
	}
	if (boundary != null) {
		signals.push({ criterion: 'setsBoundaries', polarity: 'strength', interaction, span: boundary })
	}
	if (broad != null) {
		signals.push({
			criterion: 'broadRequest',
			polarity: 'opportunity',
			interaction,
			span: broad,
			rewrite: ['scope']
		})
	}
	if (bundled) {
		signals.push(onOpening({ criterion: 'bundledRequest', interaction, rewrite: ['scope'] }))
	}
	const value =
		NEUTRAL +
		(targets != null ? NAMES_TARGETS : 0) +
		(boundary != null ? SETS_BOUNDARIES : 0) +
		(broad != null ? BROAD_REQUEST : 0) +
		(bundled ? BUNDLED_REQUEST : 0)
	return { value: Math.min(1, Math.max(0, value)), signals }
}

export function evaluateScope(sessions: readonly (readonly Interaction[])[]): Observation[] {
	return sessions
		.flat()
		.filter((interaction) => interaction.kind === 'task')
		.map(evaluate)
}
