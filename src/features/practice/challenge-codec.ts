import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { ChallengeDefinition, Criterion, Pitfall } from './types'

// How a challenge's rubric is stored in PostgreSQL. Patterns are kept as their
// source and flags, validated on the way in and on the way out, and compiled
// back to RegExp only when a challenge is loaded for scoring. A stateful flag
// (g, y) would make `test` and `exec` skip matches, so only i, m, s, u pass.

const MAX_PATTERN_CHARS = 2_000
const MAX_TEXT_CHARS = 2_000

const patternSchema = z.object({
	source: z.string().min(1).max(MAX_PATTERN_CHARS),
	flags: z.string().regex(/^[imsu]*$/)
})

const criterionSchema = z.object({
	id: z.string().min(1).max(60),
	label: z.string().min(1).max(MAX_TEXT_CHARS),
	weight: z.number().int().positive(),
	anyOf: z.array(patternSchema).min(1),
	near: z.array(patternSchema).min(1).optional(),
	hint: z.string().min(1).max(MAX_TEXT_CHARS),
	template: z.string().min(1).max(MAX_TEXT_CHARS)
})

const pitfallSchema = z.object({
	id: z.string().min(1).max(60),
	label: z.string().min(1).max(MAX_TEXT_CHARS),
	pattern: patternSchema,
	penalty: z.number().int().positive()
})

export const storedCriteriaSchema = z.array(criterionSchema).min(1)
export const storedPitfallsSchema = z.array(pitfallSchema)

export type StoredCriterion = z.infer<typeof criterionSchema>
export type StoredPitfall = z.infer<typeof pitfallSchema>
type StoredPattern = z.infer<typeof patternSchema>

const encodePattern = (pattern: RegExp): StoredPattern => ({
	source: pattern.source,
	flags: pattern.flags
})

const decodePattern = (pattern: StoredPattern): RegExp => new RegExp(pattern.source, pattern.flags)

export function encodeCriteria(criteria: readonly Criterion[]): StoredCriterion[] {
	return storedCriteriaSchema.parse(
		criteria.map((criterion) => ({
			id: criterion.id,
			label: criterion.label,
			weight: criterion.weight,
			anyOf: criterion.anyOf.map(encodePattern),
			...(criterion.near == null ? {} : { near: criterion.near.map(encodePattern) }),
			hint: criterion.hint,
			template: criterion.template
		}))
	)
}

export function encodePitfalls(pitfalls: readonly Pitfall[]): StoredPitfall[] {
	return storedPitfallsSchema.parse(
		pitfalls.map((pitfall) => ({
			id: pitfall.id,
			label: pitfall.label,
			pattern: encodePattern(pitfall.pattern),
			penalty: pitfall.penalty
		}))
	)
}

/** Parses stored criteria; throws if the JSON is not a valid rubric. */
export function decodeCriteria(json: unknown): Criterion[] {
	return storedCriteriaSchema.parse(json).map((criterion) => ({
		id: criterion.id,
		label: criterion.label,
		weight: criterion.weight,
		anyOf: criterion.anyOf.map(decodePattern),
		...(criterion.near == null ? {} : { near: criterion.near.map(decodePattern) }),
		hint: criterion.hint,
		template: criterion.template
	}))
}

export function decodePitfalls(json: unknown): Pitfall[] {
	return storedPitfallsSchema.parse(json).map((pitfall) => ({
		id: pitfall.id,
		label: pitfall.label,
		pattern: decodePattern(pitfall.pattern),
		penalty: pitfall.penalty
	}))
}

/**
 * A fingerprint of everything a version stores, so re-running the seed can
 * tell identical content (nothing to do) from an edit (needs a new version).
 * The key order is fixed here, not taken from the object.
 */
export function contentHashOf(definition: ChallengeDefinition): string {
	const content = [
		definition.title,
		definition.description,
		definition.skill,
		definition.type,
		definition.difficulty,
		definition.scenario,
		definition.instructions,
		definition.given?.label ?? null,
		definition.given?.text ?? null,
		encodeCriteria(definition.criteria),
		encodePitfalls(definition.pitfalls),
		definition.exemplar,
		definition.explanation,
		definition.minutes,
		[...definition.tags]
	]
	return createHash('sha256').update(JSON.stringify(content)).digest('hex')
}
