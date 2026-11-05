import { z } from 'zod'
import type { AiUsageMeta } from '@/server/lib/ai-usage/track'

// The provider-neutral half of AI generation. Features ask for structured
// output against a Zod schema; a provider (openrouter.ts or xai.ts; others
// later, as another `LlmProvider`) turns that into one tracked API call. The
// answer is parsed and validated here, so nothing a model returns reaches a
// caller unless it fits the schema. Pure: the provider is passed in, which is
// what the tests do. See docs/rules/ai-usage.md.

/** Why generation failed, in terms an endpoint can map to a status. */
export type AiFailure =
	| 'disabled' // AI is switched off, or not configured
	| 'unavailable' // the provider is down or unreachable
	| 'timeout'
	| 'rate_limited' // the provider's own limit, after bounded retries
	| 'payment_required' // out of credits, or a free quota that needs credits
	| 'auth' // our key was rejected: an operator problem, never shown as such
	| 'invalid_output' // the answer did not fit the schema, or was cut off
	| 'refused' // the provider declined to answer
	| 'quota_exceeded' // the user has used their generations for the day

export class AiError extends Error {
	readonly failure: AiFailure

	constructor(failure: AiFailure, options: { cause?: unknown } = {}) {
		super(`AI generation failed: ${failure}`, options)
		this.name = 'AiError'
		this.failure = failure
	}
}

export interface LlmRequest {
	/** The usage-tracking feature: what this spend is for. */
	readonly feature: string
	readonly system: string
	readonly user: string
	readonly schemaName: string
	readonly jsonSchema: Record<string, unknown>
	readonly maxOutputTokens: number
	/** Overrides the provider's default request timeout, for long generations. */
	readonly timeoutMs?: number
	/** ids, enums and booleans only (docs/rules/analytics.md rule 5). */
	readonly meta?: AiUsageMeta
}

export interface LlmResponse {
	readonly content: string
	readonly model: string
	/** `stop`, `length` (cut off at the token limit), `content_filter`, ... */
	readonly finishReason: string | null
}

export interface LlmProvider {
	readonly id: string
	readonly model: string
	/**
	 * Whether the schema it is sent may carry length and count limits. True
	 * where the schema is guidance (OpenRouter's tool parameters); false where
	 * a strict structured-output mode rejects those keywords (xAI).
	 */
	readonly acceptsSchemaLimits: boolean
	complete(request: LlmRequest): Promise<LlmResponse>
}

// Validation limits (lengths, counts, patterns) always stay in the Zod schema
// and are enforced after the call. What is sent depends on the provider
// (`acceptsSchemaLimits`): a strict structured-output mode rejects several of
// them, so for those they are taken out; otherwise counts are sent as they are
// and a length becomes a soft target in the field's description (see
// softenLengths).
const LOCAL_ONLY_KEYWORDS = new Set([
	'$schema',
	'minLength',
	'maxLength',
	'minItems',
	'maxItems',
	'pattern',
	'format',
	'minimum',
	'maximum'
])

function stripLocalOnly(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(stripLocalOnly)
	if (typeof value !== 'object' || value == null) return value
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => !LOCAL_ONLY_KEYWORDS.has(key))
			.map(([key, inner]) => [key, stripLocalOnly(inner)])
	)
}

/** Share of a hard length limit given to the model as its target. */
const SOFT_LENGTH_SHARE = 0.8

/**
 * Replaces each `maxLength` with a soft target in the description. Given the
 * hard number, a model stops writing at exactly that character, mid-word; told
 * to stay well under it, it writes complete text, and the rare overrun is cut
 * cleanly by fitToLimits.
 */
function softenLengths(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(softenLengths)
	if (typeof value !== 'object' || value == null) return value
	const entries = Object.entries(value)
	const max = entries.find(([key]) => key === 'maxLength')?.[1]
	const softened = entries
		.filter(([key]) => key !== 'maxLength' && key !== 'minLength')
		.map(([key, inner]): [string, unknown] => [key, softenLengths(inner)])
	if (typeof max !== 'number') return Object.fromEntries(softened)
	const described = entries.find(([key]) => key === 'description')?.[1]
	const hint = `Complete sentences, under ${Math.round(max * SOFT_LENGTH_SHARE)} characters.`
	return Object.fromEntries([
		...softened.filter(([key]) => key !== 'description'),
		['description', typeof described === 'string' ? `${described} ${hint}` : hint]
	])
}

