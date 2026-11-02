import type { Interaction } from '../interactions'
import { onOpening, type Observation } from '../observation'
import {
	CHALLENGE,
	FEEDBACK,
	IMPLEMENTATION_REQUEST,
	OBSERVED,
	VERIFY_REQUEST,
	find
} from '../signals'

// Each delivered change is an opportunity to check it: in the request itself,
// or in the next few prompts. A change that ends the session is not counted
// either way, because the log cannot show a check made outside it.
const LOOKAHEAD_PROMPTS = 3
const VALUE = { checked: 1, unchecked: 0 }

function evaluate({
	change,
	later
}: {
	change: Interaction
	later: readonly Interaction[]
}): Observation | null {
	const asked = find(change.text, VERIFY_REQUEST)
	if (asked != null) {
		return {
			value: VALUE.checked,
			signals: [
				{ criterion: 'asksForVerification', polarity: 'strength', interaction: change, span: asked }
			]
		}
	}
	if (later.length === 0) return null
	for (const next of later) {
		const challenge = find(next.text, CHALLENGE)
		if (challenge != null) {
			return {
				value: VALUE.checked,
				signals: [
					{
						criterion: 'challengesClaims',
						polarity: 'strength',
						interaction: next,
						span: challenge
					}
				]
			}
		}
		const check =
			find(next.text, [VERIFY_REQUEST, OBSERVED]) ??
			(next.kind === 'feedback' ? find(next.text, FEEDBACK) : null)
		if (check != null) {
			return {
				value: VALUE.checked,
				signals: [
					{ criterion: 'checksResult', polarity: 'strength', interaction: next, span: check }
				]
			}
		}
	}
	return {
		value: VALUE.unchecked,
		signals: [
			onOpening({ criterion: 'acceptedWithoutCheck', interaction: change, rewrite: ['verify'] })
		]
	}
}

export function evaluateVerification(sessions: readonly (readonly Interaction[])[]): Observation[] {
	return sessions.flatMap((session) =>
		session.flatMap((interaction, index) => {
			if (
				interaction.kind !== 'task' ||
				!interaction.answered ||
				!IMPLEMENTATION_REQUEST.test(interaction.text)
			) {
				return []
			}
			const later = session
				.slice(index + 1, index + 1 + LOOKAHEAD_PROMPTS)
				.filter((next) => next.kind !== 'approval')
			const observation = evaluate({ change: interaction, later })
			return observation == null ? [] : [observation]
		})
	)
}
