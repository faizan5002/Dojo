import type { Interaction } from '../interactions'
import { onOpening, type Observation, type Signal } from '../observation'
import {
	EDGE_CASES,
	IMPLEMENTATION_REQUEST,
	PLAN_REQUEST,
	find,
	hasList,
	isSubstantial
} from '../signals'

// Planning is judged where it matters: at each larger build request. A small
// fix needs no plan, so it is not an observation at all.
const VALUE = { planned: 1, specified: 0.7, unplanned: 0.2 }
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+\S/m

function isLargerBuild(interaction: Interaction): boolean {
	return (
		interaction.kind === 'task' &&
		IMPLEMENTATION_REQUEST.test(interaction.text) &&
		isSubstantial(interaction.text)
	)
}

function evaluate({
	build,
	earlier
}: {
	build: Interaction
	earlier: readonly Interaction[]
}): Observation {
	for (const candidate of [...earlier, build]) {
		const plan = find(candidate.text, PLAN_REQUEST)
		if (plan != null) {
			return {
				value: VALUE.planned,
				signals: [
					{ criterion: 'asksForPlan', polarity: 'strength', interaction: candidate, span: plan }
				]
			}
		}
	}
	const signals: Signal[] = []
	const list = hasList(build.text) ? find(build.text, LIST_ITEM) : null
	const edges = find(build.text, EDGE_CASES)
	if (list != null) {
		signals.push({
			criterion: 'structuredRequirements',
			polarity: 'strength',
			interaction: build,
			span: list
		})
	}
	if (edges != null) {
		signals.push({
			criterion: 'considersEdgeCases',
			polarity: 'strength',
			interaction: build,
			span: edges
		})
	}
	if (signals.length > 0) return { value: VALUE.specified, signals }
	return {
		value: VALUE.unplanned,
		signals: [
			onOpening({ criterion: 'straightToBuild', interaction: build, rewrite: ['planFirst'] })
		]
	}
}

export function evaluatePlanning(sessions: readonly (readonly Interaction[])[]): Observation[] {
	return sessions.flatMap((session) =>
		session.flatMap((interaction, index) =>
			isLargerBuild(interaction)
				? [evaluate({ build: interaction, earlier: session.slice(0, index) })]
				: []
		)
	)
}