const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value != null && !Array.isArray(value)
		? Object.fromEntries(Object.entries(value))
		: {}

/** The schema with its limits, as JSON Schema; `$schema` is dropped, it is not part of the shape. */
function fullSchemaOf(schema: z.ZodType): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(asRecord(z.toJSONSchema(schema, { target: 'draft-7' }))).filter(
			([key]) => key !== '$schema'
		)
	)
}

/**
 * The JSON Schema a provider is asked to follow, derived from the Zod schema:
 * with counts and soft length targets when the provider accepts them, without
 * limits otherwise.
 */
export function responseSchemaOf(
	schema: z.ZodType,
	{ withLimits = false }: { withLimits?: boolean } = {}
): Record<string, unknown> {
	const full = fullSchemaOf(schema)
	return asRecord(withLimits ? softenLengths(full) : stripLocalOnly(full))
}

/**
 * Brings an answer within the schema's length and count limits: overlong text
 * is cut at a word boundary with an ellipsis, surplus list items are dropped.
 * Nothing is added or invented, and everything else (missing fields, wrong
 * types, unknown enum values, empty text) is left for validation to reject. A
 * model that writes a 900-character summary where 800 are allowed has given a
 * usable answer; one that leaves out a field has not.
 */
export function fitToLimits(value: unknown, jsonSchema: Record<string, unknown>): unknown {
	if (typeof value === 'string') {
		const max = jsonSchema.maxLength
		if (typeof max !== 'number' || value.length <= max) return value
		const cut = value.slice(0, max - 1)
		const space = cut.lastIndexOf(' ')
		return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
	}
	if (Array.isArray(value)) {
		const max = jsonSchema.maxItems
		const kept = typeof max === 'number' ? value.slice(0, max) : value
		const items = asRecord(jsonSchema.items)
		return kept.map((item) => fitToLimits(item, items))
	}
	if (typeof value === 'object' && value != null) {
		const properties = asRecord(jsonSchema.properties)
		return Object.fromEntries(
			Object.entries(value).map(([key, inner]) => [
				key,
				key in properties ? fitToLimits(inner, asRecord(properties[key])) : inner
			])
		)
	}
	return value
}

/** Parses a model's text answer, fits it to the schema's limits, and validates it. */
export function parseStructured<T>(content: string, schema: z.ZodType<T>): T {
	let json: unknown
	try {
		json = JSON.parse(content)
	} catch (error) {
		throw new AiError('invalid_output', { cause: error })
	}
	const parsed = schema.safeParse(fitToLimits(json, fullSchemaOf(schema)))
	if (!parsed.success) throw new AiError('invalid_output', { cause: parsed.error })
	return parsed.data
}

export interface StructuredResult<T> {
	readonly data: T
	/** The model that actually answered, as the provider reported it. */
	readonly model: string
}

/**
 * One structured generation. Throws `AiError` for every failure, so callers
 * handle one error type; the provider's own detail stays in `cause`.
 */
export async function generateStructured<T>({
	provider,
	schema,
	...request
}: Omit<LlmRequest, 'jsonSchema'> & {
	provider: LlmProvider
	schema: z.ZodType<T>
}): Promise<StructuredResult<T>> {
	const response = await provider.complete({
		...request,
		jsonSchema: responseSchemaOf(schema, { withLimits: provider.acceptsSchemaLimits })
	})
	if (response.finishReason === 'content_filter') throw new AiError('refused')
	// A response cut off at the token limit is not valid JSON, or worse, is
	// valid JSON missing its end; either way it is not an answer.
	if (response.finishReason === 'length') throw new AiError('invalid_output')
	return { data: parseStructured(response.content, schema), model: response.model }
}
