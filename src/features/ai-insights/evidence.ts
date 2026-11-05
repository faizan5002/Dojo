import type { SessionAnalysis } from './schemas'

// A session analysis may only quote what it was given. Every evidence quote is
// checked against the excerpts that were actually sent; one that does not
// appear there (paraphrased, merged or invented) is removed. An observation
// left with no verified quote cannot claim to be observed, so it is marked
// inferred. This runs on every answer before it is stored.

const normalise = (text: string) =>
	text
		.toLowerCase()
		.replace(/[“”"']/g, '')
		.replace(/…|\.\.\./g, '')
		.replace(/\s+/g, ' ')
		.trim()

/** Whether `quote` appears, ignoring case, spacing, quote marks and ellipses, in any source. */
export function isSupported(quote: string, sources: readonly string[]): boolean {
	const needle = normalise(quote)
	if (needle.length < 8) return false
	return sources.some((source) => normalise(source).includes(needle))
}

export function verifySessionAnalysis(
	analysis: SessionAnalysis,
	sources: readonly string[]
): SessionAnalysis {
	return {
		...analysis,
		observations: analysis.observations.map((observation) => {
			const evidence = observation.evidence.filter((quote) => isSupported(quote, sources))
			return {
				...observation,
				evidence,
				basis: evidence.length === 0 ? 'inferred' : observation.basis
			}
		})
	}
}
