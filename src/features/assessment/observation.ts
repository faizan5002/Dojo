import type { Interaction } from './interactions'
import {
	MAX_EVIDENCE_PER_POLARITY,
	confidenceOf,
	proficiencyOf,
	type CriterionId,
	type SkillId
} from './rubric'
import { clippedEdges, openingSpan, type Span } from './signals'
import type { CriterionTally, Evidence, Polarity, RewriteLine, SkillAssessment } from './types'

/** One behaviour seen (or missed) in one prompt, with the text that shows it. */
export interface Signal {
	readonly criterion: CriterionId
	readonly polarity: Polarity
	readonly interaction: Interaction
	readonly span: Span
	/** Template lines for a suggested rewrite of this prompt, when one helps. */
	readonly rewrite?: readonly RewriteLine[]
}

/** One scored opportunity for a skill: how well it went, 0–1, and why. */
export interface Observation {
	readonly value: number
	readonly signals: readonly Signal[]
}

const PERCENT = 100

function tally(signals: readonly Signal[]): CriterionTally[] {
	const counts = new Map<string, CriterionTally>()
	for (const signal of signals) {
		const key = `${signal.polarity}:${signal.criterion}`
		const current = counts.get(key)
		counts.set(key, {
			criterion: signal.criterion,
			polarity: signal.polarity,
			count: (current?.count ?? 0) + 1
		})
	}
	return [...counts.values()].sort((a, b) => b.count - a.count)
}

// Distinct criteria first, so the quotes show the range of what was seen, then
// more examples of the same criterion if there is room.
function pick(signals: readonly Signal[], polarity: Polarity): Signal[] {
	const candidates = signals.filter((signal) => signal.polarity === polarity)
	const seen = new Set<string>()
	const quoted = new Set<string>()
	const chosen: Signal[] = []
	const quote = (signal: Signal) =>
		`${signal.interaction.sessionId}:${signal.interaction.promptNumber}:${signal.span.start}`
	for (const pass of [true, false]) {
		for (const signal of candidates) {
			if (chosen.length >= MAX_EVIDENCE_PER_POLARITY) return chosen
			if (quoted.has(quote(signal)) || (pass && seen.has(signal.criterion))) continue
			seen.add(signal.criterion)
			quoted.add(quote(signal))
			chosen.push(signal)
		}
	}
	return chosen
}

function toEvidence({
	skill,
	signal,
	index
}: {
	skill: SkillId
	signal: Signal
	index: number
}): Evidence {
	const { text, sessionId, promptNumber } = signal.interaction
	const opening = openingSpan(text)
	const clipped = clippedEdges(text, signal.span)
	return {
		id: `${skill}-${index + 1}`,
		skill,
		criterion: signal.criterion,
		polarity: signal.polarity,
		sessionId,
		promptNumber,
		excerpt: text.slice(signal.span.start, signal.span.end),
		start: signal.span.start,
		end: signal.span.end,
		clippedBefore: clipped.before,
		clippedAfter: clipped.after,
		suggestion:
			signal.rewrite == null || signal.rewrite.length === 0
				? null
				: { base: text.slice(opening.start, opening.end), additions: signal.rewrite }
	}
}

export function summarizeSkill({
	skill,
	observations
}: {
	skill: SkillId
	observations: readonly Observation[]
}): SkillAssessment {
	const confidence = confidenceOf(skill, observations.length)
	const signals = observations.flatMap((observation) => observation.signals)
	const mean =
		observations.reduce((total, observation) => total + observation.value, 0) /
		Math.max(observations.length, 1)
	const score =
		confidence === 'insufficient'
			? null
			: Math.min(PERCENT, Math.max(0, Math.round(mean * PERCENT)))
	const chosen = [...pick(signals, 'strength'), ...pick(signals, 'opportunity')]
	return {
		skill,
		score,
		proficiency: score == null ? null : proficiencyOf(score),
		confidence,
		observations: observations.length,
		tallies: tally(signals),
		evidence: chosen
			.filter((signal) => signal.span.end > signal.span.start)
			.map((signal, index) => toEvidence({ skill, signal, index }))
	}
}

/** A signal on the prompt's opening sentence, for behaviour that is absent. */
export function onOpening({
	criterion,
	interaction,
	rewrite
}: {
	criterion: CriterionId
	interaction: Interaction
	rewrite?: readonly RewriteLine[]
}): Signal {
	return {
		criterion,
		polarity: 'opportunity',
		interaction,
		span: openingSpan(interaction.text),
		rewrite
	}
}
